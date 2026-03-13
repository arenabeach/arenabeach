const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    return res.status(200).json({
      status: payment.status,
      statusDetail: payment.status_detail,
    });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
