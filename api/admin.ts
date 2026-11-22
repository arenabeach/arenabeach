import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_SECRET = process.env.ADMIN_TOKEN_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyAdminToken(token: string): boolean {
  if (!ADMIN_SECRET || !token) return false;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return false;
  const expiresStr = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(expiresStr).digest("hex");
  return timingSafeStringEqual(sig, expected);
}

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

type PaidConflict = {
  id: string;
  name: string;
  phone: string;
  courtName: string;
  date: string;
  time: string;
  amount: number;
};

// Rede de segurança caso o aviso do Mercado Pago não chegue: confere no MP as
// reservas avulsas que passaram dos 30 min ainda pendentes e têm PIX gerado.
// Pago → confirma. PIX cancelado/expirado/recusado → marca como cancelada.
// Pago mas o horário já foi de outra pessoa → devolve em `paidConflicts`
// pro painel avisar que precisa devolver o dinheiro.
async function reconcilePendingPayments(supabase: any): Promise<PaidConflict[]> {
  if (!MP_ACCESS_TOKEN) return [];
  const ttlCutoff = new Date(Date.now() - PENDING_TTL_MINUTES * 60 * 1000).toISOString();
  const oldest = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("bookings")
    .select("id, name, phone, court_name, date, time, mp_payment_id")
    .eq("status", "pendente")
    .is("monthly_subscriber_id", null)
    .not("mp_payment_id", "is", null)
    .lt("created_at", ttlCutoff)
    .gt("created_at", oldest)
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) throw error;

  const conflicts: PaidConflict[] = [];
  for (const b of stale || []) {
    const paymentId = String(b.mp_payment_id);
    if (!/^\d{1,20}$/.test(paymentId)) continue;
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!r.ok) continue;
    const payment = await r.json();

    if (payment.status === "approved") {
      const result = await confirmBookingFromPayment(supabase, payment, { notifyConflict: false });
      if (result === "conflict") {
        conflicts.push({
          id: b.id,
          name: b.name,
          phone: b.phone,
          courtName: b.court_name,
          date: b.date,
          time: b.time,
          amount: Number(payment.transaction_amount) || 0,
        });
      }
    } else if (["cancelled", "rejected", "refunded", "charged_back"].includes(payment.status)) {
      await supabase
        .from("bookings")
        .update({ status: "cancelado" })
        .eq("id", b.id)
        .eq("status", "pendente");
    }
  }
  return conflicts;
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_SECRET) {
    console.error("admin: variáveis SUPABASE_URL/SERVICE_KEY/ADMIN_TOKEN_SECRET não configuradas");
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  const token = String(req.headers["x-admin-token"] || "");
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Sessão expirada ou inválida" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const op = String(body?.op || "");
  const args = body?.args || {};

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    switch (op) {
      case "getBookings": {
        // Antes de listar, resolve reservas pagas que ficaram presas em "pendente".
        let paidConflicts: PaidConflict[] = [];
        try {
          paidConflicts = await reconcilePendingPayments(supabase);
        } catch (err) {
          console.error("admin: erro ao conferir pagamentos pendentes:", err);
        }
        // O Supabase devolve no máximo 1000 linhas por consulta — busca em páginas.
        const PAGE = 1000;
        const all: any[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < PAGE) break;
        }
        return res.status(200).json({ data: all, paidConflicts });
      }

      case "addManualBooking": {
        const { booking } = args;
        if (!booking?.courtId || !booking?.date || !booking?.time || !booking?.name || !booking?.phone) {
          return res.status(400).json({ error: "Dados do agendamento incompletos" });
        }
        const price = booking.price == null ? null : Number(booking.price);
        if (price !== null && (!Number.isFinite(price) || price < 0)) {
          return res.status(400).json({ error: "Valor inválido" });
        }
        const { data, error } = await supabase
          .from("bookings")
          .insert({
            court_id: booking.courtId,
            court_name: booking.courtName,
            sport: booking.sport || null,
            date: booking.date,
            time: booking.time,
            name: booking.name,
            phone: booking.phone,
            status: "confirmado",
            price,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      case "updateBookingStatus": {
        const { id, status } = args;
        if (!id || !status) return res.status(400).json({ error: "id e status são obrigatórios" });
        if (!["pendente", "confirmado", "cancelado"].includes(status)) {
          return res.status(400).json({ error: "status inválido" });
        }
        const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "deleteBooking": {
        const { id } = args;
        if (!id) return res.status(400).json({ error: "id é obrigatório" });
        const { error } = await supabase.from("bookings").delete().eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "addBookingForSubscriber": {
        const { booking, subscriberId } = args;
        if (!booking || !subscriberId) return res.status(400).json({ error: "booking e subscriberId obrigatórios" });
        const { data, error } = await supabase
          .from("bookings")
          .insert({
            court_id: booking.courtId,
            court_name: booking.courtName,
            sport: booking.sport || null,
            date: booking.date,
            time: booking.time,
            name: booking.name,
            phone: booking.phone,
            status: "confirmado",
            monthly_subscriber_id: subscriberId,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      case "blockSlot": {
        const { courtId, date, time, reason } = args;
        const { error } = await supabase
          .from("blocked_slots")
          .insert({ court_id: courtId, date, time, reason: reason || null });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "unblockSlot": {
        const { courtId, date, time } = args;
        const { error } = await supabase
          .from("blocked_slots")
          .delete()
          .eq("court_id", courtId)
          .eq("date", date)
          .eq("time", time);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "blockAllSlots": {
        const { courtId, date, reason, times } = args;
        if (!Array.isArray(times)) return res.status(400).json({ error: "times deve ser array" });
        const rows = times.map((time: string) => ({
          court_id: courtId,
          date,
          time,
          reason: reason || null,
        }));
        const { error } = await supabase
          .from("blocked_slots")
          .upsert(rows, { onConflict: "court_id,date,time" });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "unblockAllSlots": {
        const { courtId, date } = args;
        const { error } = await supabase
          .from("blocked_slots")
          .delete()
          .eq("court_id", courtId)
          .eq("date", date);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "blockSlotRecurring": {
        const { courtId, time, reason } = args;
        const { error } = await supabase
          .from("recurring_blocked_slots")
          .insert({ court_id: courtId, time, reason: reason || null });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "unblockSlotRecurring": {
        const { courtId, time } = args;
        const { error } = await supabase
          .from("recurring_blocked_slots")
          .delete()
          .eq("court_id", courtId)
          .eq("time", time);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "blockAllSlotsRecurring": {
        const { courtId, reason, times } = args;
        if (!Array.isArray(times)) return res.status(400).json({ error: "times deve ser array" });
        const { error: delError } = await supabase
          .from("recurring_blocked_slots")
          .delete()
          .eq("court_id", courtId);
        if (delError) throw delError;
        const rows = times.map((time: string) => ({
          court_id: courtId,
          time,
          reason: reason || null,
        }));
        const { error } = await supabase.from("recurring_blocked_slots").insert(rows);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "unblockAllSlotsRecurring": {
        const { courtId } = args;
        const { error } = await supabase
          .from("recurring_blocked_slots")
          .delete()
          .eq("court_id", courtId);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "getPushPublicKey": {
        return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
      }

      case "savePushSubscription": {
        const sub = args.subscription || {};
        const endpoint = String(sub.endpoint || "");
        const p256dh = String(sub.keys?.p256dh || "");
        const auth = String(sub.keys?.auth || "");
        if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
          return res.status(400).json({ error: "Inscrição de notificação inválida" });
        }
        const label = String(args.label || "").slice(0, 120) || null;
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert({ endpoint, p256dh, auth, label }, { onConflict: "endpoint" });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "removePushSubscription": {
        const endpoint = String(args.endpoint || "");
        if (!endpoint) return res.status(400).json({ error: "endpoint é obrigatório" });
        const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "testPush": {
        const { count } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true });
        const result = await sendPushToAdmins(supabase, {
          title: "🔔 Teste de aviso",
          body: "Funcionando! Você vai receber um aviso assim a cada reserva paga.",
          url: "/admin",
          tag: "teste",
        });
        return res.status(200).json({ ...result, devices: count || 0 });
      }

      case "getMonthlySubscribers": {
        const { data, error } = await supabase
          .from("monthly_subscribers")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      case "addMonthlySubscriber": {
        const { sub } = args;
        if (!sub) return res.status(400).json({ error: "sub é obrigatório" });
        const { data, error } = await supabase
          .from("monthly_subscribers")
          .insert({
            name: sub.name,
            phone: sub.phone,
            court_id: sub.courtId,
            court_name: sub.courtName,
            sport: sub.sport || null,
            weekdays: sub.weekdays,
            times: sub.times,
            month: sub.month,
            price: sub.price,
            active: true,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      case "deleteMonthlySubscriber": {
        const { id } = args;
        if (!id) return res.status(400).json({ error: "id é obrigatório" });
        const { error: bkErr } = await supabase
          .from("bookings")
          .delete()
          .eq("monthly_subscriber_id", id);
        if (bkErr) throw bkErr;
        const { error } = await supabase
          .from("monthly_subscribers")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case "endSubscriberAtMonthEnd": {
        const { id } = args;
        if (!id) return res.status(400).json({ error: "id é obrigatório" });
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const endStr = fmt(endOfMonth);
        const { error: subErr } = await supabase
          .from("monthly_subscribers")
          .update({ active: false })
          .eq("id", id);
        if (subErr) throw subErr;
        const { error: bkErr } = await supabase
          .from("bookings")
          .delete()
          .eq("monthly_subscriber_id", id)
          .gt("date", endStr);
        if (bkErr) throw bkErr;
        return res.status(200).json({ ok: true });
      }

      case "ensureSubscriberBookings": {
        const monthsAhead = Number(args.monthsAhead) || 6;
        const { data: subs, error: subErr } = await supabase
          .from("monthly_subscribers")
          .select("*")
          .eq("active", true);
        if (subErr) throw subErr;
        const active = subs || [];
        if (active.length === 0) return res.status(200).json({ totalCreated: 0 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetEnd = new Date(today);
        targetEnd.setMonth(targetEnd.getMonth() + monthsAhead);

        let totalCreated = 0;
        for (const sub of active) {
          const { data: existing } = await supabase
            .from("bookings")
            .select("date")
            .eq("monthly_subscriber_id", sub.id);
          const existingDates = new Set((existing || []).map((r: any) => r.date as string));

          const [yearStr, monthStr] = String(sub.month).split("-");
          const startOfStartMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
          const cursor = new Date(Math.max(today.getTime(), startOfStartMonth.getTime()));
          cursor.setHours(0, 0, 0, 0);

          const timeDisplay = (sub.times || []).join(", ");
          const rows: Record<string, unknown>[] = [];
          while (cursor.getTime() <= targetEnd.getTime()) {
            const weekday = cursor.getDay();
            if ((sub.weekdays || []).includes(weekday)) {
              const dateStr = fmt(cursor);
              if (!existingDates.has(dateStr)) {
                rows.push({
                  court_id: sub.court_id,
                  court_name: sub.court_name,
                  sport: sub.sport || null,
                  date: dateStr,
                  time: timeDisplay,
                  name: sub.name,
                  phone: sub.phone,
                  status: "pendente",
                  monthly_subscriber_id: sub.id,
                });
              }
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          if (rows.length > 0) {
            const { error } = await supabase.from("bookings").insert(rows);
            if (!error) totalCreated += rows.length;
            else console.error(`Erro ao renovar mensalista ${sub.id}:`, error);
          }
        }
        return res.status(200).json({ totalCreated });
      }

      default:
        return res.status(400).json({ error: `Operação desconhecida: ${op}` });
    }
  } catch (err: any) {
    console.error("admin op error:", op, err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
