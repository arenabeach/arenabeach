const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const bookingId = String(body?.bookingId || "");
  if (!bookingId) {
    return res.status(400).json({ error: "bookingId é obrigatório" });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Só cancela se ainda estiver pendente — não derruba booking confirmado por pagamento.
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelado" })
    .eq("id", bookingId)
    .eq("status", "pendente");

  if (error) {
    console.error("Erro ao cancelar booking:", error);
    return res.status(500).json({ error: "Erro ao cancelar" });
  }

  return res.status(200).json({ ok: true });
}
