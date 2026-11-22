// Cria a reserva (pendente) e a cobrança PIX numa única chamada.
// Tudo é validado e calculado AQUI: quadra, data, horários, disponibilidade e
// principalmente o valor. O navegador só manda o que o cliente escolheu — nunca
// o preço — senão dava pra confirmar uma reserva pagando R$ 0,01.

const PENDING_TTL_MINUTES = 30;
const MAX_ADVANCE_DAYS = 30;
// A arena fica em Patos-PB (UTC-3, sem horário de verão).
const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

const COURTS: Record<string, string> = {
  "quadra-01": "Quadra 01",
  "quadra-02": "Quadra 02",
  "quadra-03": "Quadra 03",
  "quadra-04": "Quadra 04",
  "quadra-05": "Quadra 05",
  society: "Campo Society",
  tenis: "Quadra de Tênis",
};

const SPORTS = ["Vôlei", "Beach Tennis", "Futevôlei", "Futebol Society", "Tênis"];

// Slots de 30min das 05:00 às 22:30
const TIME_SLOTS: string[] = [];
for (let m = 5 * 60; m <= 22 * 60 + 30; m += 30) {
  TIME_SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Mesma tabela de preços do site (src/lib/bookings.ts e BookingPage.tsx).
// Se mudar o preço lá, mude aqui também.
function calcPrice(courtId: string, times: string[]): number {
  const n = times.length;
  if (courtId === "society") {
    if (n <= 2) return n * 50;
    if (n === 3) return 140;
    if (n === 4) return 180;
    return 180 + (n - 4) * 45;
  }
  if (courtId === "tenis") {
    return times.reduce((sum, t) => sum + (toMinutes(t) >= 18 * 60 ? 70 : 50) / 2, 0);
  }
  return n * 22.5;
}

// Rate limit em memória (por instância): corta geração de PIX em massa.
const RL_MAX = 6;
const RL_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function getClientIp(req: any): string {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (recent.length >= RL_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

// Horários ocupados na quadra/data, ignorando o booking `exceptId` e pendentes
// de PIX já expirados (mensalista pendente sempre bloqueia).
async function getTakenSlots(
  supabase: any,
  courtId: string,
  date: string,
  // Se informado: ignora esse booking e só considera os criados ANTES dele.
  before?: { id: string; ms: number }
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, time, status, created_at, monthly_subscriber_id")
    .eq("court_id", courtId)
    .eq("date", date)
    .neq("status", "cancelado");
  if (error) throw error;

  const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
  const taken = new Set<string>();
  for (const row of data || []) {
    if (before) {
      if (row.id === before.id) continue;
      const ms = new Date(row.created_at).getTime();
      const isEarlier = ms < before.ms || (ms === before.ms && String(row.id) < before.id);
      if (!isEarlier) continue;
    }
    if (row.status === "pendente" && !row.monthly_subscriber_id) {
      const createdMs = new Date(row.created_at).getTime();
      if (Number.isFinite(createdMs) && createdMs < ttlCutoff) continue;
    }
    String(row.time).split(", ").forEach((t) => taken.add(t));
  }
  return taken;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
  if (!supabaseUrl || !supabaseKey || !mpAccessToken) {
    console.error("create-pix: SUPABASE_URL/SERVICE_ROLE_KEY/MERCADO_PAGO_ACCESS_TOKEN não configurados");
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  if (rateLimited(getClientIp(req))) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
  }

  try {
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

    // ---------- Validação da entrada ----------
    const courtId = String(body.courtId || "");
    const courtName = COURTS[courtId];
    if (!courtName) return res.status(400).json({ error: "Quadra inválida" });

    const date = String(body.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
      return res.status(400).json({ error: "Data inválida" });
    }
    const localNow = new Date(Date.now() + TZ_OFFSET_MS);
    const todayStr = localNow.toISOString().slice(0, 10);
    const maxStr = new Date(localNow.getTime() + MAX_ADVANCE_DAYS * 86400000).toISOString().slice(0, 10);
    if (date < todayStr || date > maxStr) {
      return res.status(400).json({ error: "Data fora do período de agendamento" });
    }

    if (!Array.isArray(body.times)) return res.status(400).json({ error: "Horários inválidos" });
    const times: string[] = [...new Set<string>(body.times.map((t: unknown) => String(t)))].sort();
    if (times.length < 2) {
      return res.status(400).json({ error: "O tempo mínimo de reserva é 1 hora" });
    }
    if (!times.every((t) => TIME_SLOTS.includes(t))) {
      return res.status(400).json({ error: "Horários inválidos" });
    }
    const consecutive = times.every((t, i) => i === 0 || toMinutes(t) === toMinutes(times[i - 1]) + 30);
    if (!consecutive) return res.status(400).json({ error: "Os horários devem ser seguidos" });
    if (date === todayStr) {
      const nowMin = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
      if (toMinutes(times[0]) <= nowMin) {
        return res.status(400).json({ error: "Esse horário já passou. Escolha outro." });
      }
    }

    const name = String(body.name || "").trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: "Informe seu nome" });

    const digits = String(body.phone || "").replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 11) {
      return res.status(400).json({ error: "Informe um telefone válido com DDD" });
    }
    const phone = `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;

    let sport: string | null = null;
    if (courtId !== "society" && body.sport) {
      sport = String(body.sport);
      if (!SPORTS.includes(sport)) return res.status(400).json({ error: "Esporte inválido" });
    }
    // Esporte tem que combinar com a quadra (mesma regra de src/lib/bookings.ts).
    const allowedSports =
      courtId === "tenis" ? ["Tênis"] : ["Vôlei", "Beach Tennis", "Futevôlei"];
    if (sport && courtId !== "society" && !allowedSports.includes(sport)) {
      return res.status(400).json({ error: "Esse esporte não é jogado nessa quadra" });
    }

    const amount = calcPrice(courtId, times);

    // ---------- Disponibilidade ----------
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [taken, blockedRes, recurringRes] = await Promise.all([
      getTakenSlots(supabase, courtId, date),
      supabase.from("blocked_slots").select("time").eq("court_id", courtId).eq("date", date),
      supabase.from("recurring_blocked_slots").select("time").eq("court_id", courtId),
    ]);
    if (blockedRes.error) throw blockedRes.error;
    if (recurringRes.error) throw recurringRes.error;
    (blockedRes.data || []).forEach((r: any) => taken.add(r.time));
    (recurringRes.data || []).forEach((r: any) => taken.add(r.time));

    const unavailable = times.filter((t) => taken.has(t));
    if (unavailable.length > 0) {
      return res.status(409).json({
        error: `Horário(s) ${unavailable.join(", ")} acabou de ser reservado! Escolha outro horário.`,
      });
    }

    // ---------- Cria a reserva pendente ----------
    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        court_id: courtId,
        court_name: courtName,
        sport,
        date,
        time: times.join(", "),
        name,
        phone,
        status: "pendente",
        price: amount,
      })
      .select("id, created_at")
      .single();
    if (insertError || !booking) throw insertError || new Error("insert sem retorno");

    // Dois clientes podem passar pela checagem acima ao mesmo tempo. Reconfere
    // depois de inserir: se alguém que entrou ANTES pegou o mesmo horário, desiste.
    const earlier = await getTakenSlots(supabase, courtId, date, {
      id: String(booking.id),
      ms: new Date(booking.created_at).getTime(),
    });
    if (times.some((t) => earlier.has(t))) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return res.status(409).json({ error: "Esse horário acabou de ser reservado! Escolha outro horário." });
    }

    // ---------- Cobrança PIX ----------
    // Diz ao Mercado Pago para avisar este site quando o PIX for pago, mesmo que
    // nenhum webhook tenha sido configurado no painel do MP. A Vercel preenche
    // VERCEL_PROJECT_PRODUCTION_URL sozinha; PUBLIC_SITE_URL permite forçar outro domínio.
    const siteUrl = (
      process.env.PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
    ).replace(/\/+$/, "");
    const nameParts = name.split(/\s+/);
    const [yy, mm, dd] = date.split("-");
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pix-${booking.id}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Arena Beach - ${courtName} - ${dd}/${mm}/${yy} - ${times.join(", ")}`,
        payment_method_id: "pix",
        external_reference: booking.id,
        payer: {
          email: `cliente-${booking.id}@arenabeach.com.br`,
          first_name: nameParts[0] || "Cliente",
          last_name: nameParts.slice(1).join(" ") || "Arena",
        },
        date_of_expiration: new Date(Date.now() + PENDING_TTL_MINUTES * 60 * 1000).toISOString(),
        ...(siteUrl.startsWith("https://")
          ? { notification_url: `${siteUrl}/api/webhook-mp?source_news=webhooks` }
          : {}),
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro Mercado Pago:", mpData);
      // Sem PIX não há como pagar: libera o horário na hora.
      await supabase.from("bookings").update({ status: "cancelado" }).eq("id", booking.id);
      return res.status(502).json({ error: "Erro ao gerar PIX. Tente novamente." });
    }

    await supabase
      .from("bookings")
      .update({ mp_payment_id: String(mpData.id) })
      .eq("id", booking.id);

    const pixData = mpData.point_of_interaction?.transaction_data;
    return res.status(200).json({
      bookingId: booking.id,
      amount,
      paymentId: mpData.id,
      qrCode: pixData?.qr_code || "",
      qrCodeBase64: pixData?.qr_code_base64 || "",
      ticketUrl: pixData?.ticket_url || "",
      expiresAt: mpData.date_of_expiration,
    });
  } catch (error) {
    console.error("create-pix erro interno:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
