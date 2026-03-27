import logoImg from "@/assets/logo-arena.png";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved ? saved === "dark" : prefersDark;
    setDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  const navBg = scrolled || !isHome
    ? "bg-background/90 backdrop-blur-xl shadow-md"
    : "bg-black/30 backdrop-blur-sm";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 h-12 xs:h-14 sm:h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 cursor-pointer group min-w-0"
          onClick={() => {
            if (isHome) {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              navigate("/");
            }
          }}
        >
          <img
            src={logoImg}
            alt="Logo"
            className="h-7 xs:h-8 sm:h-9 object-contain transition-transform duration-300 group-hover:scale-110 shrink-0"
          />
          <span className={`font-display text-sm xs:text-base sm:text-lg tracking-wider transition-colors duration-300 truncate ${
            scrolled || !isHome ? "text-foreground" : "text-white"
          }`}>
            ALÇA BEACH ARENA
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1 font-body text-sm">
          <a
            href={isHome ? "#quadras" : "/#quadras"}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              scrolled || !isHome
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            Quadras
          </a>
          <a
            href={isHome ? "#como-funciona" : "/#como-funciona"}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              scrolled || !isHome
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            Como Funciona
          </a>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-all duration-200 ${
              scrolled || !isHome
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            aria-label="Alternar tema"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="ml-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm btn-animate hover:bg-primary/90 hover:shadow-primary/20"
          >
            Admin
          </button>
        </div>

        <button
          className={`md:hidden transition-colors ${scrolled || !isHome ? "text-foreground" : "text-white"}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-xl overflow-hidden border-b border-border/40"
          >
            <div className="px-6 py-4 flex flex-col gap-1 font-body text-sm">
              <a
                href={isHome ? "#quadras" : "/#quadras"}
                onClick={() => setOpen(false)}
                className="px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Quadras
              </a>
              <a
                href={isHome ? "#como-funciona" : "/#como-funciona"}
                onClick={() => setOpen(false)}
                className="px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Como Funciona
              </a>
              <button
                onClick={() => { toggleTheme(); setOpen(false); }}
                className="px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-left flex items-center gap-2"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
                {dark ? "Tema Claro" : "Tema Escuro"}
              </button>
              <button
                onClick={() => { navigate("/admin"); setOpen(false); }}
                className="mt-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm w-full text-left"
              >
                Admin
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
