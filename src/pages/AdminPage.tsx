import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getBookings, updateBookingStatus, deleteBooking, addBooking, Booking, courtNames, courtPrices, timeSlots, sports } from "@/lib/bookings";
import type { Sport } from "@/lib/bookings";
import { verifyAdminPassword, createSession, isSessionValid, clearSession, isPasswordConfigured } from "@/lib/auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, ArrowLeft, LogOut, Lock, Trash2, Search, ChevronLeft, ChevronRight, CalendarIcon, LayoutGrid, List, Loader2, Plus, X, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const statusConfig = {
  pendente: { label: "Pendente", icon: Clock, color: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30" },
  confirmado: { label: "Confirmado", icon: CheckCircle, color: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30" },
};

const courtIds = Object.keys(courtNames);

const AdminPage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todos" | Booking["status"]>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"quadras" | "lista" | "caixa">("quadras");
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [manualBooking, setManualBooking] = useState<{ courtId: string; courtName: string; time: string } | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualSport, setManualSport] = useState<Sport | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSessionValid()) {
      setAuthenticated(true);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBookings();
      setBookings(data);
    } catch {
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      refreshBookings();
    }
  }, [authenticated, refreshBookings]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(refreshBookings, 30000);
    return () => clearInterval(interval);
  }, [authenticated, refreshBookings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const valid = await verifyAdminPassword(password);
      if (valid) {
        createSession();
        setAuthenticated(true);
        if (!isPasswordConfigured()) {
          toast.success("Senha admin configurada com sucesso!");
        }
      } else {
        setAuthError("Senha incorreta");
        setPassword("");
      }
    } catch {
      setAuthError("Erro ao verificar senha");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setAuthenticated(false);
    setPassword("");
    toast.success("Sessão encerrada");
  };

  const handleStatus = async (id: string, status: Booking["status"]) => {
    try {
      await updateBookingStatus(id, status);
      await refreshBookings();
      toast.success(status === "confirmado" ? "Agendamento confirmado!" : "Agendamento cancelado.");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const openManualBooking = (courtId: string, courtName: string, time: string) => {
    setManualBooking({ courtId, courtName, time });
    setManualName("");
    setManualPhone("");
    setManualSport(null);
  };

  const handleManualBooking = async () => {
    if (!manualBooking || !manualName.trim() || !manualPhone.trim()) {
      toast.error("Preencha nome e telefone!");
      return;
    }
    setManualSubmitting(true);
    try {
      const booking = await addBooking({
        courtId: manualBooking.courtId,
        courtName: manualBooking.courtName,
        sport: manualBooking.courtId !== "society" ? (manualSport || undefined) : undefined,
        date: selectedDate,
        time: manualBooking.time,
        name: manualName.trim(),
        phone: manualPhone,
      });
      await updateBookingStatus(booking.id, "confirmado");
      await refreshBookings();
      setManualBooking(null);
      toast.success("Agendamento criado e confirmado!");
    } catch {
      toast.error("Erro ao criar agendamento");
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    try {
      await deleteBooking(id);
      await refreshBookings();
      toast.success("Agendamento excluido.");
    } catch {
      toast.error("Erro ao excluir agendamento");
    }
  };

  const filtered = bookings
    .filter((b) => filter === "todos" || b.status === filter)
    .filter((b) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        b.name.toLowerCase().includes(term) ||
        b.phone.includes(term) ||
        b.courtName.toLowerCase().includes(term) ||
        b.date.includes(term)
      );
    });

  const stats = {
    total: bookings.length,
    pendente: bookings.filter((b) => b.status === "pendente").length,
    confirmado: bookings.filter((b) => b.status === "confirmado").length,
    cancelado: bookings.filter((b) => b.status === "cancelado").length,
  };

  // Calcular receita de um booking confirmado
  const getBookingRevenue = (b: Booking): number => {
    if (b.courtId === "society") {
      // Society: tenta inferir pelo número de slots
      const slots = b.time.split(", ").length;
      if (slots >= 4) return 180;
      if (slots >= 3) return 140;
      return 100;
    }
    // Quadras: R$ 45/h = R$ 22.50 por slot de 30min
    const pricePerHour = parseInt((courtPrices[b.courtId] || "R$ 45").replace(/\D/g, ""), 10);
    const slots = b.time.split(", ").length;
    return (pricePerHour / 2) * slots;
  };

  const confirmedBookings = bookings.filter((b) => b.status === "confirmado");

  // Receita por período
  const today = format(new Date(), "yyyy-MM-dd");
  const revenueToday = confirmedBookings
    .filter((b) => b.date === today)
    .reduce((sum, b) => sum + getBookingRevenue(b), 0);

  const revenueSelectedDate = confirmedBookings
    .filter((b) => b.date === selectedDate)
    .reduce((sum, b) => sum + getBookingRevenue(b), 0);

  const revenueTotal = confirmedBookings
    .reduce((sum, b) => sum + getBookingRevenue(b), 0);

  // Receita por quadra
  const revenueByCourtSelected = courtIds.map((cId) => {
    const courtBookings = confirmedBookings.filter((b) => b.courtId === cId && b.date === selectedDate);
    return {
      courtId: cId,
      courtName: courtNames[cId],
      count: courtBookings.length,
      revenue: courtBookings.reduce((sum, b) => sum + getBookingRevenue(b), 0),
    };
  });

  // Get bookings for a specific court and date
  const getCourtBookings = (courtId: string, date: string) => {
    return bookings.filter(
      (b) => b.courtId === courtId && b.date === date && b.status !== "cancelado"
    );
  };

  // Get booking for a specific slot
  const getSlotBooking = (courtId: string, date: string, time: string) => {
    return bookings.find(
      (b) => b.courtId === courtId && b.date === date && b.time.includes(time) && b.status !== "cancelado"
    );
  };

  // Date navigation
  const dateObj = new Date(selectedDate + "T12:00:00");
  const prevDate = () => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };
  const nextDate = () => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4 flex items-center justify-center min-h-screen">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-display tracking-wide mb-2">ADMIN</h1>
              <p className="text-sm text-muted-foreground font-body mb-6">
                {isPasswordConfigured()
                  ? "Digite sua senha para acessar"
                  : "Primeiro acesso: defina sua senha de admin"}
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
                  placeholder="Senha"
                  className="h-12 font-body rounded-xl text-center"
                  autoFocus
                  minLength={4}
                />
                {authError && (
                  <p className="text-sm text-destructive font-body">{authError}</p>
                )}
                <Button
                  type="submit"
                  disabled={authLoading || !password.trim()}
                  className="w-full h-12 font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl btn-animate hover:shadow-primary/20"
                >
                  {authLoading ? "Verificando..." : isPasswordConfigured() ? "Entrar" : "Definir Senha"}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 sm:pt-24 pb-12 sm:pb-16 px-3 sm:px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <motion.button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground font-body text-sm hover:text-foreground transition-colors"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ArrowLeft size={16} /> Voltar
          </motion.button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBookings}
              disabled={loading}
              className="font-body gap-1.5 rounded-xl text-xs sm:text-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CalendarIcon size={14} />}
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="font-body gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm"
            >
              <LogOut size={14} /> Sair
            </Button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-display tracking-wide mb-1 sm:mb-2">
            PAINEL <span className="text-primary">ADMIN</span>
          </h1>
          <p className="text-muted-foreground font-body text-sm sm:text-base mb-4 sm:mb-6">
            Gerencie os agendamentos da arena
          </p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Pendentes", value: stats.pendente, color: "text-amber-500" },
              { label: "Confirmados", value: stats.confirmado, color: "text-emerald-500" },
              { label: "Cancelados", value: stats.cancelado, color: "text-red-500" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-lg sm:rounded-xl p-2 sm:p-4 text-center">
                <p className={`text-lg sm:text-2xl font-display ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] sm:text-xs font-body text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-4 sm:mb-6">
            <button
              onClick={() => setTab("quadras")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-body font-medium transition-all",
                tab === "quadras"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <LayoutGrid size={14} /> Quadras
            </button>
            <button
              onClick={() => setTab("lista")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-body font-medium transition-all",
                tab === "lista"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <List size={14} /> Lista
            </button>
            <button
              onClick={() => setTab("caixa")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-body font-medium transition-all",
                tab === "caixa"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <DollarSign size={14} /> Caixa
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm font-body text-muted-foreground">Carregando...</span>
            </div>
          )}

          {/* =================== TAB: QUADRAS (Todas) =================== */}
          {tab === "quadras" && !loading && (
            <div className="space-y-6">
              {/* Date navigator */}
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  onClick={prevDate}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all btn-animate"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-card border border-border min-w-0 justify-center">
                  <CalendarIcon size={14} className="text-primary shrink-0" />
                  <span className="font-body text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                    {format(dateObj, "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
                <button
                  onClick={nextDate}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all btn-animate"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* All courts grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {courtIds.map((cId) => {
                  const cName = courtNames[cId];
                  const cBookings = getCourtBookings(cId, selectedDate);
                  const pendingBookings = cBookings.filter((b) => b.status === "pendente");

                  return (
                    <motion.div
                      key={cId}
                      className="glass-card rounded-xl sm:rounded-2xl overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {/* Court header */}
                      <div className="bg-primary/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-base sm:text-lg text-foreground">{cName}</h3>
                          <p className="text-[9px] sm:text-[10px] font-body text-muted-foreground">
                            {cBookings.length} horário(s) ocupado(s)
                          </p>
                        </div>
                      </div>

                      {/* Time slots grid */}
                      <div className="p-2 sm:p-3">
                        <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 gap-1 sm:gap-1.5">
                          {timeSlots.map((time) => {
                            const booking = getSlotBooking(cId, selectedDate, time);
                            const isBooked = !!booking;
                            const isPendente = booking?.status === "pendente";
                            const isConfirmado = booking?.status === "confirmado";

                            return (
                              <div
                                key={time}
                                onClick={() => !isBooked && openManualBooking(cId, cName, time)}
                                className={cn(
                                  "relative rounded-md sm:rounded-lg p-1 sm:p-1.5 text-center transition-all",
                                  isConfirmado
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700"
                                    : isPendente
                                    ? "bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"
                                    : "bg-muted/50 border border-border/50 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                                )}
                              >
                                <p className={cn(
                                  "font-body text-xs font-semibold",
                                  isConfirmado ? "text-emerald-700 dark:text-emerald-400"
                                    : isPendente ? "text-amber-700 dark:text-amber-400"
                                    : "text-muted-foreground/50"
                                )}>
                                  {time}
                                </p>
                                {isBooked ? (
                                  <div className="mt-0.5">
                                    <p className="text-[9px] font-body text-foreground truncate font-medium">
                                      {booking.name.split(" ")[0]}
                                    </p>
                                    {booking.sport && (
                                      <p className="text-[8px] font-body text-primary truncate">
                                        {booking.sport}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-center gap-0.5">
                                      {isPendente ? (
                                        <Clock size={8} className="text-amber-600 dark:text-amber-400" />
                                      ) : (
                                        <CheckCircle size={8} className="text-emerald-600 dark:text-emerald-400" />
                                      )}
                                      <span className={cn(
                                        "text-[8px] font-body",
                                        isPendente ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                      )}>
                                        {isPendente ? "Pend." : "Conf."}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[9px] font-body text-muted-foreground/40 mt-0.5">
                                    <Plus size={10} className="inline" /> Livre
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Pending bookings for this court */}
                      {pendingBookings.length > 0 && (
                        <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1 sm:space-y-1.5">
                          <p className="text-[9px] sm:text-[10px] font-body font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            Pendentes
                          </p>
                          {pendingBookings.map((booking) => (
                            <div key={booking.id} className="flex items-center justify-between gap-1.5 sm:gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                              <div className="text-[9px] sm:text-[10px] font-body text-muted-foreground min-w-0">
                                <p className="text-foreground font-medium truncate">
                                  {booking.name} - {booking.time}
                                </p>
                                {booking.sport && (
                                  <p className="text-primary font-medium truncate">{booking.sport}</p>
                                )}
                                <p className="truncate">{booking.phone}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  onClick={() => handleStatus(booking.id, "confirmado")}
                                  className="bg-emerald-600 text-white hover:bg-emerald-700 font-body rounded-md sm:rounded-lg text-[9px] sm:text-[10px] h-6 sm:h-7 px-1.5 sm:px-2 btn-animate"
                                  size="sm"
                                >
                                  <CheckCircle size={9} className="mr-0.5" /> Conf.
                                </Button>
                                <Button
                                  onClick={() => handleStatus(booking.id, "cancelado")}
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10 font-body rounded-md sm:rounded-lg text-[9px] sm:text-[10px] h-6 sm:h-7 px-1.5 sm:px-2 btn-animate"
                                >
                                  <XCircle size={9} className="mr-0.5" /> Canc.
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================== TAB: LISTA =================== */}
          {tab === "lista" && !loading && (
            <div>
              {/* Search + Filters */}
              <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, telefone, quadra..."
                    className="h-9 sm:h-10 pl-8 sm:pl-9 font-body rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {(["todos", "pendente", "confirmado", "cancelado"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-body font-medium transition-all capitalize whitespace-nowrap shrink-0",
                        filter === f
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {f}
                      {f !== "todos" && (
                        <span className="ml-1 sm:ml-1.5 opacity-60">
                          {stats[f as keyof typeof stats]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-12 sm:py-20 text-muted-foreground font-body">
                  <p className="text-base sm:text-lg">Nenhum agendamento encontrado</p>
                  <p className="text-xs sm:text-sm mt-1">
                    {searchTerm ? "Tente buscar por outro termo" : "Os agendamentos aparecerão aqui"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {filtered
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((booking, i) => {
                      const cfg = statusConfig[booking.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <motion.div
                          key={booking.id}
                          className="glass-card rounded-xl p-3 sm:p-5"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="space-y-1 sm:space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-display text-base sm:text-lg">{booking.courtName}</h3>
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-body font-medium",
                                  cfg.color
                                )}>
                                  <StatusIcon size={10} />
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="text-xs sm:text-sm font-body text-muted-foreground space-y-0.5">
                                {booking.sport && <p>Esporte: {booking.sport}</p>}
                                <p>{booking.date} as {booking.time}</p>
                                <p>{booking.name} - {booking.phone}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground/50">
                                  Criado em {format(new Date(booking.createdAt), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0 flex-wrap">
                              {booking.status === "pendente" && (
                                <>
                                  <Button
                                    onClick={() => handleStatus(booking.id, "confirmado")}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 font-body rounded-xl text-[10px] sm:text-sm h-8 sm:h-9 btn-animate hover:shadow-emerald-500/20"
                                    size="sm"
                                  >
                                    <CheckCircle size={12} className="mr-1" /> Confirmar
                                  </Button>
                                  <Button
                                    onClick={() => handleStatus(booking.id, "cancelado")}
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive/30 hover:bg-destructive/10 font-body rounded-xl text-[10px] sm:text-sm h-8 sm:h-9 btn-animate"
                                  >
                                    <XCircle size={12} className="mr-1" /> Cancelar
                                  </Button>
                                </>
                              )}
                              {booking.status === "cancelado" && (
                                <Button
                                  onClick={() => handleDelete(booking.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive font-body rounded-xl text-[10px] sm:text-sm h-8 sm:h-9"
                                >
                                  <Trash2 size={12} className="mr-1" /> Excluir
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* =================== TAB: CAIXA =================== */}
          {tab === "caixa" && !loading && (
            <div className="space-y-4 sm:space-y-6">
              {/* Date navigator */}
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  onClick={prevDate}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all btn-animate"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-card border border-border min-w-0 justify-center">
                  <CalendarIcon size={14} className="text-primary shrink-0" />
                  <span className="font-body text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                    {format(dateObj, "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
                <button
                  onClick={nextDate}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all btn-animate"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Revenue cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="glass-card rounded-xl p-4 sm:p-5 text-center">
                  <p className="text-xs font-body text-muted-foreground mb-1">Hoje</p>
                  <p className="text-2xl sm:text-3xl font-display text-emerald-500">
                    R$ {revenueToday.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-[10px] font-body text-muted-foreground mt-1">
                    {confirmedBookings.filter((b) => b.date === today).length} agendamento(s)
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4 sm:p-5 text-center">
                  <p className="text-xs font-body text-muted-foreground mb-1">
                    {selectedDate === today ? "Hoje" : format(dateObj, "dd/MM/yyyy")}
                  </p>
                  <p className="text-2xl sm:text-3xl font-display text-primary">
                    R$ {revenueSelectedDate.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-[10px] font-body text-muted-foreground mt-1">
                    {confirmedBookings.filter((b) => b.date === selectedDate).length} agendamento(s)
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4 sm:p-5 text-center">
                  <p className="text-xs font-body text-muted-foreground mb-1">Total geral</p>
                  <p className="text-2xl sm:text-3xl font-display text-foreground">
                    R$ {revenueTotal.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-[10px] font-body text-muted-foreground mt-1">
                    {confirmedBookings.length} agendamento(s)
                  </p>
                </div>
              </div>

              {/* Revenue by court for selected date */}
              <div>
                <h3 className="font-display text-lg sm:text-xl mb-3">
                  Faturamento por quadra — {format(dateObj, "dd/MM/yyyy")}
                </h3>
                <div className="space-y-2">
                  {revenueByCourtSelected.map((court) => (
                    <div
                      key={court.courtId}
                      className="glass-card rounded-xl p-3 sm:p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-body font-semibold text-sm text-foreground">{court.courtName}</p>
                        <p className="text-[10px] sm:text-xs font-body text-muted-foreground">
                          {court.count} agendamento(s) confirmado(s)
                        </p>
                      </div>
                      <p className={cn(
                        "font-display text-lg sm:text-xl",
                        court.revenue > 0 ? "text-emerald-500" : "text-muted-foreground/40"
                      )}>
                        R$ {court.revenue.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirmed bookings list for selected date */}
              {confirmedBookings.filter((b) => b.date === selectedDate).length > 0 && (
                <div>
                  <h3 className="font-display text-lg sm:text-xl mb-3">
                    Detalhes — {format(dateObj, "dd/MM/yyyy")}
                  </h3>
                  <div className="space-y-2">
                    {confirmedBookings
                      .filter((b) => b.date === selectedDate)
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((booking) => (
                        <div
                          key={booking.id}
                          className="glass-card rounded-xl p-3 sm:p-4 flex items-center justify-between"
                        >
                          <div className="text-sm font-body min-w-0">
                            <p className="font-medium text-foreground">{booking.courtName} — {booking.time}</p>
                            <p className="text-xs text-muted-foreground">{booking.name} • {booking.phone}</p>
                          </div>
                          <p className="font-display text-base sm:text-lg text-emerald-500 shrink-0 ml-3">
                            R$ {getBookingRevenue(booking).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {confirmedBookings.filter((b) => b.date === selectedDate).length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-body">
                  <p className="text-base sm:text-lg">Nenhum agendamento confirmado</p>
                  <p className="text-xs sm:text-sm mt-1">Nenhuma receita para esta data</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal de agendamento manual */}
      {manualBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <motion.div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg sm:text-xl">Novo Agendamento</h3>
              <button onClick={() => setManualBooking(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 text-sm font-body text-muted-foreground mb-4">
              <p><span className="font-medium text-foreground">{manualBooking.courtName}</span></p>
              <p>{format(new Date(selectedDate + "T12:00:00"), "dd 'de' MMM, yyyy", { locale: ptBR })} às <span className="font-medium text-foreground">{manualBooking.time}</span></p>
            </div>

            <div className="space-y-3">
              {manualBooking.courtId !== "society" && (
                <div>
                  <label className="font-body font-semibold text-xs mb-1.5 block text-foreground">Esporte</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {sports.map((sport) => (
                      <button
                        key={sport}
                        onClick={() => setManualSport(sport)}
                        className={cn(
                          "py-2 rounded-lg text-xs font-body font-medium transition-all",
                          manualSport === sport
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="font-body font-semibold text-xs mb-1.5 block text-foreground">Nome</label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="h-10 font-body rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="font-body font-semibold text-xs mb-1.5 block text-foreground">Telefone</label>
                <Input
                  value={manualPhone}
                  onChange={(e) => setManualPhone(formatPhone(e.target.value))}
                  placeholder="(83) 99999-9999"
                  className="h-10 font-body rounded-xl text-sm"
                  type="tel"
                  maxLength={15}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setManualBooking(null)}
                  className="flex-1 h-10 font-body rounded-xl text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleManualBooking}
                  disabled={manualSubmitting || !manualName.trim() || !manualPhone.trim()}
                  className="flex-1 h-10 font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm"
                >
                  {manualSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Confirmar"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminPage;
