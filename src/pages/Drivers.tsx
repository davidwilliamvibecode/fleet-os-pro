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

  const data = useQuery(api.fleet.listDrivers, { search: deferredSearch, status });

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
          eyebrow="Driver roster"
          title="Drivers"
          description="Who drives for you, which unit they run, and when their licence and medical card fall due."
          actions={
            <Button
              className="gap-2"
              onClick={() => setFormOpen(true)}
              disabled={!canEdit}
              title={canEdit ? undefined : "Your role has read-only access"}
            >
              <Plus className="size-4" aria-hidden="true" /> Add driver
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
                Search
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
                  placeholder="Name, phone, licence number, unit…"
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
                <X className="size-4" aria-hidden="true" /> Clear
              </Button>
            ) : null}
            <p className="ml-auto font-mono text-xs text-muted-foreground">
              {data === undefined
                ? "counting…"
                : `${formatNumber(data.total)} driver${data.total === 1 ? "" : "s"}`}
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
              title="No drivers on the roster yet"
              description="Add your drivers to record licences, credentials, pay model and the unit each person runs. Fleet Command flags licence renewals before they become a problem."
              action={
                canEdit ? (
                  <Button className="gap-2" onClick={() => setFormOpen(true)}>
                    <Plus className="size-4" aria-hidden="true" /> Add your first driver
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ask an owner, admin or fleet manager to add drivers.
                  </p>
                )
              }
            />
          ) : (
            <EmptyNote
              icon={Search}
              title="No drivers match those filters"
              description="Try a shorter search term, or clear the filters to see the whole roster again."
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
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Driver {sortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Status {sortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Pay model</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("licence")}
                      className="flex items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase"
                    >
                      Licence {sortIcon("licence")}
                    </button>
                  </TableHead>
                  <TableHead>Medical</TableHead>
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
                          {row.licenseClass ? ` · class ${row.licenseClass}` : ""}
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
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {labelFrom(COMPENSATION_LABELS, row.compensationModel)}
                        {row.rate !== null ? (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {row.compensationModel === "salary"
                              ? `${currency} ${formatNumber(row.rate)}/yr`
                              : row.compensationModel === "hourly"
                                ? `${currency} ${row.rate}/hr`
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
