const PENDING_TTL_MINUTES = 30;

// ---------- Notificação para o dono (Web Push: celular e computador) ----------
// Manda a notificação para todos os aparelhos em que o admin ativou os avisos
// no painel. Nunca derruba a rota: se falhar, só registra no log.
type PushPayload = { title: string; body: string; url?: string; tag?: string };

async function sendPushToAdmins(supabase: any, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) {
    console.error("push: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configurados — aviso não enviado");
    return { sent: 0, failed: 0 };
  }
  try {
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (error) throw error;
    if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

    const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://www.arenaalcabeach.com.br";
    const mod: any = await import("web-push");
    const webpush = mod.default || mod;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || site, publicKey, privateKey);

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 60 * 60, urgency: "high" }
        )
      )
    );

    // Aparelho que desinstalou o app ou bloqueou os avisos: tira da lista.
    const gone: string[] = [];
    let sent = 0;
    results.forEach((r: any, i: number) => {
      if (r.status === "fulfilled") sent++;
      else if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) gone.push(subs[i].id);
      else console.error("push: falha ao enviar", r.reason?.statusCode, r.reason?.body || r.reason);
    });
    if (gone.length > 0) await supabase.from("push_subscriptions").delete().in("id", gone);
    return { sent, failed: results.length - sent };
  } catch (err) {
    console.error("push: erro ao enviar aviso", err);
    return { sent: 0, failed: 0 };
  }
}

const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function describeBooking(b: any): string {
  const [y, m, d] = String(b.date).split("-").map(Number);
  const weekday = WEEKDAYS_PT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] || "";
  const times = String(b.time).split(", ").filter(Boolean).sort();
  let range = times.join(", ");
  if (times.length > 0) {
    const [lh, lm] = times[times.length - 1].split(":").map(Number);
    const end = lh * 60 + lm + 30;
    range = `${times[0]} às ${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }
  return `${b.court_name} · ${weekday} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} · ${range}`;
}

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

type ConfirmResult = "confirmed" | "already" | "conflict" | "ignored";

// Confirma a reserva de um pagamento aprovado — só se o pagamento é dessa
// reserva, o valor pago cobre o valor devido e o horário continua livre.
// Quando confirma de fato, avisa o dono por notificação.
// CÓPIA IDÊNTICA em check-payment.ts, webhook-mp.ts e admin.ts: mude as três.
async function confirmBookingFromPayment(
  supabase: any,
  payment: any,
  opts: { notifyConflict: boolean } = { notifyConflict: true }
): Promise<ConfirmResult> {
  const bookingId = String(payment.external_reference || "");
  if (!bookingId) return "ignored";

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, court_id, court_name, date, time, name, phone, status, price, mp_payment_id, created_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return "ignored";
  if (booking.status === "confirmado") return "already";

  if (String(booking.mp_payment_id || "") !== String(payment.id)) {
    console.error(`Pagamento ${payment.id} não pertence ao booking ${bookingId} — ignorado`);
    return "ignored";
  }

  const paid = Number(payment.transaction_amount);
  const due = Number(booking.price);
  if (!Number.isFinite(paid) || !Number.isFinite(due) || due <= 0 || paid + 0.001 < due) {
    console.error(`Pagamento ${payment.id}: valor pago (${paid}) menor que o devido (${due}) — booking ${bookingId} NÃO confirmado`);
    return "ignored";
  }

  // O horário pode ter sido liberado pra outras pessoas: reserva cancelada
  // (cliente fechou a tela) ou pendente há mais de 30 min (o site trata como
  // abandonada). Nesses casos só confirma se ninguém pegou o horário.
  const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
  const createdMs = new Date(booking.created_at).getTime();
  const slotWasReleased =
    booking.status === "cancelado" || (Number.isFinite(createdMs) && createdMs < ttlCutoff);

  if (slotWasReleased) {
    const { data: others, error: othersErr } = await supabase
      .from("bookings")
      .select("id, time, status, created_at, monthly_subscriber_id")
      .eq("court_id", booking.court_id)
      .eq("date", booking.date)
      .neq("status", "cancelado")
      .neq("id", booking.id);
    if (othersErr) throw othersErr;
    const mine = new Set(String(booking.time).split(", "));
    const conflict = (others || []).some((row: any) => {
      if (row.status === "pendente" && !row.monthly_subscriber_id) {
        const otherMs = new Date(row.created_at).getTime();
        if (Number.isFinite(otherMs) && otherMs < ttlCutoff) return false;
      }
      return String(row.time).split(", ").some((t) => mine.has(t));
    });
    if (conflict) {
      console.error(`ATENÇÃO: pagamento ${payment.id} aprovado para o booking ${bookingId}, mas o horário já é de outra reserva — precisa de estorno manual`);
      if (opts.notifyConflict) {
        await sendPushToAdmins(supabase, {
          title: "⚠️ PIX pago sem horário",
          body: `${booking.name} (${booking.phone}) pagou ${formatBRL(paid)} — ${describeBooking(booking)}, mas o horário já estava ocupado. Devolva ou remarque.`,
          url: "/admin",
          tag: `conflito-${booking.id}`,
        });
      }
      return "conflict";
    }
  }

  // `.select` devolve as linhas alteradas: se o aviso do MP e a tela do
  // cliente chegarem juntos, só um dos dois confirma (e só um avisa o dono).
  const { data: updated, error: updErr } = await supabase
    .from("bookings")
    .update({ status: "confirmado" })
    .eq("id", booking.id)
    .eq("status", booking.status)
    .select("id");
  if (updErr) throw updErr;
  if (!updated || updated.length === 0) return "already";

  await sendPushToAdmins(supabase, {
    title: "✅ Nova reserva confirmada",
    body: `${describeBooking(booking)}\n${booking.name} · ${formatBRL(paid)}`,
    url: "/admin",
    tag: `reserva-${booking.id}`,
  });
  return "confirmed";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const paymentId = String(req.query.paymentId || "");

  // Só dígitos: esse valor entra na URL da API do Mercado Pago.
  if (!/^\d{1,20}$/.test(paymentId)) {
    return res.status(400).json({ error: "paymentId inválido" });
  }

  try {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${mpAccessToken}` } }
    );

    if (!mpResponse.ok) {
      return res.status(502).json({ error: "Erro ao consultar pagamento" });
    }

    const payment = await mpResponse.json();
    let status: string = payment.status;

    if (payment.status === "approved") {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      const result = await confirmBookingFromPayment(supabase, payment);

      // Só diz "approved" pro site se a reserva ficou mesmo confirmada.
      if (result !== "confirmed" && result !== "already") status = "paid_not_confirmed";
    }

    return res.status(200).json({ status, statusDetail: payment.status_detail });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
