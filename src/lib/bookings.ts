import { supabase } from "./supabase";
import { getSessionToken } from "./auth";

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

export const sports = ["Vôlei", "Beach Tennis", "Futevôlei", "Futebol Society", "Tênis"] as const;
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

// Reserva paga pelo PIX cujo horário já tinha sido pego por outra pessoa:
// o dinheiro entrou, mas a reserva não pôde ser confirmada (precisa devolver).
export interface PaidConflict {
  id: string;
  name: string;
  phone: string;
  courtName: string;
  date: string;
  time: string;
  amount: number;
}

// Lista completa (com nome/telefone) — só para o admin, via rota autenticada.
// O servidor aproveita a chamada pra conferir no Mercado Pago as reservas
// pagas que ficaram presas em "pendente".
export const getAdminBookings = async (): Promise<{
  bookings: Booking[];
  paidConflicts: PaidConflict[];
}> => {
  const { data, paidConflicts } = await adminCall<{
    data: Record<string, unknown>[];
    paidConflicts?: PaidConflict[];
  }>("getBookings");
  return { bookings: (data || []).map(mapRow), paidConflicts: paidConflicts || [] };
};

export const getBookings = async (): Promise<Booking[]> =>
  (await getAdminBookings()).bookings;

// Agendamento avulso criado pelo admin: já entra confirmado.
export const addManualBooking = async (
  booking: Omit<Booking, "id" | "createdAt" | "status">
): Promise<Booking> => {
  const { data } = await adminCall<{ data: Record<string, unknown> }>(
    "addManualBooking",
    { booking }
  );
  return mapRow(data);
};

export interface PixBookingResult {
  bookingId: string;
  amount: number;
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: string;
}

// Reserva pública: o servidor valida disponibilidade, calcula o valor, cria o
// booking pendente e a cobrança PIX. O navegador nunca manda o preço.
export const createBookingWithPix = async (input: {
  courtId: string;
  date: string;
  times: string[];
  name: string;
  phone: string;
  sport?: string;
}): Promise<PixBookingResult> => {
  const res = await fetch("/api/create-pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    throw new Error((data.error as string) || "Erro ao gerar PIX. Tente novamente.");
  }
  return data as unknown as PixBookingResult;
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

// Horários ocupados de TODAS as quadras em uma data. Vem de /api/availability,
// que já aplica a regra do TTL de pendentes e não expõe dados de clientes.
export const getAllBookedSlots = async (
  date: string
): Promise<Record<string, Set<string>>> => {
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error("Erro ao buscar disponibilidade");
  const { booked } = (await res.json()) as { booked: Record<string, string[]> };
  const result: Record<string, Set<string>> = {};
  Object.entries(booked || {}).forEach(([courtId, times]) => {
    result[courtId] = new Set(times);
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
  tenis: "Quadra de Tênis",
};

export const courtPrices: Record<string, string> = {
  "quadra-01": "R$ 45",
  "quadra-02": "R$ 45",
  "quadra-03": "R$ 45",
  "quadra-04": "R$ 45",
  "quadra-05": "R$ 45",
  society: "R$ 100",
};

// =================== QUADRA DE TÊNIS (preço varia por horário) ===================
// 05:00 às 18:00 = R$ 50/hora · 18:00 às 23:00 = R$ 70/hora
export const TENIS_DAY_RATE_PER_HOUR = 50;
export const TENIS_NIGHT_RATE_PER_HOUR = 70;
const TENIS_NIGHT_START_MIN = 18 * 60; // 18:00

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Soma o preço de uma lista de horários (slots de 30min) de Tênis, aplicando
// a tarifa diurna (até 18h) ou noturna (18h-23h) de acordo com o horário de
// início de cada slot.
export const calcTenisPrice = (times: string[]): number => {
  return times.reduce((sum, t) => {
    const isNight = timeToMinutes(t) >= TENIS_NIGHT_START_MIN;
    const perSlot = (isNight ? TENIS_NIGHT_RATE_PER_HOUR : TENIS_DAY_RATE_PER_HOUR) / 2;
    return sum + perSlot;
  }, 0);
};

export interface DurationOption {
  label: string;
  duration: string;
  price: string;
  slots: number;
}

export const societyDurations: DurationOption[] = [
  { label: "1 hora", duration: "1h", price: "R$ 100", slots: 2 },
  { label: "1 hora e 30 min", duration: "1:30h", price: "R$ 140", slots: 3 },
  { label: "2 horas", duration: "2h", price: "R$ 180", slots: 4 },
];

export const timeSlots = [
  "05:00", "05:30",
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

// ---------- Valor do mensalista: mês de 4 x 5 semanas ----------
// O valor cadastrado (`price`) corresponde a 4 semanas, ou seja, 4 sessões para
// cada dia da semana escolhido. Mês em que algum dia cai 5 vezes cobra a sessão
// a mais na mesma proporção (ex.: R$ 200 por 4 sessões → R$ 250 no mês de 5).
export const WEEKS_IN_BASE_MONTH = 4;

// Valor de UMA sessão do mensalista.
export const subscriberSessionPrice = (
  sub: Pick<MonthlySubscriber, "price" | "weekdays">
): number => {
  const baseSessions = WEEKS_IN_BASE_MONTH * sub.weekdays.length;
  if (!(sub.price > 0) || baseSessions === 0) return 0;
  return sub.price / baseSessions;
};

// Quantas vezes os dias da semana informados caem no mês "YYYY-MM".
export const countWeekdaysInMonth = (ym: string, weekdays: number[]): number => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (weekdays.includes(new Date(y, m - 1, day).getDay())) count++;
  }
  return count;
};

// Valor a cobrar por `sessions` sessões (arredondado em centavos).
export const subscriberValueForSessions = (
  sub: Pick<MonthlySubscriber, "price" | "weekdays">,
  sessions: number
): number => Math.round(subscriberSessionPrice(sub) * sessions * 100) / 100;

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
