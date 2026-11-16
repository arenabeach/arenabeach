// Devolve só os horários ocupados por quadra numa data — sem nome nem telefone
// de ninguém. O site público usa isso no lugar de ler a tabela `bookings`
// direto, pra que a tabela possa ficar fechada pro acesso anônimo.

const PENDING_TTL_MINUTES = 30;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  const date = String(req.query?.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date inválida" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("bookings")
      .select("court_id, time, status, created_at, monthly_subscriber_id")
      .eq("date", date)
      .neq("status", "cancelado");
    if (error) throw error;

    // Pendente de PIX expira após o TTL; mensalista (mesmo pendente) nunca expira.
    const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
    const booked: Record<string, string[]> = {};
    for (const row of data || []) {
      if (row.status === "pendente" && !row.monthly_subscriber_id) {
        const createdMs = new Date(row.created_at).getTime();
        if (Number.isFinite(createdMs) && createdMs < ttlCutoff) continue;
      }
      const list = (booked[row.court_id] ||= []);
      for (const t of String(row.time).split(", ")) {
        if (!list.includes(t)) list.push(t);
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ booked });
  } catch (error) {
    console.error("availability erro:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
