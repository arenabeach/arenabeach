import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-8xl font-display text-primary mb-4">404</h1>
        <p className="text-xl font-body text-muted-foreground mb-6">
          Página não encontrada
        </p>
        <Button
          onClick={() => navigate("/")}
          className="font-body gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Home size={16} /> Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
