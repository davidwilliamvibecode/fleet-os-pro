import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen flex-col items-center justify-center px-4"
    >
      <div className="note-edge w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
          erro 404
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O endereço acessado não existe ou foi movido. Volte ao painel para continuar gerenciando a
          sua frota.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Ir para o painel
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
