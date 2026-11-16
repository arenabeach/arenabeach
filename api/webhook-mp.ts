import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";

// Valida a assinatura do Mercado Pago (header x-signature) conforme o algoritmo
// documentado em https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
// Sem isso, qualquer pessoa poderia forjar um POST pra esse endpoint e marcar
// um booking como "confirmado" sem pagar nada.
function isValidSignature(req: any): boolean {
  if (!webhookSecret) {
    console.error("webhook-mp: MERCADO_PAGO_WEBHOOK_SECRET não configurado — rejeitando notificação");
    return false;
  }

  const xSignature = String(req.headers["x-signature"] || "");
  const xRequestId = String(req.headers["x-request-id"] || "");
  if (!xSignature || !xRequestId) return false;

  let ts = "";
  let hash = "";
  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "ts") ts = value;
    if (key === "v1") hash = value;
  }
  if (!ts || !hash) return false;

  // O data.id usado no manifest vem da query string da URL da notificação,
  // não do corpo do JSON.
  const dataId = String(req.query?.["data.id"] || req.query?.["data_id"] || "");
  if (!dataId) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedHash = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expectedHash);
  const hashBuf = Buffer.from(hash);
  if (expectedBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, hashBuf);
}

const PENDING_TTL_MINUTES = 30;

// Confirma a reserva de um pagamento aprovado — só se o valor pago cobre o
// valor da reserva e o horário continua livre. (Mesma lógica em check-payment.ts;
// se mudar aqui, mude lá.)
async function confirmBookingFromPayment(supabase: any, payment: any): Promise<void> {
  const bookingId = String(payment.external_reference || "");
  if (!bookingId) return;

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, court_id, date, time, status, price, mp_payment_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking || booking.status === "confirmado") return;

  if (String(booking.mp_payment_id || "") !== String(payment.id)) {
    console.error(`Pagamento ${payment.id} não pertence ao booking ${bookingId} — ignorado`);
    return;
  }

  const paid = Number(payment.transaction_amount);
  const due = Number(booking.price);
  if (!Number.isFinite(paid) || !Number.isFinite(due) || due <= 0 || paid + 0.001 < due) {
    console.error(`Pagamento ${payment.id}: valor pago (${paid}) menor que o devido (${due}) — booking ${bookingId} NÃO confirmado`);
    return;
  }

  // Se a reserva foi cancelada (cliente fechou a tela e pagou depois), só volta
  // a valer se ninguém pegou o horário nesse meio-tempo.
  if (booking.status === "cancelado") {
    const { data: others, error: othersErr } = await supabase
      .from("bookings")
      .select("id, time, status, created_at, monthly_subscriber_id")
      .eq("court_id", booking.court_id)
      .eq("date", booking.date)
      .neq("status", "cancelado")
      .neq("id", booking.id);
    if (othersErr) throw othersErr;
    const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
    const mine = new Set(String(booking.time).split(", "));
    const conflict = (others || []).some((row: any) => {
      if (row.status === "pendente" && !row.monthly_subscriber_id) {
        const createdMs = new Date(row.created_at).getTime();
        if (Number.isFinite(createdMs) && createdMs < ttlCutoff) return false;
      }
      return String(row.time).split(", ").some((t) => mine.has(t));
    });
    if (conflict) {
      console.error(`ATENÇÃO: pagamento ${payment.id} aprovado para booking ${bookingId} já cancelado e com horário ocupado por outra reserva — precisa de estorno manual`);
      return;
    }
  }

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ status: "confirmado" })
    .eq("id", booking.id)
    .eq("status", booking.status);
  if (updErr) throw updErr;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isValidSignature(req)) {
    console.error("webhook-mp: assinatura inválida ou ausente, notificação rejeitada");
    return res.status(401).send("Invalid signature");
  }

  try {
    const { type, data } = req.body || {};

    if (type === "payment" && data?.id && /^\d{1,20}$/.test(String(data.id))) {
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
      );

      if (!mpResponse.ok) {
        // 5xx faz o Mercado Pago reenviar a notificação mais tarde — com 200 a
        // confirmação se perdia de vez.
        console.error("Erro ao buscar pagamento:", await mpResponse.text());
        return res.status(502).send("Erro ao consultar pagamento");
      }

      const payment = await mpResponse.json();

      if (payment.status === "approved") {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await confirmBookingFromPayment(supabase, payment);
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    // Erro nosso (banco fora, etc.): pede reenvio em vez de engolir.
    console.error("Erro no webhook:", error);
    return res.status(500).send("Erro interno");
  }
}
