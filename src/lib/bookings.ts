import { supabase } from "./supabase";

export const sports = ["Vôlei", "Beach Tennis", "Futevôlei"] as const;
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
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30",
];
