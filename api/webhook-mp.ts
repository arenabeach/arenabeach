import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, data, action } = req.body;

    // Mercado Pago envia notificações de pagamento
    if (type === "payment" && data?.id) {
      // Buscar detalhes do pagamento no Mercado Pago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        {
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
          },
        }
      );

      if (!mpResponse.ok) {
        console.error("Erro ao buscar pagamento:", await mpResponse.text());
        return res.status(200).send("OK");
      }

      const payment = await mpResponse.json();

      // Se o pagamento foi aprovado, atualizar o booking
      if (payment.status === "approved") {
        const bookingId = payment.external_reference;

        if (bookingId) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error } = await supabase
            .from("bookings")
            .update({ status: "confirmado" })
            .eq("id", bookingId);

          if (error) {
            console.error("Erro ao atualizar booking:", error);
          } else {
            console.log(`Booking ${bookingId} confirmado via PIX`);
          }
        }
      }
    }

    // Sempre retornar 200 para o Mercado Pago não reenviar
    return res.status(200).send("OK");
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.status(200).send("OK");
  }
}
