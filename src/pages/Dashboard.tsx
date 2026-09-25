import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { DriverFormDialog } from "@/components/driver-form";
import { VehicleFormDialog } from "@/components/vehicle-form";
import {
  EmptyNote,
  KpiCard,
  LedgerList,
  LedgerRow,
  LoadingNote,
  LogEntry,
  PageHeader,
  PaperPanel,
  SectionHeading,
  Stamp,
  StickyNote,
} from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { canEditFleet, useWorkspace } from "@/hooks/use-workspace";
import {
  ACTIVITY_ACTION_LABELS,
  DRIVER_STATUS_META,
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_LABELS,
  formatCurrency,
  formatDistance,
  formatNumber,
  labelFrom,
  pluralize,
  statusMeta,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Fuel,
  Gauge,
  IdCard,
  NotebookPen,
  Plus,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export default function DashboardPage() {
  const { org, currency, distanceUnit, role } = useWorkspace();
  const dashboard = useQuery(api.fleet.dashboard);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const canEdit = canEditFleet(role);

  if (dashboard === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Opening the register…" />
      </AppShell>
    );
  }

  if (dashboard === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={NotebookPen}
          title="No company yet"
          description="Create your company profile and Fleet Command will start keeping the register for you."
          action={
            <Button asChild>
              <Link to="/setup">Start setup</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { counts, value, odometer, utilization, attention, attentionCounts, setup } = dashboard;
  const hasFleet = counts.vehicles > 0;
  const hasDrivers = counts.drivers > 0;
  const checklist = [
    { label: "Company details", done: Boolean(setup.hasOrgDetails) },
    { label: "First vehicle on the register", done: setup.hasVehicle },
    { label: "First driver on the roster", done: setup.hasDriver },
  ];
  const checklistDone = checklist.filter((item) => item.done).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow={`${org?.name ?? "Your company"} · fleet register`}
          title="Command center"
          description="Everything the owner needs at a glance: what is on the road, what is standing still, and what paperwork is about to lapse."
          actions={
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDriverOpen(true)}
                disabled={!canEdit}
                title={canEdit ? undefined : "Your role has read-only access"}
              >
                <IdCard className="size-4" aria-hidden="true" /> Add driver
              </Button>
              <Button
                className="gap-2"
                onClick={() => setVehicleOpen(true)}
                disabled={!canEdit}
                title={canEdit ? undefined : "Your role has read-only access"}
              >
                <Plus className="size-4" aria-hidden="true" /> Add vehicle
              </Button>
            </>
          }
        />

        {checklistDone < checklist.length ? (
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <PaperPanel className="flex flex-col gap-3 p-5">
              <SectionHeading icon={NotebookPen} hint={`${checklistDone} of ${checklist.length} done`}>
                Setup checklist
              </SectionHeading>
              <ul className="space-y-1.5">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2.5 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-stamp-ok" aria-hidden="true" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className={cn(item.done && "text-muted-foreground line-through")}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="self-start gap-2" asChild>
                <Link to="/setup">
                  Open the checklist <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </PaperPanel>
            <StickyNote rotate="1.2deg">
              <p className="font-hand text-xl">Start here</p>
              <p className="mt-1 leading-6">
                Add your units first, then your drivers. Assigning a driver to a vehicle is a single
                dropdown — Fleet Command keeps both records in step for you.
              </p>
            </StickyNote>
          </div>
        ) : null}

        <section aria-label="Fleet totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Vehicles on register"
            value={formatNumber(counts.vehicles)}
            hint={`${counts.inService} in service · ${counts.retired} retired or sold`}
            icon={Truck}
            tape
          />
          <KpiCard
            label="Drivers"
            value={formatNumber(counts.drivers)}
            hint={`${counts.activeDrivers} active · ${counts.unassignedDrivers} without a unit`}
            icon={IdCard}
            tone={counts.unassignedDrivers ? "warn" : "neutral"}
          />
          <KpiCard
            label="Utilisation"
            value={`${utilization}%`}
            hint={`${counts.assigned} of ${counts.inService} in-service units assigned`}
            icon={BadgeCheck}
            tone={utilization >= 70 ? "ok" : utilization > 0 ? "warn" : "neutral"}
          />
          <KpiCard
            label="Documents flagged"
            value={formatNumber(attentionCounts.total)}
            hint={`${attentionCounts.critical} overdue · ${attentionCounts.warning} expiring soon`}
            icon={AlertTriangle}
            tone={attentionCounts.critical ? "bad" : attentionCounts.warning ? "warn" : "ok"}
          />
          <KpiCard
            label="Book value"
            value={formatCurrency(value.bookValue, currency)}
            hint={`Acquired for ${formatCurrency(value.acquisitionTotal, currency)}`}
            icon={Wallet}
          />
          <KpiCard
            label="Depreciation to date"
            value={formatCurrency(value.depreciation, currency)}
            hint="Acquisition cost less current value"
            icon={Wallet}
          />
          <KpiCard
            label="Distance on the clock"
            value={formatDistance(odometer.total, distanceUnit)}
            hint={`Average ${formatDistance(odometer.average, distanceUnit)} per unit`}
            icon={Gauge}
          />
          <KpiCard
            label="Highest odometer"
            value={formatDistance(odometer.highest.odometer, distanceUnit)}
            hint={`Unit ${odometer.highest.unit}`}
            icon={Fuel}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <PaperPanel id="attention" className="p-5">
            <SectionHeading
              icon={AlertTriangle}
              hint={attention.length ? `${attention.length} open` : "all clear"}
            >
              Needs attention
            </SectionHeading>
            {attention.length ? (
              <ul className="mt-3 divide-y divide-dashed divide-border/60">
                {attention.slice(0, 9).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <Stamp tone={item.severity === "critical" ? "bad" : item.severity === "warning" ? "warn" : "info"}>
                        {item.kind}
                      </Stamp>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {hasFleet
                  ? "Every compliance date is comfortably in the future. Nothing is overdue."
                  : "Add your first unit and Fleet Command will start watching insurance, registration and service dates for you."}
              </p>
            )}
          </PaperPanel>

          <div className="flex flex-col gap-5">
            <PaperPanel className="p-5">
              <SectionHeading icon={Truck} hint={`${counts.vehicles} total`}>
                Register board
              </SectionHeading>
              {hasFleet ? (
                <ul className="mt-3 space-y-2.5">
                  {Object.entries(counts.statusCounts)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => {
                      const meta = statusMeta(VEHICLE_STATUS_META, status);
                      const percent = Math.round((count / counts.vehicles) * 100);
                      return (
                        <li key={status} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {meta.label}
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                meta.tone === "ok"
                                  ? "bg-stamp-ok/70"
                                  : meta.tone === "warn"
                                    ? "bg-stamp-warn/70"
                                    : meta.tone === "bad"
                                      ? "bg-stamp-bad/70"
                                      : "bg-pen/60",
                              )}
                              style={{ width: `${Math.max(percent, 4)}%` }}
                            />
                          </span>
                          <span className="w-14 shrink-0 text-right font-mono text-xs text-ink tabular-nums">
                            {count} · {percent}%
                          </span>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No units yet. The register board fills in as soon as you add vehicles.
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-4 self-start" asChild>
                <Link to="/vehicles">Open the register</Link>
              </Button>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading icon={IdCard} hint={`${counts.activeDrivers} active`}>
                Driver roster
              </SectionHeading>
              {dashboard.driverRoster.length ? (
                <LedgerList className="mt-2">
                  {dashboard.driverRoster.map((driver) => {
                    const meta = statusMeta(DRIVER_STATUS_META, driver.status);
                    return (
                      <LedgerRow key={driver.id} label={driver.vehicleUnit ? `Unit ${driver.vehicleUnit}` : "Unassigned"}>
                        <Link className="hover:text-pen hover:underline" to={`/drivers/${driver.id}`}>
                          {driver.name}
                        </Link>
                        <span className="ml-2">
                          <Stamp tone={meta.tone}>{meta.label}</Stamp>
                        </span>
                      </LedgerRow>
                    );
                  })}
                </LedgerList>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {hasDrivers
                    ? "No active drivers on the roster right now."
                    : "Add your drivers so the register knows who runs each unit."}
                </p>
              )}
            </PaperPanel>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <PaperPanel className="p-5">
            <SectionHeading icon={NotebookPen} hint="every change is recorded">
              Log book
            </SectionHeading>
            {dashboard.recentActivity.length ? (
              <ul className="mt-3 space-y-3">
                {dashboard.recentActivity.map((entry) => (
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
                    meta={`${entry.actorName} · ${timeAgo(entry.createdAt)}`}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                The log book records every create, edit, assignment and status change.
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-2 self-start" asChild>
              <Link to="/logbook">Read the full log book</Link>
            </Button>
          </PaperPanel>

          <PaperPanel className="p-5">
            <SectionHeading icon={CalendarClock} hint="by vehicle type">
              Fleet composition
            </SectionHeading>
            {counts.typeCounts.length ? (
              <ul className="mt-3 space-y-2">
                {counts.typeCounts.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between border-b border-dashed border-border/60 pb-1.5 text-sm last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {labelFrom(VEHICLE_TYPE_LABELS, row.label)}
                    </span>
                    <span className="font-mono text-ink tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Nothing registered yet.</p>
            )}
            <p className="mt-4 font-hand text-lg text-muted-foreground">
              {pluralize(counts.vehicles, "unit")} · {pluralize(counts.drivers, "driver")}
            </p>
          </PaperPanel>
        </div>
      </div>

      <VehicleFormDialog open={vehicleOpen} onOpenChange={setVehicleOpen} />
      <DriverFormDialog open={driverOpen} onOpenChange={setDriverOpen} />
    </AppShell>
  );
}
