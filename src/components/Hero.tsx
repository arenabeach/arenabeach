import { motion } from "framer-motion";
import heroImg from "@/assets/hero-arena.png";
import logoImg from "@/assets/logo-arena.png";
import { ArrowDown, MapPin, Phone, Mail } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative h-[100dvh] min-h-[500px] flex items-center justify-center overflow-hidden">
      <img
        src={heroImg}
        alt="Alça Beach Arena"
        className="absolute inset-0 w-full h-full object-cover scale-105"
      />
      <div className="hero-overlay absolute inset-0" />

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto">
        <motion.img
          src={logoImg}
          alt="Alça Beach Arena"
          className="h-32 sm:h-44 md:h-64 mx-auto mb-6 sm:mb-8 object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.6)]"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, delay: 0.1 }}
        />

        <motion.p
          className="text-sm sm:text-base md:text-xl font-body font-light text-white/70 mb-8 sm:mb-10 max-w-lg mx-auto px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Esportes de areia e campo society. Reserve sua quadra agora.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <a
            href="/agendar"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-body font-semibold text-sm tracking-wide btn-animate btn-pulse hover:shadow-[0_0_40px_hsl(25_95%_53%/0.4)]"
          >
            AGENDAR HORÁRIO
          </a>
          <a
            href="#como-funciona"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white/10 backdrop-blur-sm text-white font-body font-medium text-sm tracking-wide border border-white/20 btn-animate hover:bg-white/20"
          >
            COMO FUNCIONA
          </a>
        </motion.div>

        <motion.div
          className="mt-8 sm:mt-12 flex items-center justify-center gap-4 sm:gap-6 text-white/50 text-xs font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          <span className="flex items-center gap-1.5">
            <MapPin size={14} /> Patos - PB
          </span>
          <span className="flex items-center gap-1.5">
            <Phone size={14} /> (83) 99982-8597
          </span>
          <span className="flex items-center gap-1.5">
            <Mail size={14} /> arenaalcabeach@gmail.com
          </span>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <ArrowDown className="w-5 h-5 text-white/50" />
      </motion.div>
    </section>
  );
};

export default Hero;
