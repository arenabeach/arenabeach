import logoImg from "@/assets/logo-arena.png";
import { MapPin, Phone, Instagram, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-10 sm:py-12 px-4 sm:px-6 border-t border-border bg-card/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="flex flex-col items-center sm:items-start gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logoImg} alt="Logo" className="h-8 sm:h-10 object-contain" />
              <span className="font-display text-lg sm:text-xl tracking-wider text-foreground">
                ALÇA BEACH ARENA
              </span>
            </div>
            <p className="text-sm font-body text-muted-foreground max-w-xs">
              O melhor espaço para esportes de areia e campo society da região.
            </p>
          </div>

          <div>
            <h4 className="font-display text-lg tracking-wide text-foreground mb-3">Contato</h4>
            <div className="space-y-2 text-sm font-body text-muted-foreground">
              <a href="tel:+5583999828597" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone size={14} /> (83) 99982-8597
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Instagram size={14} /> @alcabeacharena
              </a>
              <a href="mailto:arenaalcabeach@gmail.com" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Mail size={14} /> arenaalcabeach@gmail.com
              </a>
              <p className="flex items-center gap-2">
                <MapPin size={14} /> Patos - PB
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-display text-lg tracking-wide text-foreground mb-3">Horário</h4>
            <div className="space-y-1 text-sm font-body text-muted-foreground">
              <p>Segunda a Sexta: 17h - 22:30h</p>
              <p>Sábados e Domingos: 17h - 22:30h</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-muted-foreground font-body text-xs">
            2026 Alça Beach Arena. Todos os direitos reservados.
          </p>
          <p className="text-muted-foreground/50 font-body text-xs">
            Feito com dedicação
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
