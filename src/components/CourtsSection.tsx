import { motion } from "framer-motion";
import courtVolei from "@/assets/court-volei.jpg";
import courtFutvolei from "@/assets/court-futvolei.jpg";
import courtBeachTennis from "@/assets/court-beachtennis.jpg";
import courtSociety from "@/assets/court-society.jpg";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Users, Clock } from "lucide-react";

const courts = [
  {
    id: "quadra-01",
    name: "Quadra 01",
    image: courtVolei,
    price: "R$ 45/h",
    players: "4-6 jogadores",
    duration: "1h por sessão",
  },
  {
    id: "quadra-02",
    name: "Quadra 02",
    image: courtFutvolei,
    price: "R$ 45/h",
    players: "4-6 jogadores",
    duration: "1h por sessão",
  },
  {
    id: "quadra-03",
    name: "Quadra 03",
    image: courtBeachTennis,
    price: "R$ 45/h",
    players: "4-6 jogadores",
    duration: "1h por sessão",
  },
  {
    id: "quadra-04",
    name: "Quadra 04",
    image: courtVolei,
    price: "R$ 45/h",
    players: "4-6 jogadores",
    duration: "1h por sessão",
  },
  {
    id: "quadra-05",
    name: "Quadra 05",
    image: courtFutvolei,
    price: "R$ 45/h",
    players: "4-6 jogadores",
    duration: "1h por sessão",
  },
  {
    id: "society",
    name: "Campo Society",
    image: courtSociety,
    price: "A partir de R$ 100",
    players: "10-14 jogadores",
    duration: "1h a 2h",
  },
];

const CourtsSection = () => {
  const navigate = useNavigate();

  return (
    <section id="quadras" className="py-12 xs:py-16 sm:py-24 px-3 xs:px-4 sm:px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="mb-10 sm:mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="section-label">Reserve agora</p>
          <h2 className="section-title">AGENDAR HORÁRIO</h2>
          <p className="text-muted-foreground font-body text-sm sm:text-base mt-2 sm:mt-3 max-w-md mx-auto px-2">
            Escolha uma quadra e reserve seu horário
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 xs:gap-3 sm:gap-4 md:gap-6">
          {courts.map((court, i) => (
            <motion.div
              key={court.id}
              className="group relative rounded-2xl overflow-hidden cursor-pointer bg-card border border-border/50 hover:border-primary/40 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1"
              onClick={() => navigate("/agendar")}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="relative h-28 xs:h-36 sm:h-44 md:h-56 overflow-hidden">
                <img
                  src={court.image}
                  alt={court.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="absolute top-2 right-2 xs:top-3 xs:right-3 text-[10px] xs:text-xs font-body font-bold text-white bg-primary px-2 xs:px-3 py-1 xs:py-1.5 rounded-full shadow-lg">
                  {court.price}
                </span>
              </div>

              <div className="p-2.5 xs:p-3 sm:p-4 md:p-5">
                <h3 className="font-display text-sm xs:text-base sm:text-lg md:text-xl tracking-wide text-foreground mb-1 sm:mb-3">
                  {court.name}
                </h3>
                <div className="hidden sm:flex items-center gap-4 text-xs font-body text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {court.players}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {court.duration}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-body font-medium text-primary group-hover:gap-3 transition-all duration-300">
                  <span>Agendar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CourtsSection;
