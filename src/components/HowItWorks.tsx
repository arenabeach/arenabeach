import { motion } from "framer-motion";
import { CalendarCheck, QrCode, MessageCircle, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: CalendarCheck,
    title: "Escolha o Horário",
    desc: "Selecione a quadra, data e horário disponível para jogar",
  },
  {
    icon: QrCode,
    title: "Pague via PIX",
    desc: "Copie a chave PIX e faça a transferência do valor da reserva",
  },
  {
    icon: MessageCircle,
    title: "Envie o Comprovante",
    desc: "Mande o comprovante de pagamento pelo WhatsApp",
  },
  {
    icon: CheckCircle,
    title: "Confirmação",
    desc: "A arena verifica o pagamento e confirma seu agendamento",
  },
];

const HowItWorks = () => {
  return (
    <section id="como-funciona" className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="mb-10 sm:mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="section-label">Passo a passo</p>
          <h2 className="section-title">COMO FUNCIONA</h2>
          <p className="text-muted-foreground font-body mt-3 max-w-md mx-auto">
            Agende sua quadra em poucos minutos
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="group relative p-4 sm:p-6 rounded-2xl bg-background border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              {/* Step number */}
              <div className="absolute -top-2.5 -left-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground font-display text-xs sm:text-sm flex items-center justify-center shadow-lg shadow-primary/20">
                {i + 1}
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 -right-3 w-6 h-0.5 bg-border group-hover:bg-primary/30 transition-colors" />
              )}

              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 sm:mb-5 transition-all duration-300 group-hover:scale-110">
                <step.icon className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
              </div>
              <h3 className="font-display text-base sm:text-lg tracking-wide text-foreground mb-1 sm:mb-2">
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm font-body text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
