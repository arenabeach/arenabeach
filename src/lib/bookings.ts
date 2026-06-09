import { supabase } from "./supabase";
import { getSessionToken } from "./auth";

// Janela de tempo (em minutos) em que um booking pendente continua bloqueando o slot.
// Depois disso ele é considerado abandonado (PIX já expirou no MP) e ignorado.
const PENDING_TTL_MINUTES = 30;

async function adminCall<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = getSessionToken();
  if (!token) {
    throw new Error("Sessão admin expirada. Faça login novamente.");
  }
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ op, args }),
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

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
  price?: number;
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
  price: row.price != null ? Number(row.price) : undefined,
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
      price: booking.price ?? null,
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
  await adminCall("updateBookingStatus", { id, status });
};

export const deleteBooking = async (id: string): Promise<void> => {
  await adminCall("deleteBooking", { id });
};

// Cancela um booking pendente sem precisar de sessão admin — usado pelo
// cliente público quando ele fecha o PIX. Não derruba bookings confirmados.
export const cancelPendingBooking = async (bookingId: string): Promise<void> => {
  const res = await fetch("/api/cancel-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) {
    throw new Error("Erro ao cancelar agendamento");
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

// Busca todos os horários ocupados de uma quadra em uma data (para evitar múltiplas queries).
// Pendentes velhos (PIX expirado) são ignorados — EXCETO mensalistas, que sempre bloqueiam.
export const getBookedSlots = async (
  courtId: string,
  date: string
): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("time, status, created_at, monthly_subscriber_id")
    .eq("court_id", courtId)
    .eq("date", date)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar slots ocupados:", error);
    return new Set();
  }

  const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
  const slots = new Set<string>();
  (data || []).forEach((row) => {
    // Pendente de PIX expira após o TTL; mensalista (mesmo pendente) nunca expira.
    if (row.status === "pendente" && !row.monthly_subscriber_id) {
      const createdMs = new Date(row.created_at as string).getTime();
      if (Number.isFinite(createdMs) && createdMs < ttlCutoff) return;
    }
    (row.time as string).split(", ").forEach((t) => slots.add(t));
  });
  return slots;
};

// Busca todos os horários ocupados de TODAS as quadras em uma data.
// Pendentes mais velhos que PENDING_TTL_MINUTES são considerados abandonados
// (o PIX do Mercado Pago já expirou) e não bloqueiam o slot.
// Mensalistas são exceção: mesmo pendentes (pagamento não confirmado) sempre
// bloqueiam o horário para o público, em qualquer mês futuro.
export const getAllBookedSlots = async (
  date: string
): Promise<Record<string, Set<string>>> => {
  const { data, error } = await supabase
    .from("bookings")
    .select("court_id, time, status, created_at, monthly_subscriber_id")
    .eq("date", date)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar slots:", error);
    return {};
  }

  const ttlCutoff = Date.now() - PENDING_TTL_MINUTES * 60 * 1000;
  const result: Record<string, Set<string>> = {};
  (data || []).forEach((row) => {
    // Pendente de PIX expira após o TTL; mensalista (mesmo pendente) nunca expira.
    if (row.status === "pendente" && !row.monthly_subscriber_id) {
      const createdMs = new Date(row.created_at as string).getTime();
      if (Number.isFinite(createdMs) && createdMs < ttlCutoff) return;
    }
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
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30",
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
  await adminCall("blockSlotRecurring", { courtId, time, reason });
};

// Desbloquear um horário permanente
export const unblockSlotRecurring = async (
  courtId: string,
  time: string
): Promise<void> => {
  await adminCall("unblockSlotRecurring", { courtId, time });
};

// Bloquear um slot
export const blockSlot = async (
  courtId: string,
  date: string,
  time: string,
  reason?: string
): Promise<void> => {
  await adminCall("blockSlot", { courtId, date, time, reason });
};

// Desbloquear um slot
export const unblockSlot = async (
  courtId: string,
  date: string,
  time: string
): Promise<void> => {
  await adminCall("unblockSlot", { courtId, date, time });
};

// Bloquear todos os horários de uma quadra em uma data
export const blockAllSlots = async (
  courtId: string,
  date: string,
  reason?: string
): Promise<void> => {
  await adminCall("blockAllSlots", { courtId, date, reason, times: timeSlots });
};

// Desbloquear todos os horários de uma quadra em uma data
export const unblockAllSlots = async (
  courtId: string,
  date: string
): Promise<void> => {
  await adminCall("unblockAllSlots", { courtId, date });
};

// Bloquear permanentemente todos os horários de uma quadra (todas as datas)
export const blockAllSlotsRecurring = async (
  courtId: string,
  reason?: string
): Promise<void> => {
  await adminCall("blockAllSlotsRecurring", { courtId, reason, times: timeSlots });
};

// Desbloquear todos os bloqueios permanentes de uma quadra
export const unblockAllSlotsRecurring = async (
  courtId: string
): Promise<void> => {
  await adminCall("unblockAllSlotsRecurring", { courtId });
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
  try {
    const { data } = await adminCall<{ data: Record<string, unknown>[] }>(
      "getMonthlySubscribers"
    );
    return (data || []).map(mapSubscriberRow);
  } catch (err) {
    console.error("Erro ao buscar mensalistas:", err);
    return [];
  }
};

export const addMonthlySubscriber = async (
  sub: Omit<MonthlySubscriber, "id" | "createdAt" | "active">
): Promise<MonthlySubscriber> => {
  const { data } = await adminCall<{ data: Record<string, unknown> }>(
    "addMonthlySubscriber",
    { sub }
  );
  return mapSubscriberRow(data);
};

export const deleteMonthlySubscriber = async (id: string): Promise<void> => {
  await adminCall("deleteMonthlySubscriber", { id });
};

// Encerra mensalista no fim do mês corrente: marca como inativo e remove
// agendamentos a partir do próximo mês (mantém os do mês atual).
export const endSubscriberAtMonthEnd = async (id: string): Promise<void> => {
  await adminCall("endSubscriberAtMonthEnd", { id });
};

// Garante que cada mensalista ativo tenha bookings gerados até `monthsAhead`
// meses à frente. Usado para auto-renovação ao abrir o painel admin.
// Retorna o total de bookings criados.
export const ensureSubscriberBookings = async (
  monthsAhead: number = 6
): Promise<number> => {
  const { totalCreated } = await adminCall<{ totalCreated: number }>(
    "ensureSubscriberBookings",
    { monthsAhead }
  );
  return totalCreated || 0;
};

// Cria booking vinculado a um mensalista (pula a flag de status pendente)
export const addBookingForSubscriber = async (
  booking: Omit<Booking, "id" | "createdAt" | "status">,
  subscriberId: string
): Promise<Booking> => {
  const { data } = await adminCall<{ data: Record<string, unknown> }>(
    "addBookingForSubscriber",
    { booking, subscriberId }
  );
  return mapRow(data);
};
