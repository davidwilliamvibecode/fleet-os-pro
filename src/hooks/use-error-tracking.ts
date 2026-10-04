import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

/**
 * Error tracking do lado do cliente.
 *
 * Sem isto, uma exceção num clique só sumia no console do navegador. Com isto,
 * ela vai para o diagnóstico da empresa (ver `errors.ts`) e o proprietário vê
 * o que quebrou — sem depender de serviço externo nem de serviço de terceiros.
 *
 * Monta uma vez na raiz do app, junto com os providers. Erros de rede e de
 * cancelamento (Convex devolve "Could not find public path" quando o usuário
 * troca de rota no meio da requisição) são ignorados: são ruído, não defeito.
 */

const IGNORED = [
  "Could not find public path",
  "Called end() without a matching start()",
  "network error",
  "Failed to fetch",
  "AbortError",
];

function shouldIgnore(message: string) {
  const lower = message.toLowerCase();
  return IGNORED.some((pattern) => lower.includes(pattern.toLowerCase()));
}

export function useErrorTracking() {
  const report = useMutation(api.errors.reportError);
  // Uma falha ao reportar não pode gerar outra falha, senão vira laço.
  const reporting = useRef(false);
  const ready = useRef(false);

  useEffect(() => {
    function send(source: string, error: unknown, context?: string) {
      if (reporting.current || !ready.current) return;
      const message = error instanceof Error ? error.message : String(error);
      if (shouldIgnore(message)) return;

      reporting.current = true;
      report({ source, message, stack: error instanceof Error ? error.stack : undefined, context })
        .catch(() => {
          /* silencioso por definição: falhar ao reportar não deve aparecer */
        })
        .finally(() => {
          reporting.current = false;
        });
    }

    function onError(event: ErrorEvent) {
      send("window.onerror", event.error ?? event.message, event.filename);
    }
    function onRejection(event: PromiseRejectionEvent) {
      send("unhandledrejection", event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // Espera o Convex conectar antes de começar a reportar.
    ready.current = true;

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);
}

/** Erro no ponto de ação: para validações que sabemos que podem falhar. */
export function useReportAction() {
  const report = useMutation(api.errors.reportError);
  const reporting = useRef(false);

  return function reportAction(source: string, error: unknown, context?: string) {
    if (reporting.current) return;
    const message = error instanceof Error ? error.message : String(error);
    if (shouldIgnore(message)) return;
    reporting.current = true;
    report({ source, message, stack: error instanceof Error ? error.stack : undefined, context })
      .catch(() => undefined)
      .finally(() => {
        reporting.current = false;
      });
  };
}