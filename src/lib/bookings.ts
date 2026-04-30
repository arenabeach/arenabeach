import { supabase } from "./supabase";

export const sports = ["Vôlei", "Beach Tennis", "Futevôlei", "Futebol Society"] as const;
export type Sport = typeof sports[number];

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  sport?: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  status: "pendente" | "confirmado" | "cancelado";
  createdAt: string;
  mpPaymentId?: string;
  monthlySubscriberId?: string;
}

// Map Supabase row to Booking interface
const mapRow = (row: Record<string, unknown>): Booking => ({
  id: row.id as string,
  courtId: row.court_id as string,
  courtName: row.court_name as string,
  sport: (row.sport as string) || undefined,
  date: row.date as string,
  time: row.time as string,
  name: row.name as string,
  phone: row.phone as string,
  status: row.status as Booking["status"],
  createdAt: row.created_at as string,
  mpPaymentId: (row.mp_payment_id as string) || undefined,
  monthlySubscriberId: (row.monthly_subscriber_id as string) || undefined,
});

export const getBookings = async (): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return [];
  }
  return (data || []).map(mapRow);
};

export const addBooking = async (
  booking: Omit<Booking, "id" | "createdAt" | "status">
): Promise<Booking> => {
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
      status: "pendente",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar agendamento:", error);
    throw new Error("Erro ao criar agendamento");
  }
  return mapRow(data);
};

export const updateBookingStatus = async (
  id: string,
  status: Booking["status"]
): Promise<void> => {
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar status:", error);
    throw new Error("Erro ao atualizar status");
  }
};

export const deleteBooking = async (id: string): Promise<void> => {
  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    console.error("Erro ao excluir agendamento:", error);
    throw new Error("Erro ao excluir agendamento");
  }
};

export const isTimeSlotBooked = async (
  courtId: string,
  date: string,
  time: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("time")
    .eq("court_id", courtId)
    .eq("date", date)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao verificar disponibilidade:", error);
    return false;
  }

  return (data || []).some((row) =>
    (row.time as string).split(", ").includes(time)
  );
};

// Busca todos os horários ocupados de uma quadra em uma data (para evitar múltiplas queries)
export const getBookedSlots = async (
  courtId: string,
  date: string
): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("time")
    .eq("court_id", courtId)
    .eq("date", date)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar slots ocupados:", error);
    return new Set();
  }

  const slots = new Set<string>();
  (data || []).forEach((row) => {
    (row.time as string).split(", ").forEach((t) => slots.add(t));
  });
  return slots;
};

// Busca todos os horários ocupados de TODAS as quadras em uma data
export const getAllBookedSlots = async (
  date: string
): Promise<Record<string, Set<string>>> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("court_id, time")
    .eq("date", date)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar slots:", error);
    return {};
  }

  const result: Record<string, Set<string>> = {};
  (data || []).forEach((row) => {
    const courtId = row.court_id as string;
    if (!result[courtId]) result[courtId] = new Set();
    (row.time as string).split(", ").forEach((t) => result[courtId].add(t));
  });
  return result;
};

export const courtNames: Record<string, string> = {
  "quadra-01": "Quadra 01",
  "quadra-02": "Quadra 02",
  "quadra-03": "Quadra 03",
  "quadra-04": "Quadra 04",
  "quadra-05": "Quadra 05",
  society: "Campo Society",
};

export const courtPrices: Record<string, string> = {
  "quadra-01": "R$ 45",
  "quadra-02": "R$ 45",
  "quadra-03": "R$ 45",
  "quadra-04": "R$ 45",
  "quadra-05": "R$ 45",
  society: "R$ 100",
};

export interface DurationOption {
  label: string;
  duration: string;
  price: string;
  slots: number;
}

export const societyDurations: DurationOption[] = [
  { label: "1 hora", duration: "1h", price: "R$ 100", slots: 1 },
  { label: "1 hora e 30 min", duration: "1:30h", price: "R$ 140", slots: 2 },
  { label: "2 horas", duration: "2h", price: "R$ 180", slots: 2 },
];

export const timeSlots = [
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30",
];

export const formatSlotRange = (time: string): string => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 30;
  const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const em = String(total % 60).padStart(2, "0");
  return `${time} - ${eh}:${em}`;
};

// =================== BLOCKED SLOTS ===================

export interface BlockedSlot {
  id: string;
  courtId: string;
  date: string;
  time: string;
  reason?: string;
  createdAt: string;
}

const mapBlockedRow = (row: Record<string, unknown>): BlockedSlot => ({
  id: row.id as string,
  courtId: row.court_id as string,
  date: row.date as string,
  time: row.time as string,
  reason: (row.reason as string) || undefined,
  createdAt: row.created_at as string,
});

// Busca todos os slots bloqueados de uma data (todas as quadras)
// Inclui bloqueios da data específica E bloqueios permanentes (recurring)
export const getBlockedSlots = async (
  date: string
): Promise<Record<string, Set<string>>> => {
  const [byDate, recurring] = await Promise.all([
    supabase.from("blocked_slots").select("court_id, time").eq("date", date),
    supabase.from("recurring_blocked_slots").select("court_id, time"),
  ]);

  const result: Record<string, Set<string>> = {};

  if (!byDate.error) {
    (byDate.data || []).forEach((row) => {
      const courtId = row.court_id as string;
      if (!result[courtId]) result[courtId] = new Set();
      result[courtId].add(row.time as string);
    });
  } else {
    console.error("Erro ao buscar slots bloqueados:", byDate.error);
  }

  if (!recurring.error) {
    (recurring.data || []).forEach((row) => {
      const courtId = row.court_id as string;
      if (!result[courtId]) result[courtId] = new Set();
      result[courtId].add(row.time as string);
    });
  } else {
    console.error("Erro ao buscar bloqueios permanentes:", recurring.error);
  }

  return result;
};

// Busca apenas os bloqueios permanentes (todas as quadras)
export const getRecurringBlockedSlots = async (): Promise<Record<string, Set<string>>> => {
  const { data, error } = await supabase
    .from("recurring_blocked_slots")
    .select("court_id, time");

  if (error) {
    console.error("Erro ao buscar bloqueios permanentes:", error);
    return {};
  }

  const result: Record<string, Set<string>> = {};
  (data || []).forEach((row) => {
    const courtId = row.court_id as string;
    if (!result[courtId]) result[courtId] = new Set();
    result[courtId].add(row.time as string);
  });
  return result;
};

// Bloquear um horário permanentemente (em todos os dias)
export const blockSlotRecurring = async (
  courtId: string,
  time: string,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from("recurring_blocked_slots")
    .insert({ court_id: courtId, time, reason: reason || null });

  if (error) {
    console.error("Erro ao bloquear permanentemente:", error);
    throw new Error("Erro ao bloquear horário permanentemente");
  }
};

// Desbloquear um horário permanente
export const unblockSlotRecurring = async (
  courtId: string,
  time: string
): Promise<void> => {
  const { error } = await supabase
    .from("recurring_blocked_slots")
    .delete()
    .eq("court_id", courtId)
    .eq("time", time);

  if (error) {
    console.error("Erro ao desbloquear permanente:", error);
    throw new Error("Erro ao desbloquear horário permanente");
  }
};

// Bloquear um slot
export const blockSlot = async (
  courtId: string,
  date: string,
  time: string,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from("blocked_slots")
    .insert({
      court_id: courtId,
      date,
      time,
      reason: reason || null,
    });

  if (error) {
    console.error("Erro ao bloquear slot:", error);
    throw new Error("Erro ao bloquear horário");
  }
};

// Desbloquear um slot
export const unblockSlot = async (
  courtId: string,
  date: string,
  time: string
): Promise<void> => {
  const { error } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("court_id", courtId)
    .eq("date", date)
    .eq("time", time);

  if (error) {
    console.error("Erro ao desbloquear slot:", error);
    throw new Error("Erro ao desbloquear horário");
  }
};

// Bloquear todos os horários de uma quadra em uma data
export const blockAllSlots = async (
  courtId: string,
  date: string,
  reason?: string
): Promise<void> => {
  const rows = timeSlots.map((time) => ({
    court_id: courtId,
    date,
    time,
    reason: reason || null,
  }));

  const { error } = await supabase
    .from("blocked_slots")
    .upsert(rows, { onConflict: "court_id,date,time" });

  if (error) {
    console.error("Erro ao bloquear todos os slots:", error);
    throw new Error("Erro ao bloquear todos os horários");
  }
};

// Desbloquear todos os horários de uma quadra em uma data
export const unblockAllSlots = async (
  courtId: string,
  date: string
): Promise<void> => {
  const { error } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("court_id", courtId)
    .eq("date", date);

  if (error) {
    console.error("Erro ao desbloquear todos os slots:", error);
    throw new Error("Erro ao desbloquear todos os horários");
  }
};

// Bloquear permanentemente todos os horários de uma quadra (todas as datas)
export const blockAllSlotsRecurring = async (
  courtId: string,
  reason?: string
): Promise<void> => {
  // Limpa os bloqueios permanentes existentes desta quadra e reinsere todos
  const { error: delError } = await supabase
    .from("recurring_blocked_slots")
    .delete()
    .eq("court_id", courtId);

  if (delError) {
    console.error("Erro ao limpar bloqueios permanentes:", delError);
    throw new Error("Erro ao bloquear todos permanentemente");
  }

  const rows = timeSlots.map((time) => ({
    court_id: courtId,
    time,
    reason: reason || null,
  }));

  const { error } = await supabase.from("recurring_blocked_slots").insert(rows);

  if (error) {
    console.error("Erro ao bloquear todos permanente:", error);
    throw new Error("Erro ao bloquear todos permanentemente");
  }
};

// Desbloquear todos os bloqueios permanentes de uma quadra
export const unblockAllSlotsRecurring = async (
  courtId: string
): Promise<void> => {
  const { error } = await supabase
    .from("recurring_blocked_slots")
    .delete()
    .eq("court_id", courtId);

  if (error) {
    console.error("Erro ao desbloquear todos permanente:", error);
    throw new Error("Erro ao desbloquear todos permanentemente");
  }
};

// =================== MONTHLY SUBSCRIBERS (MENSALISTAS) ===================

export interface MonthlySubscriber {
  id: string;
  name: string;
  phone: string;
  courtId: string;
  courtName: string;
  sport?: string;
  weekdays: number[];
  times: string[];
  month: string;
  price: number;
  active: boolean;
  createdAt: string;
}

const mapSubscriberRow = (row: Record<string, unknown>): MonthlySubscriber => ({
  id: row.id as string,
  name: row.name as string,
  phone: row.phone as string,
  courtId: row.court_id as string,
  courtName: row.court_name as string,
  sport: (row.sport as string) || undefined,
  weekdays: (row.weekdays as number[]) || [],
  times: (row.times as string[]) || [],
  month: row.month as string,
  price: Number(row.price) || 0,
  active: row.active as boolean,
  createdAt: row.created_at as string,
});

export const getMonthlySubscribers = async (): Promise<MonthlySubscriber[]> => {
  const { data, error } = await supabase
    .from("monthly_subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar mensalistas:", error);
    return [];
  }
  return (data || []).map(mapSubscriberRow);
};

export const addMonthlySubscriber = async (
  sub: Omit<MonthlySubscriber, "id" | "createdAt" | "active">
): Promise<MonthlySubscriber> => {
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

  if (error) {
    console.error("Erro ao criar mensalista:", error);
    throw new Error("Erro ao criar mensalista");
  }
  return mapSubscriberRow(data);
};

export const deleteMonthlySubscriber = async (id: string): Promise<void> => {
  // Excluir os agendamentos vinculados primeiro
  const { error: bookingsError } = await supabase
    .from("bookings")
    .delete()
    .eq("monthly_subscriber_id", id);

  if (bookingsError) {
    console.error("Erro ao excluir agendamentos do mensalista:", bookingsError);
    throw new Error("Erro ao excluir agendamentos do mensalista");
  }

  const { error } = await supabase
    .from("monthly_subscribers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir mensalista:", error);
    throw new Error("Erro ao excluir mensalista");
  }
};

// Encerra mensalista no fim do mês corrente: marca como inativo e remove
// agendamentos a partir do próximo mês (mantém os do mês atual).
export const endSubscriberAtMonthEnd = async (id: string): Promise<void> => {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const y = endOfMonth.getFullYear();
  const m = String(endOfMonth.getMonth() + 1).padStart(2, "0");
  const d = String(endOfMonth.getDate()).padStart(2, "0");
  const endOfMonthStr = `${y}-${m}-${d}`;

  const { error: subErr } = await supabase
    .from("monthly_subscribers")
    .update({ active: false })
    .eq("id", id);

  if (subErr) {
    console.error("Erro ao desativar mensalista:", subErr);
    throw new Error("Erro ao desativar mensalista");
  }

  const { error: bkErr } = await supabase
    .from("bookings")
    .delete()
    .eq("monthly_subscriber_id", id)
    .gt("date", endOfMonthStr);

  if (bkErr) {
    console.error("Erro ao remover agendamentos futuros:", bkErr);
    throw new Error("Erro ao remover agendamentos futuros");
  }
};

// Garante que cada mensalista ativo tenha bookings gerados até `monthsAhead`
// meses à frente. Usado para auto-renovação ao abrir o painel admin.
// Retorna o total de bookings criados.
export const ensureSubscriberBookings = async (
  monthsAhead: number = 6
): Promise<number> => {
  const subs = await getMonthlySubscribers();
  const active = subs.filter((s) => s.active);
  if (active.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetEnd = new Date(today);
  targetEnd.setMonth(targetEnd.getMonth() + monthsAhead);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let totalCreated = 0;

  for (const sub of active) {
    const { data: existing } = await supabase
      .from("bookings")
      .select("date")
      .eq("monthly_subscriber_id", sub.id);

    const existingDates = new Set((existing || []).map((r) => r.date as string));

    const [yearStr, monthStr] = sub.month.split("-");
    const startOfStartMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
    const cursor = new Date(Math.max(today.getTime(), startOfStartMonth.getTime()));
    cursor.setHours(0, 0, 0, 0);

    const timeDisplay = sub.times.join(", ");
    const rows: Record<string, unknown>[] = [];

    while (cursor.getTime() <= targetEnd.getTime()) {
      const weekday = cursor.getDay();
      if (sub.weekdays.includes(weekday)) {
        const dateStr = fmt(cursor);
        if (!existingDates.has(dateStr)) {
          rows.push({
            court_id: sub.courtId,
            court_name: sub.courtName,
            sport: sub.sport || null,
            date: dateStr,
            time: timeDisplay,
            name: sub.name,
            phone: sub.phone,
            status: "confirmado",
            monthly_subscriber_id: sub.id,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("bookings").insert(rows);
      if (error) {
        console.error(`Erro ao renovar mensalista ${sub.id}:`, error);
      } else {
        totalCreated += rows.length;
      }
    }
  }

  return totalCreated;
};

// Cria booking vinculado a um mensalista (pula a flag de status pendente)
export const addBookingForSubscriber = async (
  booking: Omit<Booking, "id" | "createdAt" | "status">,
  subscriberId: string
): Promise<Booking> => {
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

  if (error) {
    console.error("Erro ao criar agendamento de mensalista:", error);
    throw new Error("Erro ao criar agendamento de mensalista");
  }
  return mapRow(data);
};
