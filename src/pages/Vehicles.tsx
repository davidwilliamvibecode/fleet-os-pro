import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { VehicleFormDialog } from "@/components/vehicle-form";
import {
  EmptyNote,
  PageHeader,
  PaperPanel,
  Stamp,
} from "@/components/notebook";
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
import { errorMessage } from "@/lib/errors";
import {
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_LABELS,
  expiryInfo,
  formatDistance,
  formatNumber,
  labelFrom,
  statusMeta,
} from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Plus, Search, Sparkles, Truck, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type SortKey = "unit" | "odometer" | "status";

export default function VehiclesPage() {
  const { distanceUnit, role } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "unit",
    direction: "asc",
  });
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const canEdit = canEditFleet(role);

  const data = useQuery(api.fleet.listVehicles, {
    search: deferredSearch,
    status,
  });
  const seedDemo = useMutation(api.fleet.seedDemoFleet);
  const [seeding, setSeeding] = useState(false);

  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "odometer") return (a.odometer - b.odometer) * direction;
    if (sort.key === "status") return a.status.localeCompare(b.status) * direction;
    return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }) * direction;
  });

  const filtersActive = Boolean(search.trim()) || status !== "all";
  const total = data?.total ?? 0;
  const registerIsEmpty = data !== undefined && total === 0 && !filtersActive;

  async function loadSamples() {
    setSeeding(true);
    try {
      const result = await seedDemo();
      toast.success(
        `Carregados ${result.vehicles} veículos e ${result.drivers} motoristas de exemplo`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSeeding(false);
    }
  }

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
          eyebrow="Cadastro da frota"
          title="Veículos"
          description="Cada unidade que você opera — identificação, quilometragem, propriedade e as datas de conformidade que monitoramos para você."
          actions={
            <>
              {registerIsEmpty && canEdit ? (
                <Button variant="outline" className="gap-2" onClick={loadSamples} disabled={seeding}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  {seeding ? "Carregando…" : "Carregar frota de exemplo"}
                </Button>
              ) : null}
              <Button
                className="gap-2"
                onClick={() => setFormOpen(true)}
                disabled={!canEdit}
                title={canEdit ? undefined : "Seu papel é somente leitura"}
              >
                <Plus className="size-4" aria-hidden="true" /> Adicionar veículo
              </Button>
            </>
          }
        />

        <PaperPanel className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label
                htmlFor="vehicle-search"
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
                  id="vehicle-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Unidade, placa, chassi, marca, motorista…"
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
                  {Object.entries(VEHICLE_STATUS_META).map(([value, meta]) => (
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
              {data === undefined ? "contando…" : `${formatNumber(total)} unidade${total === 1 ? "" : "s"}`}
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
          registerIsEmpty ? (
            <EmptyNote
              icon={Truck}
              title="Nenhum veículo cadastrado ainda"
              description="Adicione o primeiro veículo para começar a acompanhar quilometragem, prazos de conformidade, intervalos de revisão e o motorista responsável. Se preferir explorar primeiro, carregue uma frota de exemplo."
              action={
                canEdit ? (
                  <>
                    <Button className="gap-2" onClick={() => setFormOpen(true)}>
                      <Plus className="size-4" aria-hidden="true" /> Adicionar o primeiro veículo
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={loadSamples} disabled={seeding}>
                      <Sparkles className="size-4" aria-hidden="true" />
                      {seeding ? "Carregando…" : "Carregar frota de exemplo"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Peça a um proprietário, administrador ou gestor de frota para adicionar veículos.
                  </p>
                )
              }
            />
          ) : (
            <EmptyNote
              icon={Search}
              title="Nenhuma unidade corresponde a esses filtros"
              description="Tente um termo mais curto de busca, ou limpe os filtros para ver o cadastro inteiro novamente."
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
                  <TableHead className="w-24">
                    <button
                      type="button"
                      onClick={() => toggleSort("unit")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Unidade {sortIcon("unit")}
                    </button>
                  </TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Situação {sortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("odometer")}
                      className="ml-auto flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Hodômetro {sortIcon("odometer")}
                    </button>
                  </TableHead>
                  <TableHead>Seguro</TableHead>
                  <TableHead>Licenciamento</TableHead>
                  <TableHead>Próxima revisão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const meta = statusMeta(VEHICLE_STATUS_META, row.status);
                  const insurance = expiryInfo(row.insuranceExpiry);
                  const registration = expiryInfo(row.registrationExpiry);
                  const service = expiryInfo(row.nextServiceDate, 21);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/vehicles/${row.id}`)}
                    >
                      <TableCell className="font-mono font-semibold text-ink">
                        {row.unitNumber}
                      </TableCell>
                      <TableCell>
                        <span className="block text-sm text-ink">
                          {row.year ? `${row.year} ` : ""}
                          {row.make} {row.model}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {labelFrom(VEHICLE_TYPE_LABELS, row.vehicleType)}
                          {row.plate ? ` · ${row.plate}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Stamp tone={meta.tone}>{meta.label}</Stamp>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.assignedDriver ? (
                          row.assignedDriver.name
                        ) : (
                          <span className="text-muted-foreground">Sem motorista</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatDistance(row.odometer, distanceUnit)}
                      </TableCell>
                      <TableCell>
                        <Stamp tone={insurance.tone}>{insurance.label}</Stamp>
                      </TableCell>
                      <TableCell>
                        <Stamp tone={registration.tone}>{registration.label}</Stamp>
                      </TableCell>
                      <TableCell>
                        <Stamp tone={service.tone}>{service.label}</Stamp>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </PaperPanel>
        )}

        <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </AppShell>
  );
}
