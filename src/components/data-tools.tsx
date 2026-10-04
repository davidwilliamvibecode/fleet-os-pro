import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/notebook";
import { errorMessage } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Painel de exportação (backup).
 *
 * O Termo de Uso promete que o cliente pode levar os dados embora; é este botão
 * que torna a promessa verdadeira. Cada planilha baixa como CSV UTF-8 com `;`,
 * que o Excel em pt-BR abre direto. O pedido fica registrado no livro de
 * registros, como toda outra alteração.
 */
export function ExportPanel({ className }: { className?: string }) {
  const buildExport = useQuery(api.export.buildExport);
  const recordExport = useMutation(api.export.recordExport);
  const [busy, setBusy] = useState<string | null>(null);

  const files = buildExport?.files ?? [];
  const totalRows = files.reduce((sum, file) => sum + file.rows, 0);

  function download(name: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    if (!buildExport || files.length === 0) return;
    setBusy("all");
    try {
      for (const file of files) {
        download(file.name, file.csv);
      }
      const vehicles = files.find((f) => f.name === "veiculos.csv")?.rows ?? 0;
      const drivers = files.find((f) => f.name === "motoristas.csv")?.rows ?? 0;
      await recordExport({ vehicleCount: vehicles, driverCount: drivers });
      toast.success("Exportação concluída — confira a pasta de downloads.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function downloadOne(name: string) {
    const file = files.find((f) => f.name === name);
    if (!file) return;
    setBusy(name);
    try {
      download(name, file.csv);
      const vehicles = file.name === "veiculos.csv" ? file.rows : 0;
      const drivers = file.name === "motoristas.csv" ? file.rows : 0;
      await recordExport({ vehicleCount: vehicles, driverCount: drivers });
      toast.success(`${name} baixado.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const LABELS: Record<string, string> = {
    "veiculos.csv": "Veículos",
    "motoristas.csv": "Motoristas",
    "manutencoes.csv": "Manutenções",
    "documentos.csv": "Documentos",
    "historico.csv": "Histórico",
  };

  return (
    <div className={className}>
      <SectionHeading icon={Download} hint="backup em CSV">
        Exportar dados
      </SectionHeading>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Baixe uma cópia de tudo o que está registrado neste espaço — veículos, motoristas,
        manutenções, documentos e histórico. Cada arquivo abre direto no Excel em português, e o
        pedido de exportação fica registrado no livro de registros. Guarde a cópia onde preferir: é a
        sua garantia de que os dados não dependem só daqui.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <button
            key={file.name}
            type="button"
            onClick={() => void downloadOne(file.name)}
            disabled={busy !== null}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {LABELS[file.name] ?? file.name}
              </span>
              <span className="block font-mono text-[0.7rem] text-muted-foreground">
                {file.rows} {file.rows === 1 ? "registro" : "registros"}
              </span>
            </span>
            {busy === file.name ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-pen" aria-hidden="true" />
            ) : (
              <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void downloadAll()} disabled={busy !== null} className="gap-2">
          {busy === "all" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          Baixar tudo
        </Button>
        <span className="text-sm text-muted-foreground">
          {buildExport === undefined
            ? "Preparando a exportação…"
            : `${files.length} arquivos · ${totalRows} registros no total`}
        </span>
      </div>
    </div>
  );
}

/**
 * Diagnóstico: erros capturados no app, para o dono ver o que quebrou sem
 * depender de serviço externo. A lista é uma caixa de entrada — limpa depois
 * que foi lida.
 */
export function DiagnosticsPanel({ className }: { className?: string }) {
  const errors = useQuery(api.errors.listErrors, { limit: 50 });
  const clearErrors = useMutation(api.errors.clearErrors);
  const [clearing, setClearing] = useState(false);
  const rows = errors ?? [];

  async function clear() {
    setClearing(true);
    try {
      const result = await clearErrors();
      toast.success(`${result.removed} ${result.removed === 1 ? "erro removido" : "erros removidos"}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className={className}>
      <SectionHeading icon={AlertTriangle} hint="somente proprietário e administrador">
        Diagnóstico de erros
      </SectionHeading>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Falhas capturadas enquanto o app estava em uso. Guardamos só a mensagem e a origem — nunca o
        conteúdo dos dados da empresa. Se a lista estiver vazia, não houve erro registrado.
      </p>

      {rows.length > 0 ? (
        <>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => void clear()}
              disabled={clearing}
              className="gap-2 text-stamp-bad"
            >
              {clearing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Limpar lista
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-stamp-bad">{row.source}</span>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-ink">{row.message}</p>
                {row.context ? (
                  <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground">{row.context}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {errors === undefined ? "Carregando…" : "Nenhum erro registrado."}
        </p>
      )}
    </div>
  );
}