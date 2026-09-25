import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { DriverFormDialog } from "@/components/driver-form";
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
} from "@/components/notebook";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canEditFleet, canManageCompany, useWorkspace } from "@/hooks/use-workspace";
import { errorMessage } from "@/lib/errors";
import {
  ACTIVITY_ACTION_LABELS,
  COMPENSATION_LABELS,
  DRIVER_STATUS_META,
  VEHICLE_STATUS_META,
  expiryInfo,
  formatCurrency,
  formatDate,
  formatDistance,
  formatNumber,
  labelFrom,
  statusMeta,
  timeAgo,
} from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, IdCard, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function DriverDetailPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const { currency, distanceUnit, role } = useWorkspace();
  const data = useQuery(
    api.fleet.driverDetail,
    driverId ? { driverId: driverId as Id<"drivers"> } : "skip",
  );
  const deleteDriver = useMutation(api.fleet.deleteDriver);
  const [editOpen, setEditOpen] = useState(false);

  if (data === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Pulling the driver file…" />
      </AppShell>
    );
  }

  if (data === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={IdCard}
          title="That driver is not on your roster"
          description="The record may have been removed, or the link belongs to another company."
          action={
            <Button asChild>
              <Link to="/drivers">Back to the roster</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { driver, assignedVehicle, activity, vehicleOptions } = data;
  const meta = statusMeta(DRIVER_STATUS_META, driver.status);
  const canEdit = canEditFleet(role);
  const canDelete = canManageCompany(role);
  const license = expiryInfo(driver.licenseExpiry);
  const medical = expiryInfo(driver.medicalExpiry);

  async function remove() {
    try {
      await deleteDriver({ driverId: driver.id });
      toast.success(`${driver.name} removed from the roster`);
      navigate("/drivers");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
          <Link to="/drivers">
            <ArrowLeft className="size-4" aria-hidden="true" /> Driver roster
          </Link>
        </Button>

        <PaperPanel className="p-5">
          <PageHeader
            eyebrow="Driver file"
            title={driver.name}
            description={`${labelFrom(COMPENSATION_LABELS, driver.compensationModel)}${driver.depot ? ` · ${driver.depot}` : ""}`}
            actions={
              <>
                <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                  <Pencil className="size-4" aria-hidden="true" /> Edit record
                </Button>
                {canDelete ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 text-stamp-bad">
                        <Trash2 className="size-4" aria-hidden="true" /> Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="paper">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {driver.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The driver leaves the roster and any assigned unit is released. This
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep the driver</AlertDialogCancel>
                        <AlertDialogAction onClick={remove}>Remove driver</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </>
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Stamp tone={meta.tone}>{meta.label}</Stamp>
            {driver.licenseClass ? (
              <Stamp tone="neutral" rotate={false}>
                Class {driver.licenseClass}
              </Stamp>
            ) : null}
            {driver.phone ? (
              <span className="font-mono text-xs text-muted-foreground">{driver.phone}</span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Licence"
              value={driver.licenseExpiry ? formatDate(driver.licenseExpiry) : "—"}
              hint={driver.licenseNumber}
              tone={license.tone}
            />
            <KpiCard
              label="Medical card"
              value={driver.medicalExpiry ? formatDate(driver.medicalExpiry) : "—"}
              hint={medical.label}
              tone={medical.tone}
            />
            <KpiCard
              label="Unit"
              value={assignedVehicle ? `Unit ${assignedVehicle.unitNumber}` : "—"}
              hint={
                assignedVehicle
                  ? `${assignedVehicle.make} ${assignedVehicle.model} · ${formatDistance(assignedVehicle.odometer, distanceUnit)}`
                  : "No unit assigned"
              }
              tone={assignedVehicle ? "ok" : "info"}
            />
            <KpiCard
              label="Pay"
              value={
                driver.rate !== null
                  ? driver.compensationModel === "salary"
                    ? formatCurrency(driver.rate, currency)
                    : driver.compensationModel === "hourly"
                      ? `${currency} ${driver.rate}/hr`
                      : driver.compensationModel === "per_mile"
                        ? `${currency} ${driver.rate}/${distanceUnit}`
                        : formatCurrency(driver.rate, currency)
                  : "—"
              }
              hint={labelFrom(COMPENSATION_LABELS, driver.compensationModel)}
            />
          </div>
        </PaperPanel>

        <Tabs defaultValue="overview" className="gap-4">
          <TabsList className="paper h-auto flex-wrap justify-start gap-1 rounded-lg border border-border p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="assignment">Unit assignment</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="on the roster">Driver</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Name">{driver.name}</LedgerRow>
                <LedgerRow label="Status">{meta.label}</LedgerRow>
                <LedgerRow label="Phone" mono>
                  {driver.phone}
                </LedgerRow>
                <LedgerRow label="Email">{driver.email}</LedgerRow>
                <LedgerRow label="Address">{driver.addressLine}</LedgerRow>
                <LedgerRow label="City">{driver.city}</LedgerRow>
                <LedgerRow label="Hired">{formatDate(driver.hireDate)}</LedgerRow>
                <LedgerRow label="Depot / yard">{driver.depot}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="how they are paid">Compensation</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Model">
                  {labelFrom(COMPENSATION_LABELS, driver.compensationModel)}
                </LedgerRow>
                <LedgerRow label="Rate" mono>
                  {driver.rate !== null
                    ? driver.compensationModel === "salary"
                      ? `${formatCurrency(driver.rate, currency)} / year`
                      : driver.compensationModel === "hourly"
                        ? `${currency} ${formatNumber(driver.rate)} / hr`
                        : driver.compensationModel === "per_mile"
                          ? `${currency} ${driver.rate} / ${distanceUnit}`
                          : driver.compensationModel === "per_trip"
                            ? `${currency} ${formatNumber(driver.rate)} / trip`
                            : formatCurrency(driver.rate, currency)
                    : null}
                </LedgerRow>
                <LedgerRow label="Emergency contact">{driver.emergencyContactName}</LedgerRow>
                <LedgerRow label="Contact phone" mono>
                  {driver.emergencyContactPhone}
                </LedgerRow>
              </LedgerList>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="credentials" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="we flag anything inside 45 days">Licence</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Number" mono>
                  {driver.licenseNumber}
                </LedgerRow>
                <LedgerRow label="Class">{driver.licenseClass}</LedgerRow>
                <LedgerRow label="Expires">{formatDate(driver.licenseExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={license.tone}>{license.label}</Stamp>
              </div>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="driver fitness">Medical card</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Expires">{formatDate(driver.medicalExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={medical.tone}>{medical.label}</Stamp>
              </div>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="assignment" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="which unit they run">Current unit</SectionHeading>
              {assignedVehicle ? (
                <>
                  <LedgerList className="mt-3">
                    <LedgerRow label="Unit" mono>
                      <Link
                        to={`/vehicles/${assignedVehicle.id}`}
                        className="font-mono hover:text-pen hover:underline"
                      >
                        {assignedVehicle.unitNumber}
                      </Link>
                    </LedgerRow>
                    <LedgerRow label="Vehicle">
                      {assignedVehicle.make} {assignedVehicle.model}
                    </LedgerRow>
                    <LedgerRow label="Odometer" mono>
                      {formatDistance(assignedVehicle.odometer, distanceUnit)}
                    </LedgerRow>
                    <LedgerRow label="Unit status">
                      <Stamp tone={statusMeta(VEHICLE_STATUS_META, assignedVehicle.status).tone}>
                        {statusMeta(VEHICLE_STATUS_META, assignedVehicle.status).label}
                      </Stamp>
                    </LedgerRow>
                  </LedgerList>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to={`/vehicles/${assignedVehicle.id}`}>Open the unit file</Link>
                  </Button>
                </>
              ) : (
                <div className="mt-3">
                  <EmptyNote
                    title="No unit assigned"
                    description="Assign a unit from this driver's edit form — both records stay in step automatically."
                    action={
                      <Button className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                        <Pencil className="size-4" aria-hidden="true" /> Assign a unit
                      </Button>
                    }
                  />
                </div>
              )}
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="available in the register">Vehicle options</SectionHeading>
              <ul className="mt-3 space-y-2">
                {vehicleOptions.length ? (
                  vehicleOptions.map((option) => (
                    <li
                      key={option.id}
                      className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 pb-2 text-sm last:border-0"
                    >
                      <Link to={`/vehicles/${option.id}`} className="hover:text-pen hover:underline">
                        {option.label}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.taken ? "assigned" : "free"}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    No vehicles on the register yet.{" "}
                    <Link to="/vehicles" className="text-pen underline">
                      Add a vehicle
                    </Link>
                    .
                  </li>
                )}
              </ul>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="notes">
            <PaperPanel className="p-5">
              <SectionHeading hint="free text, visible to the whole team">Notes</SectionHeading>
              <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-ink">
                {driver.notes || "No notes on this driver yet."}
              </p>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="activity">
            <PaperPanel className="p-5">
              <SectionHeading hint={`${activity.length} entries`}>Activity history</SectionHeading>
              {activity.length ? (
                <ul className="mt-3 space-y-3">
                  {activity.map((entry) => (
                    <LogEntry
                      key={entry.id}
                      title={
                        <>
                          <span className="font-medium">
                            {labelFrom(ACTIVITY_ACTION_LABELS, entry.action)}
                          </span>{" "}
                          <span className="text-muted-foreground">{entry.summary}</span>
                        </>
                      }
                      changes={entry.changes}
                      meta={`${entry.actorName} · ${timeAgo(entry.createdAt)}`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing has changed on this driver since they joined the roster.
                </p>
              )}
            </PaperPanel>
          </TabsContent>
        </Tabs>
      </div>

      <DriverFormDialog
        key={driver.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        driver={{
          ...driver,
          assignedVehicleId: assignedVehicle?.id ?? null,
        }}
        vehicleOptions={vehicleOptions}
      />
    </AppShell>
  );
}

