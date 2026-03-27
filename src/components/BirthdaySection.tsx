import { motion } from "framer-motion";
import { PartyPopper, Users, Music, Utensils, Phone } from "lucide-react";
import foto01 from "@/assets/foto 01.jpeg";
import foto02 from "@/assets/foto 02.jpeg";
import foto03 from "@/assets/foto 03.jpeg";

const features = [
  {
    icon: Users,
    title: "Espaço Amplo",
    desc: "Quadras e área reservada para seu evento com conforto e segurança",
  },
  {
    icon: Music,
    title: "Estrutura Completa",
    desc: "Som, iluminação e espaço para decoração do jeito que você quiser",
  },
  {
    icon: Utensils,
    title: "Área para Comes e Bebes",
    desc: "Espaço dedicado para mesa de bolo, salgados e bebidas",
  },
];

const BirthdaySection = () => {
  return (
    <section className="py-12 xs:py-16 sm:py-24 px-3 xs:px-4 sm:px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xs:gap-8 md:gap-12 items-center">
          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-1.5 xs:gap-2 mb-2 xs:mb-3">
              <PartyPopper className="w-4 h-4 xs:w-5 xs:h-5 text-primary" />
              <p className="section-label mb-0">Comemore conosco</p>
            </div>
            <h2 className="section-title mb-3 xs:mb-4">FESTAS E ANIVERSÁRIOS</h2>
            <p className="text-xs xs:text-sm sm:text-base font-body text-muted-foreground leading-relaxed mb-4 xs:mb-6">
              Quer comemorar seu aniversário de um jeito diferente? A Alça Beach Arena
              oferece locação do espaço para festas e eventos. Diversão garantida com
              esportes de areia, estrutura completa e um ambiente único para celebrar
              com família e amigos.
            </p>

            <div className="space-y-3 xs:space-y-4 mb-6 xs:mb-8">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2.5 xs:gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                >
                  <div className="w-8 h-8 xs:w-9 xs:h-9 rounded-lg xs:rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feature.icon className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm xs:text-base tracking-wide text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-[10px] xs:text-xs sm:text-sm font-body text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <a
              href="https://wa.me/5583999828597?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20loca%C3%A7%C3%A3o%20para%20anivers%C3%A1rio."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 xs:px-6 py-2.5 xs:py-3 rounded-full bg-primary text-primary-foreground font-body font-semibold text-xs xs:text-sm tracking-wide btn-animate hover:shadow-[0_0_30px_hsl(25_95%_53%/0.3)]"
            >
              <Phone className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
              SOLICITAR ORÇAMENTO
            </a>
          </motion.div>

          {/* Galeria de fotos */}
          <motion.div
            className="relative grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Foto grande à esquerda */}
            <motion.div
              className="col-span-1 row-span-2"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <img
                src={foto01}
                alt="Festa na Alça Beach Arena"
                className="w-full h-full object-cover rounded-xl xs:rounded-2xl sm:rounded-3xl shadow-lg"
              />
            </motion.div>

            {/* Foto superior direita */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <img
                src={foto02}
                alt="Evento na Alça Beach Arena"
                className="w-full h-full object-cover rounded-xl xs:rounded-2xl sm:rounded-3xl shadow-lg aspect-square"
              />
            </motion.div>

            {/* Foto inferior direita */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <img
                src={foto03}
                alt="Aniversário na Alça Beach Arena"
                className="w-full h-full object-cover rounded-xl xs:rounded-2xl sm:rounded-3xl shadow-lg aspect-square"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BirthdaySection;
