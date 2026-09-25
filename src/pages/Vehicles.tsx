import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { VehicleFormDialog } from "@/components/vehicle-form";
import {
  EmptyNote,
  LoadingNote,
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
        `Loaded ${result.vehicles} sample vehicles and ${result.drivers} sample drivers`,
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
        eyebrow="Fleet register"
        title="Vehicles"
        description="Every unit you operate — identification, mileage, ownership and the compliance dates we watch for you."
        actions={
          <>
            {registerIsEmpty && canEdit ? (
              <Button variant="outline" className="gap-2" onClick={loadSamples} disabled={seeding}>
                <Sparkles className="size-4" aria-hidden="true" />
                {seeding ? "Loading…" : "Load sample fleet"}
              </Button>
            ) : null}
            <Button
              className="gap-2"
              onClick={() => setFormOpen(true)}
              disabled={!canEdit}
              title={canEdit ? undefined : "Your role has read-only access"}
            >
              <Plus className="size-4" aria-hidden="true" /> Add vehicle
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
              Search
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
                placeholder="Unit, plate, VIN, make, driver…"
                className="paper pl-9"
              />
            </div>
          </div>
          <div className="w-48">
            <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
              Status
            </span>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="paper mt-1.5 w-full" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="paper">
                <SelectItem value="all">All statuses</SelectItem>
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
              <X className="size-4" aria-hidden="true" /> Clear
            </Button>
          ) : null}
          <p className="ml-auto font-mono text-xs text-muted-foreground">
            {data === undefined ? "counting…" : `${formatNumber(total)} unit${total === 1 ? "" : "s"}`}
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
            title="No vehicles have been added yet"
            description="Add your first vehicle to start tracking mileage, compliance dates, service intervals and the driver who runs it. If you would rather look around first, load a fictional sample fleet."
            action={
              canEdit ? (
                <>
                  <Button className="gap-2" onClick={() => setFormOpen(true)}>
                    <Plus className="size-4" aria-hidden="true" /> Add your first vehicle
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={loadSamples} disabled={seeding}>
                    <Sparkles className="size-4" aria-hidden="true" />
                    {seeding ? "Loading…" : "Load sample fleet"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ask an owner, admin or fleet manager to add vehicles.
                </p>
              )
            }
          />
        ) : (
          <EmptyNote
            icon={Search}
            title="No units match those filters"
            description="Try a shorter search term, or clear the filters to see the whole register again."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Clear filters
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
                    Unit {sortIcon("unit")}
                  </button>
                </TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                  >
                    Status {sortIcon("status")}
                  </button>
                </TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("odometer")}
                    className="ml-auto flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                  >
                    Odometer {sortIcon("odometer")}
                  </button>
                </TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Next service</TableHead>
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
                        <span className="text-muted-foreground">Unassigned</span>
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
