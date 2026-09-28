import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { DriverFormDialog } from "@/components/driver-form";
import { EmptyNote, PageHeader, PaperPanel, Stamp } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canEditFleet, useWorkspace } from "@/hooks/use-workspace";
import {
  COMPENSATION_LABELS,
  DRIVER_STATUS_META,
  expiryInfo,
  formatDate,
  formatNumber,
  labelFrom,
  statusMeta,
} from "@/lib/format";
import { useQuery } from "convex/react";
import { ArrowDown, ArrowUp, IdCard, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router";

type SortKey = "name" | "status" | "licence";

export default function DriversPage() {
  const { role, currency, distanceUnit } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc",
  });
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const canEdit = canEditFleet(role);

  const data = useQuery(api.drivers.listDrivers, { search: deferredSearch, status });

  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "status") return a.status.localeCompare(b.status) * direction;
    if (sort.key === "licence") {
      return ((a.licenseExpiry ?? 0) - (b.licenseExpiry ?? 0)) * direction;
    }
    return a.name.localeCompare(b.name) * direction;
  });

  const filtersActive = Boolean(search.trim()) || status !== "all";
  const rosterIsEmpty = data !== undefined && (data.total ?? 0) === 0 && !filtersActive;

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  const sortIcon = (key: SortKey) =>
    sort.key === key ? (
      sort.direction === "asc" ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" aria-hidden="true" />
      )
    ) : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Equipe de motoristas"
          title="Motoristas"
          description="Quem dirige para você, qual unidade opera e quando vencem a CNH e o exame toxicológico."
          actions={
            <Button
              className="gap-2"
              onClick={() => setFormOpen(true)}
              disabled={!canEdit}
              title={canEdit ? undefined : "Seu papel é somente leitura"}
            >
              <Plus className="size-4" aria-hidden="true" /> Adicionar motorista
            </Button>
          }
        />

        <PaperPanel className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label
                htmlFor="driver-search"
                className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase"
              >
                Buscar
              </label>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="driver-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, telefone, CNH, unidade…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48">
              <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                Situação
              </span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5 w-full" aria-label="Filtrar por situação">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {Object.entries(DRIVER_STATUS_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive ? (
              <Button
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                <X className="size-4" aria-hidden="true" /> Limpar
              </Button>
            ) : null}
            <p className="ml-auto font-mono text-xs text-muted-foreground">
              {data === undefined
                ? "contando…"
                : `${formatNumber(data.total)} motorista${data.total === 1 ? "" : "s"}`}
            </p>
          </div>
        </PaperPanel>

        {data === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : rows.length === 0 ? (
          rosterIsEmpty ? (
            <EmptyNote
              icon={IdCard}
              title="Nenhum motorista na equipe ainda"
              description="Cadastre seus motoristas para registrar CNH, credenciais, modelo de remuneração e a unidade que cada um opera. O Fleet Command avisa antes de qualquer renovação virar problema."
              action={
                canEdit ? (
                  <Button className="gap-2" onClick={() => setFormOpen(true)}>
                    <Plus className="size-4" aria-hidden="true" /> Adicionar o primeiro motorista
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Peça a um proprietário, administrador ou gestor de frota para adicionar motoristas.
                  </p>
                )
              }
            />
          ) : (
            <EmptyNote
              icon={Search}
              title="Nenhum motorista corresponde a esses filtros"
              description="Tente um termo mais curto de busca, ou limpe os filtros para ver a equipe inteira novamente."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          )
        ) : (
          <PaperPanel className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Motorista {sortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Situação {sortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Remuneração</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("licence")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      CNH {sortIcon("licence")}
                    </button>
                  </TableHead>
                  <TableHead>Toxicológico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const meta = statusMeta(DRIVER_STATUS_META, row.status);
                  const licence = expiryInfo(row.licenseExpiry);
                  const medical = expiryInfo(row.medicalExpiry);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/drivers/${row.id}`)}
                    >
                      <TableCell>
                        <span className="block text-sm font-medium text-ink">{row.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {row.licenseNumber}
                          {row.licenseClass ? ` · categoria ${row.licenseClass}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Stamp tone={meta.tone}>{meta.label}</Stamp>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.vehicleUnit ? (
                          <Link
                            to={`/vehicles/${row.vehicleId}`}
                            className="font-mono hover:text-pen hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.vehicleUnit}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Sem unidade</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {labelFrom(COMPENSATION_LABELS, row.compensationModel)}
                        {row.rate !== null ? (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {row.compensationModel === "salary"
                              ? `${currency} ${formatNumber(row.rate)}/ano`
                              : row.compensationModel === "hourly"
                                ? `${currency} ${row.rate}/h`
                                : row.compensationModel === "per_mile"
                                  ? `${currency} ${row.rate}/${distanceUnit}`
                                  : `${currency} ${formatNumber(row.rate)}`}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Stamp tone={licence.tone}>{licence.label}</Stamp>
                        {row.licenseExpiry ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatDate(row.licenseExpiry)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Stamp tone={medical.tone}>{medical.label}</Stamp>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </PaperPanel>
        )}
      </div>

      <DriverFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppShell>
  );
}
