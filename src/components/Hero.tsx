import { motion } from "framer-motion";
import heroImg from "@/assets/Hero-ok.png";
import logoImg from "@/assets/logo-arena.png";
import { ArrowDown, MapPin, Phone, Mail } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative h-[100dvh] min-h-[480px] flex items-center justify-center overflow-hidden">
      <img
        src={heroImg}
        alt="Alça Beach Arena"
        className="absolute inset-0 w-full h-full object-cover object-center scale-105"
      />
      <div className="hero-overlay absolute inset-0" />

      <div className="relative z-10 text-center px-3 xs:px-4 sm:px-6 lg:px-8 max-w-3xl lg:max-w-4xl mx-auto w-full">
        <motion.img
          src={logoImg}
          alt="Alça Beach Arena"
          className="h-20 xs:h-28 sm:h-36 md:h-48 lg:h-56 xl:h-64 mx-auto mb-4 xs:mb-5 sm:mb-6 md:mb-8 object-contain"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, delay: 0.1 }}
        />

        <motion.p
          className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl font-body font-light text-white/70 mb-6 xs:mb-7 sm:mb-8 md:mb-10 max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg mx-auto px-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Esportes de areia e campo society. Reserve sua quadra agora.
        </motion.p>

        <motion.div
          className="flex flex-col xs:flex-col sm:flex-row items-center justify-center gap-2.5 xs:gap-3 sm:gap-4 px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <a
            href="/agendar"
            className="w-full xs:w-64 sm:w-auto inline-flex items-center justify-center gap-2 px-6 xs:px-7 sm:px-8 py-3 xs:py-3.5 sm:py-4 rounded-full bg-primary text-primary-foreground font-body font-semibold text-xs xs:text-sm tracking-wide btn-animate btn-pulse hover:shadow-[0_0_40px_hsl(25_95%_53%/0.4)]"
          >
            AGENDAR HORÁRIO
          </a>
          <a
            href="#como-funciona"
            className="w-full xs:w-64 sm:w-auto inline-flex items-center justify-center gap-2 px-6 xs:px-7 sm:px-8 py-3 xs:py-3.5 sm:py-4 rounded-full bg-white/10 backdrop-blur-sm text-white font-body font-medium text-xs xs:text-sm tracking-wide border border-white/20 btn-animate hover:bg-white/20"
          >
            COMO FUNCIONA
          </a>
        </motion.div>

        <motion.div
          className="mt-6 xs:mt-8 sm:mt-10 md:mt-12 flex flex-wrap items-center justify-center gap-3 xs:gap-4 sm:gap-5 md:gap-6 text-white/50 text-[10px] xs:text-xs sm:text-xs font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          <span className="flex items-center gap-1 xs:gap-1.5">
            <MapPin className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> Patos - PB
          </span>
          <span className="flex items-center gap-1 xs:gap-1.5">
            <Phone className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> (83) 99982-8597
          </span>
          <span className="flex items-center gap-1 xs:gap-1.5">
            <Mail className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> arenaalcabeach@gmail.com
          </span>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-4 xs:bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <ArrowDown className="w-4 h-4 xs:w-5 xs:h-5 text-white/50" />
      </motion.div>
    </section>
  );
};

export default Hero;
