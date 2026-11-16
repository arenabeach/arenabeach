const PENDING_TTL_MINUTES = 30;

// Confirma a reserva de um pagamento aprovado — só se o valor pago cobre o
// valor da reserva e o horário continua livre. (Mesma lógica em webhook-mp.ts;
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
      await confirmBookingFromPayment(supabase, payment);

      // Só diz "approved" pro site se a reserva ficou mesmo confirmada.
      const { data: after } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", String(payment.external_reference || ""))
        .maybeSingle();
      if (after?.status !== "confirmado") status = "paid_not_confirmed";
    }

    return res.status(200).json({ status, statusDetail: payment.status_detail });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
