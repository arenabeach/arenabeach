import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_SECRET = process.env.ADMIN_TOKEN_SECRET || "";

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
      case "updateBookingStatus": {
        const { id, status } = args;
        if (!id || !status) return res.status(400).json({ error: "id e status são obrigatórios" });
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
