export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const paymentId = req.query.paymentId;

  if (!paymentId) {
    return res.status(400).json({ error: "paymentId é obrigatório" });
  }

  try {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      }
    );

    if (!mpResponse.ok) {
      return res.status(500).json({ error: "Erro ao consultar pagamento" });
    }

    const payment = await mpResponse.json();

    // Se pagamento aprovado, confirmar o booking automaticamente
    if (payment.status === "approved" && payment.external_reference) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from("bookings")
        .update({ status: "confirmado" })
        .eq("id", payment.external_reference);
    }

    return res.status(200).json({
      status: payment.status,
      statusDetail: payment.status_detail,
    });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
