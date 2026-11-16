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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isValidSignature(req)) {
    console.error("webhook-mp: assinatura inválida ou ausente, notificação rejeitada");
    return res.status(401).send("Invalid signature");
  }

  try {
    const { type, data } = req.body;

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
