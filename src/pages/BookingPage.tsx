import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon, ArrowLeft, Copy, Check, Shield, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  courtNames,
  courtPrices,
  timeSlots,
  addBooking,
  getAllBookedSlots,
  societyDurations,
  sports,
} from "@/lib/bookings";
import type { DurationOption, Sport } from "@/lib/bookings";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const PIX_KEY = "seu-pix@email.com"; // Substituir pela chave PIX real
const WHATSAPP_NUMBER = "5583999322509";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
};

const formatDuration = (slotCount: number): string => {
  const totalMinutes = slotCount * 30;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
};

const formatBRL = (value: number): string => {
  if (value % 1 === 0) return `R$ ${value}`;
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
};

// Preco base das quadras (por hora)
const QUADRA_PRICE_PER_HOUR = 45;
const QUADRA_PRICE_PER_SLOT = QUADRA_PRICE_PER_HOUR / 2; // 22,50 por 30min

const BookingPage = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>();
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [copied, setCopied] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<string, Set<string>>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  // Carregar slots ocupados quando a data mudar
  useEffect(() => {
    if (!dateStr) return;
    setLoadingSlots(true);
    getAllBookedSlots(dateStr)
      .then(setBookedSlots)
      .finally(() => setLoadingSlots(false));
  }, [dateStr]);

  const isSlotBooked = (courtId: string, time: string): boolean => {
    return bookedSlots[courtId]?.has(time) || false;
  };

  const isSociety = selectedCourt === "society";
  const courtName = selectedCourt ? courtNames[selectedCourt] || "" : "";

  // Preco preview (antes de escolher quadra, usa preco padrao das quadras)
  const previewTotal = selectedTimes.length * QUADRA_PRICE_PER_SLOT;

  // Preco final (apos escolher quadra)
  const totalPrice = isSociety
    ? (selectedDuration?.price || "R$ 100")
    : selectedCourt
    ? formatBRL(parseInt((courtPrices[selectedCourt] || "R$ 0").replace(/\D/g, ""), 10) * selectedTimes.length / 2)
    : formatBRL(previewTotal);

  const handleToggleTime = (t: string) => {
    setSelectedTimes((prev) => {
      if (prev.includes(t)) {
        return prev.filter((x) => x !== t);
      }
      return [...prev, t].sort();
    });
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    toast.success("Chave PIX copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToStep2 = () => {
    if (!date || selectedTimes.length === 0) {
      toast.error("Selecione data e horario!");
      return;
    }
    if (!selectedSport) {
      toast.error("Selecione o esporte!");
      return;
    }
    if (selectedTimes.length < 2) {
      toast.error("O tempo minimo de reserva e 1 hora (selecione pelo menos 2 horarios)!");
      return;
    }
    setStep(2);
  };

  const handleGoToStep3 = async () => {
    if (!name.trim()) {
      toast.error("Informe seu nome!");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Informe um telefone valido com DDD!");
      return;
    }
    // Recarregar slots antes de mostrar as quadras
    if (dateStr) {
      setLoadingSlots(true);
      const slots = await getAllBookedSlots(dateStr);
      setBookedSlots(slots);
      setLoadingSlots(false);
    }
    setStep(3);
  };

  const handleSelectCourt = (courtId: string) => {
    const unavailable = selectedTimes.filter((t) => isSlotBooked(courtId, t));
    if (unavailable.length > 0) {
      toast.error(`Horario(s) ${unavailable.join(", ")} indisponivel(is) nessa quadra!`);
      return;
    }
    setSelectedCourt(courtId);
    setSelectedDuration(null);
  };

  const handleConfirmBooking = async () => {
    if (!date || selectedTimes.length === 0 || !name || !phone || !selectedCourt) {
      toast.error("Preencha todos os campos!");
      return;
    }
    if (isSociety && !selectedDuration) {
      toast.error("Selecione a duracao!");
      return;
    }

    setSubmitting(true);

    try {
      // Verificar disponibilidade em tempo real antes de confirmar
      const freshSlots = await getAllBookedSlots(dateStr);
      const unavailable = selectedTimes.filter((t) => freshSlots[selectedCourt]?.has(t));
      if (unavailable.length > 0) {
        toast.error(`Horario(s) ${unavailable.join(", ")} acabou de ser reservado! Escolha outro horario.`);
        setBookedSlots(freshSlots);
        setSubmitting(false);
        return;
      }

      const timeDisplay = selectedTimes.join(", ");

      const booking = await addBooking({
        courtId: selectedCourt,
        courtName,
        sport: isSociety ? undefined : (selectedSport || undefined),
        date: dateStr,
        time: timeDisplay,
        name: name.trim(),
        phone,
      });

      const durationLabel = isSociety
        ? (selectedDuration ? `\nDuracao: ${selectedDuration.label}` : "")
        : ` (${formatDuration(selectedTimes.length)})`;

      const sportInfo = !isSociety && selectedSport ? `\nEsporte: ${selectedSport}` : "";

      const message = encodeURIComponent(
        `Ola! Fiz um agendamento na Alça Beach Arena:\n\n` +
        `Quadra: ${courtName}${sportInfo}\n` +
        `Data: ${format(date, "dd/MM/yyyy")}\n` +
        `Horario: ${timeDisplay}${durationLabel}\n` +
        `Nome: ${name}\n` +
        `Telefone: ${phone}\n` +
        `Valor: ${totalPrice}\n\n` +
        `ID do agendamento: ${booking.id}\n\n` +
        `Segue o comprovante do PIX em anexo.`
      );

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
      toast.success("Agendamento criado! Envie o comprovante pelo WhatsApp.");
      navigate("/");
    } catch {
      toast.error("Erro ao criar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ["Data e Horario", "Seus Dados", "Quadra e Pagamento"];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <motion.button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground font-body mb-8 hover:text-foreground transition-colors"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft size={18} /> Voltar
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-display tracking-wide mb-2">
            AGENDAR <span className="text-primary">HORARIO</span>
          </h1>
          <p className="text-muted-foreground font-body text-sm sm:text-base mb-6 sm:mb-8">
            Quadras: <span className="text-primary font-semibold">R$ {QUADRA_PRICE_PER_HOUR}/hora</span> (R$ {QUADRA_PRICE_PER_SLOT.toFixed(2).replace(".", ",")}/30min) — minimo 1 hora
          </p>

          {/* Steps indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-8 sm:mb-10 overflow-x-auto">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-body font-semibold transition-all duration-300",
                    s === step
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : s < step
                      ? "bg-palm text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {s < step ? <Check size={14} /> : s}
                </div>
                <span className={cn(
                  "text-xs font-body hidden sm:block",
                  s === step ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {stepLabels[s - 1]}
                </span>
                {s < 3 && <div className={cn("w-8 h-0.5 mx-1", s < step ? "bg-palm" : "bg-muted")} />}
              </div>
            ))}
          </div>

          {/* Step 1: Date, Sport & Time */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Date */}
              <div>
                <label className="font-body font-semibold text-sm mb-2 block text-foreground">
                  Selecione a data
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-body h-12",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {date ? format(date, "dd 'de' MMMM, yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => { setDate(d); setSelectedTimes([]); setSelectedSport(null); }}
                      disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || d > addDays(new Date(), 30)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Sport */}
              {date && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="font-body font-semibold text-sm mb-3 block text-foreground">
                    Qual esporte?
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {sports.map((sport) => (
                      <button
                        key={sport}
                        onClick={() => setSelectedSport(sport)}
                        className={cn(
                          "py-3 sm:py-4 px-2 rounded-xl text-xs sm:text-sm font-body font-medium transition-all duration-200 text-center",
                          selectedSport === sport
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.03]"
                            : "bg-card border border-border hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Time slots */}
              {date && selectedSport && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-body font-semibold text-sm block text-foreground">
                      Selecione os horarios
                    </label>
                    {selectedTimes.length > 0 && (
                      <span className="text-xs font-body font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {formatDuration(selectedTimes.length)} = {formatBRL(selectedTimes.length * QUADRA_PRICE_PER_SLOT)}
                      </span>
                    )}
                  </div>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm font-body text-muted-foreground">Carregando horarios...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2">
                      {timeSlots.map((t) => {
                        const isSelected = selectedTimes.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => handleToggleTime(t)}
                            className={cn(
                              "py-2.5 rounded-xl text-xs sm:text-sm font-body font-medium transition-all duration-200",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                                : "bg-card border border-border hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedTimes.length > 0 && selectedTimes.length < 2 && (
                    <p className="text-xs text-amber-500 font-body mt-2 font-medium">
                      Selecione pelo menos 2 horarios (minimo 1 hora)
                    </p>
                  )}
                  {selectedTimes.length >= 2 && (
                    <p className="text-xs text-muted-foreground font-body mt-2">
                      Clique novamente para desmarcar um horario
                    </p>
                  )}

                  {/* Tabela de precos */}
                  <div className="mt-4 bg-card border border-border/50 rounded-xl p-3">
                    <p className="text-xs font-body font-semibold text-foreground mb-2">Tabela de valores (Quadras)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-body">
                      {[
                        { slots: 2, label: "1h" },
                        { slots: 3, label: "1h30" },
                        { slots: 4, label: "2h" },
                        { slots: 5, label: "2h30" },
                        { slots: 6, label: "3h" },
                        { slots: 7, label: "3h30" },
                        { slots: 8, label: "4h" },
                      ].map(({ slots, label }) => (
                        <div
                          key={slots}
                          className={cn(
                            "text-center py-1.5 rounded-lg",
                            selectedTimes.length === slots
                              ? "bg-primary/15 text-primary font-bold"
                              : "bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <span className="block font-medium">{label}</span>
                          <span>{formatBRL(slots * QUADRA_PRICE_PER_SLOT)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <Button
                onClick={handleGoToStep2}
                disabled={!date || selectedTimes.length < 2 || !selectedSport}
                className="w-full py-6 text-base font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl btn-animate hover:shadow-primary/20"
              >
                Continuar
              </Button>
            </motion.div>
          )}

          {/* Step 2: Customer Info */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <label className="font-body font-semibold text-sm mb-2 block text-foreground">
                  Seu nome completo
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="h-12 font-body rounded-xl"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="font-body font-semibold text-sm mb-2 block text-foreground">
                  WhatsApp (com DDD)
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="h-12 font-body rounded-xl"
                  type="tel"
                  maxLength={15}
                />
                {phone && !isValidPhone(phone) && (
                  <p className="text-xs text-destructive font-body mt-1">
                    Informe um numero com DDD valido
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 font-body rounded-xl btn-animate"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleGoToStep3}
                  disabled={!name.trim() || !isValidPhone(phone)}
                  className="flex-1 h-12 font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl btn-animate hover:shadow-primary/20"
                >
                  Continuar
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Court Selection + Availability + Payment */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Court Selection with Availability */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={18} className="text-primary" />
                  <label className="font-body font-semibold text-sm text-foreground">
                    Escolha a quadra
                  </label>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-4">
                  Veja a disponibilidade para {date && format(date, "dd/MM/yyyy")} e selecione sua quadra
                </p>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm font-body text-muted-foreground">Carregando disponibilidade...</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    {Object.entries(courtNames).map(([id, cName]) => {
                      const availableSlots = timeSlots.filter(
                        (t) => !isSlotBooked(id, t)
                      );
                      const bookedCount = timeSlots.length - availableSlots.length;
                      const hasConflict = selectedTimes.some((t) => isSlotBooked(id, t));
                      const isSelected = selectedCourt === id;

                      return (
                        <button
                          key={id}
                          onClick={() => handleSelectCourt(id)}
                          className={cn(
                            "w-full text-left border rounded-xl p-3 sm:p-4 transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                              : hasConflict
                              ? "border-border/50 opacity-60"
                              : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check size={12} className="text-primary-foreground" />
                                </div>
                              )}
                              <span className="font-body font-semibold text-sm text-foreground">{cName}</span>
                              <span className="text-xs font-body font-semibold text-primary">
                                {id !== "society"
                                  ? `${courtPrices[id]}/h = ${formatBRL(parseInt(courtPrices[id].replace(/\D/g, ""), 10) * selectedTimes.length / 2)}`
                                  : "A partir de R$ 100"
                                }
                              </span>
                            </div>
                            <span className="text-[10px] font-body text-muted-foreground">
                              {availableSlots.length} livres / {bookedCount} ocupados
                            </span>
                          </div>
                          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
                            {timeSlots.map((t) => {
                              const booked = isSlotBooked(id, t);
                              const isMyTime = selectedTimes.includes(t);
                              return (
                                <span
                                  key={t}
                                  className={cn(
                                    "text-[10px] sm:text-xs text-center py-1 rounded-lg font-body",
                                    booked
                                      ? "bg-destructive/15 text-destructive/50 line-through"
                                      : isMyTime
                                      ? "bg-primary/20 text-primary font-bold ring-1 ring-primary/40"
                                      : "bg-palm/15 text-palm font-medium"
                                  )}
                                >
                                  {t}
                                </span>
                              );
                            })}
                          </div>
                          {hasConflict && !isSelected && (
                            <p className="text-[10px] text-destructive font-body mt-1.5">
                              Seus horarios selecionados nao estao todos disponiveis nesta quadra
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-palm/15 border border-palm/30" />
                    <span className="text-[10px] font-body text-muted-foreground">Disponivel</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-primary/20 border border-primary/40" />
                    <span className="text-[10px] font-body text-muted-foreground">Seus horarios</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-destructive/15 border border-destructive/30" />
                    <span className="text-[10px] font-body text-muted-foreground">Ocupado</span>
                  </div>
                </div>
              </div>

              {/* Society Duration (only if society selected) */}
              {isSociety && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="font-body font-semibold text-sm mb-3 block text-foreground">
                    Duracao
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {societyDurations.map((opt) => (
                      <button
                        key={opt.duration}
                        onClick={() => setSelectedDuration(opt)}
                        className={cn(
                          "py-4 px-4 rounded-xl text-sm font-body font-medium transition-all duration-200 text-left",
                          selectedDuration?.duration === opt.duration
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.02]"
                            : "bg-card border border-border hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        <span className="block font-semibold">{opt.label}</span>
                        <span className={cn(
                          "text-xs mt-0.5 block",
                          selectedDuration?.duration === opt.duration
                            ? "text-primary-foreground/80"
                            : "text-primary"
                        )}>
                          {opt.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Booking Summary (show after court is selected) */}
              {selectedCourt && (!isSociety || selectedDuration) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="glass-card rounded-2xl p-4 sm:p-6">
                    <h3 className="font-display text-xl sm:text-2xl mb-3 sm:mb-4">Resumo do Agendamento</h3>
                    <div className="space-y-3 text-sm font-body">
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Quadra</span>
                        <span className="font-medium text-foreground">{courtName}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Data</span>
                        <span className="font-medium text-foreground">{date && format(date, "dd/MM/yyyy")}</span>
                      </div>
                      {!isSociety && selectedSport && (
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">Esporte</span>
                          <span className="font-medium text-foreground">{selectedSport}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Horario(s)</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{selectedTimes.join(", ")}</span>
                      </div>
                      {!isSociety && (
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">Duracao</span>
                          <span className="font-medium text-foreground">{formatDuration(selectedTimes.length)}</span>
                        </div>
                      )}
                      {isSociety && selectedDuration && (
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">Duracao</span>
                          <span className="font-medium text-foreground">{selectedDuration.label}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Nome</span>
                        <span className="font-medium text-foreground">{name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Telefone</span>
                        <span className="font-medium text-foreground">{phone}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Valor total</span>
                        <span className="text-lg font-bold text-primary">{totalPrice}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="glass-card rounded-2xl p-4 sm:p-6">
                    <h3 className="font-display text-xl sm:text-2xl mb-1">Pagamento via PIX</h3>
                    <p className="text-sm text-muted-foreground font-body mb-4">
                      Copie a chave PIX abaixo e faca a transferencia:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted px-4 py-3 rounded-xl text-sm font-body break-all text-foreground">
                        {PIX_KEY}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyPix}
                        className="shrink-0 h-11 w-11 rounded-xl"
                      >
                        {copied ? <Check size={16} className="text-palm" /> : <Copy size={16} />}
                      </Button>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
                    <Shield size={18} className="text-palm shrink-0 mt-0.5" />
                    <p className="text-xs font-body text-muted-foreground leading-relaxed">
                      Seu agendamento ficara pendente ate a confirmacao do pagamento pela arena.
                      Voce recebera a confirmacao pelo WhatsApp.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setStep(2); setSelectedCourt(null); setSelectedDuration(null); }}
                  className="flex-1 h-12 font-body rounded-xl btn-animate"
                >
                  Voltar
                </Button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={!selectedCourt || (isSociety && !selectedDuration) || submitting}
                  className={cn(
                    "btn-whatsapp btn-pulse flex-1 justify-center py-3 text-base rounded-xl",
                    (!selectedCourt || (isSociety && !selectedDuration) || submitting) && "opacity-50 pointer-events-none"
                  )}
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.325 0-4.49-.693-6.305-1.884l-.44-.292-2.646.887.887-2.646-.292-.44A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                    </svg>
                  )}
                  {submitting ? "Enviando..." : "Enviar Comprovante"}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default BookingPage;
