export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

  try {
    const { bookingId, amount, description, payerEmail } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ error: "bookingId e amount são obrigatórios" });
    }

    if (!mpAccessToken) {
      console.error("ENV check - MERCADO_PAGO_ACCESS_TOKEN existe:", !!process.env.MERCADO_PAGO_ACCESS_TOKEN);
      return res.status(500).json({ error: "MERCADO_PAGO_ACCESS_TOKEN não configurado" });
    }

    // Criar cobrança PIX no Mercado Pago
    const idempotencyKey = `pix-${bookingId}-${Date.now()}`;
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: description || "Agendamento Arena Beach",
        payment_method_id: "pix",
        external_reference: bookingId,
        payer: {
          email: payerEmail || "cliente@arenabeach.com",
        },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro Mercado Pago:", mpData);
      return res.status(500).json({
        error: "Erro ao criar cobrança PIX",
        details: mpData.message || mpData,
      });
    }

    // Salvar o ID do pagamento MP no booking
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase
      .from("bookings")
      .update({ mp_payment_id: String(mpData.id) })
      .eq("id", bookingId);

    // Retornar dados do QR Code
    const pixData = mpData.point_of_interaction?.transaction_data;
    return res.status(200).json({
      paymentId: mpData.id,
      qrCode: pixData?.qr_code || "",
      qrCodeBase64: pixData?.qr_code_base64 || "",
      ticketUrl: pixData?.ticket_url || "",
      expiresAt: mpData.date_of_expiration,
    });
  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
