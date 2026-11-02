import { api } from "@/convex/_generated/api";
import type { ActivityEntity } from "@/convex/schema";
import {
  EmptyNote,
  LogEntry,
  PaperPanel,
  SectionHeading,
} from "@/components/notebook";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_ACTION_LABELS,
  formatNumber,
  labelFrom,
  timeAgo,
} from "@/lib/format";
import { useQuery } from "convex/react";
import { BookText, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "vehicle", label: "Veículos" },
  { value: "driver", label: "Motoristas" },
  { value: "maintenance", label: "Manutenções" },
  { value: "document", label: "Documentos" },
  { value: "member", label: "Equipe" },
  { value: "company", label: "Empresa" },
  { value: "workspace", label: "Espaço de trabalho" },
];

/**
 * O livro de registros (auditoria). Vive na página de Configurações e também
 * pode ser embutido no painel inicial.
 */
export function LogbookPanel() {
  const [entity, setEntity] = useState("all");
  const [limit, setLimit] = useState(60);

  const entries = useQuery(api.logbook.activityFeed, {
    entity: entity === "all" ? undefined : (entity as ActivityEntity),
    limit,
  });

  const filtersActive = entity !== "all";
  const feedIsEmpty = entries !== undefined && entries.length === 0 && !filtersActive;

  return (
    <div className="flex flex-col gap-5">
      <PaperPanel className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
              Tipo de registro
            </span>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="paper mt-1.5 w-full" aria-label="Filtrar por tipo de registro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="paper">
                {ENTITY_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
              Exibir
            </span>
            <Select
              value={String(limit)}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger className="paper mt-1.5 w-full" aria-label="Número de registros">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="paper">
                <SelectItem value="60">Últimos 60</SelectItem>
                <SelectItem value="120">Últimos 120</SelectItem>
                <SelectItem value="200">Últimos 200</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtersActive ? (
            <Button variant="ghost" className="gap-1.5" onClick={() => setEntity("all")}>
              <X className="size-4" aria-hidden="true" /> Limpar
            </Button>
          ) : null}

          <p className="ml-auto font-mono text-xs text-muted-foreground">
            {entries === undefined
              ? "contando…"
              : `${formatNumber(entries.length)} ${entries.length === 1 ? "registro" : "registros"}`}
          </p>
        </div>
      </PaperPanel>

      {entries === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : entries.length === 0 ? (
        feedIsEmpty ? (
          <EmptyNote
            icon={BookText}
            title="O livro de registros está vazio"
            description="Assim que você ou sua equipe cadastrar, editar ou vincular algo no Fleet OS Pro, tudo fica registrado aqui — uma trilha de auditoria permanente para toda a empresa."
          />
        ) : (
          <EmptyNote
            icon={BookText}
            title="Nenhum registro para esse tipo"
            description="Nada foi registrado com esse filtro ainda. Limpe o filtro para ver o livro completo."
            action={
              <Button variant="outline" onClick={() => setEntity("all")}>
                Limpar filtro
              </Button>
            }
          />
        )
      ) : (
        <PaperPanel className="p-5">
          <SectionHeading hint="mais recentes primeiro">
            {entries.length} {entries.length === 1 ? "registro" : "registros"}
          </SectionHeading>
          <ul className="mt-3 space-y-3">
            {entries.map((entry) => {
              const href =
                entry.entity === "vehicle" && entry.entityId
                  ? `/vehicles/${entry.entityId}`
                  : entry.entity === "driver" && entry.entityId
                    ? `/drivers/${entry.entityId}`
                    : entry.entity === "document" || entry.entity === "maintenance"
                      ? "/vehicles"
                      : entry.entity === "member" || entry.entity === "company"
                        ? "/settings"
                        : entry.entity === "workspace"
                          ? "/setup"
                          : null;
              return (
                <LogEntry
                  key={entry.id}
                  title={
                    <>
                      <span className="font-medium">
                        {labelFrom(ACTIVITY_ACTION_LABELS, entry.action)} {entry.entityLabel}
                      </span>{" "}
                      <span className="text-muted-foreground">{entry.summary}</span>
                    </>
                  }
                  changes={entry.changes}
                  meta={
                    <>
                      {entry.actorName} · {timeAgo(entry.createdAt)}
                      {href ? (
                        <>
                          {" · "}
                          <Link to={href} className="text-pen hover:underline">
                            abrir registro
                          </Link>
                        </>
                      ) : null}
                    </>
                  }
                />
              );
            })}
          </ul>
        </PaperPanel>
      )}
    </div>
  );
}
