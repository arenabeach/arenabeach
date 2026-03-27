import logoImg from "@/assets/logo-arena.png";
import { MapPin, Phone, Instagram, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-8 xs:py-10 sm:py-12 px-3 xs:px-4 sm:px-6 border-t border-border bg-card/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 xs:gap-8 mb-6 xs:mb-8">
          <div className="flex flex-col items-center sm:items-start gap-2 xs:gap-3 text-center sm:text-left">
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
              <img src={logoImg} alt="Logo" className="h-7 xs:h-8 sm:h-10 object-contain" />
              <span className="font-display text-base xs:text-lg sm:text-xl tracking-wider text-foreground">
                ALÇA BEACH ARENA
              </span>
            </div>
            <p className="text-xs xs:text-sm font-body text-muted-foreground max-w-xs">
              O melhor espaço para esportes de areia e campo society da região.
            </p>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="font-display text-base xs:text-lg tracking-wide text-foreground mb-2 xs:mb-3">Contato</h4>
            <div className="space-y-1.5 xs:space-y-2 text-xs xs:text-sm font-body text-muted-foreground">
              <a href="tel:+5583999828597" className="flex items-center justify-center sm:justify-start gap-2 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" /> (83) 99982-8597
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center sm:justify-start gap-2 hover:text-primary transition-colors">
                <Instagram className="w-3.5 h-3.5 flex-shrink-0" /> @alcabeacharena
              </a>
              <a href="mailto:arenaalcabeach@gmail.com" className="flex items-center justify-center sm:justify-start gap-2 hover:text-primary transition-colors">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" /> arenaalcabeach@gmail.com
              </a>
              <p className="flex items-center justify-center sm:justify-start gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> Patos - PB
              </p>
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h4 className="font-display text-base xs:text-lg tracking-wide text-foreground mb-2 xs:mb-3">Horário</h4>
            <div className="space-y-1 text-xs xs:text-sm font-body text-muted-foreground">
              <p>Segunda a Sexta: 17h - 22:30h</p>
              <p>Sábados e Domingos: 17h - 22:30h</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 xs:pt-6 flex flex-col md:flex-row items-center justify-between gap-1.5 xs:gap-2">
          <p className="text-muted-foreground font-body text-[10px] xs:text-xs">
            2026 Alça Beach Arena. Todos os direitos reservados.
          </p>
          <p className="text-muted-foreground/50 font-body text-[10px] xs:text-xs">
            Feito com dedicação
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
