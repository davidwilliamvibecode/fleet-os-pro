import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
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
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_LABELS,
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
import { ArrowLeft, Pencil, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const { currency, distanceUnit, role, org } = useWorkspace();
  const data = useQuery(
    api.fleet.vehicleDetail,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip",
  );
  const deleteVehicle = useMutation(api.fleet.deleteVehicle);
  const [editOpen, setEditOpen] = useState(false);

  if (data === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Pulling the unit file…" />
      </AppShell>
    );
  }

  if (data === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={Truck}
          title="That unit is not in your register"
          description="The record may have been removed, or the link belongs to another company."
          action={
            <Button asChild>
              <Link to="/vehicles">Back to the register</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { vehicle, driver, activity, driverOptions } = data;
  const meta = statusMeta(VEHICLE_STATUS_META, vehicle.status);
  const canEdit = canEditFleet(role);
  const canDelete = canManageCompany(role);
  const service = expiryInfo(vehicle.nextServiceDate, 21);
  const insurance = expiryInfo(vehicle.insuranceExpiry);
  const registration = expiryInfo(vehicle.registrationExpiry);

  async function remove() {
    try {
      await deleteVehicle({ vehicleId: vehicle.id });
      toast.success(`Unit ${vehicle.unitNumber} removed from the register`);
      navigate("/vehicles");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
          <Link to="/vehicles">
            <ArrowLeft className="size-4" aria-hidden="true" /> Fleet register
          </Link>
        </Button>

        <PaperPanel className="p-5">
          <PageHeader
            eyebrow={`${labelFrom(VEHICLE_TYPE_LABELS, vehicle.vehicleType)} file`}
            title={`Unit ${vehicle.unitNumber}`}
            description={`${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.make} ${vehicle.model}${
              vehicle.plate ? ` · plate ${vehicle.plate}` : ""
            }`}
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
                        <AlertDialogTitle>Remove unit {vehicle.unitNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The record leaves the register and the driver is released. This cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep the unit</AlertDialogCancel>
                        <AlertDialogAction onClick={remove}>Remove unit</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </>
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Stamp tone={meta.tone}>{meta.label}</Stamp>
            <Stamp tone="neutral" rotate={false}>
              {labelFrom(FUEL_TYPE_LABELS, vehicle.fuelType)}
            </Stamp>
            <Stamp tone="neutral" rotate={false}>
              {labelFrom(OWNERSHIP_LABELS, vehicle.ownershipType)}
            </Stamp>
            {vehicle.vin ? (
              <span className="font-mono text-xs text-muted-foreground">VIN {vehicle.vin}</span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Odometer"
              value={formatDistance(vehicle.odometer, distanceUnit)}
              hint={
                vehicle.odometerUpdatedAt
                  ? `Read on ${formatDate(vehicle.odometerUpdatedAt)}`
                  : "No reading recorded yet"
              }
            />
            <KpiCard
              label="Assigned driver"
              value={driver ? driver.name.split(" ")[0] : "—"}
              hint={
                driver ? `Licence ${driver.licenseNumber}` : "Nobody is assigned to this unit"
              }
              tone={driver ? "ok" : "info"}
            />
            <KpiCard
              label="Next service"
              value={vehicle.nextServiceDate ? formatDate(vehicle.nextServiceDate) : "—"}
              hint={
                vehicle.nextServiceOdometer
                  ? `Or at ${formatDistance(vehicle.nextServiceOdometer, distanceUnit)}`
                  : service.label
              }
              tone={service.tone}
            />
            <KpiCard
              label="Documents flagged"
              value={
                [insurance, registration].filter((item) => item.tone !== "ok").length === 0
                  ? "Clear"
                  : `${[insurance, registration].filter((item) => item.tone !== "ok").length}`
              }
              hint="Insurance and registration outlook"
              tone={
                [insurance, registration].some((item) => item.tone === "bad")
                  ? "bad"
                  : [insurance, registration].some((item) => item.tone === "warn")
                    ? "warn"
                    : "ok"
              }
            />
          </div>
        </PaperPanel>

        <Tabs defaultValue="overview" className="gap-4">
          <TabsList className="paper h-auto flex-wrap justify-start gap-1 rounded-lg border border-border p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="assignment">Assignment</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="identification">Vehicle</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Unit number" mono>
                  {vehicle.unitNumber}
                </LedgerRow>
                <LedgerRow label="Type">{labelFrom(VEHICLE_TYPE_LABELS, vehicle.vehicleType)}</LedgerRow>
                <LedgerRow label="Make and model">
                  {vehicle.year ? `${vehicle.year} ` : ""}
                  {vehicle.make} {vehicle.model}
                </LedgerRow>
                <LedgerRow label="VIN" mono>
                  {vehicle.vin}
                </LedgerRow>
                <LedgerRow label="License plate" mono>
                  {vehicle.plate}
                </LedgerRow>
                <LedgerRow label="Depot / yard">{vehicle.depot}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="how it runs">Specification</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Fuel">{labelFrom(FUEL_TYPE_LABELS, vehicle.fuelType)}</LedgerRow>
                <LedgerRow label="Transmission">
                  {vehicle.transmission
                    ? labelFrom(TRANSMISSION_LABELS, vehicle.transmission)
                    : null}
                </LedgerRow>
                <LedgerRow label="Odometer" mono>
                  {formatNumber(vehicle.odometer)} {distanceUnit}
                </LedgerRow>
                <LedgerRow label="Ownership">
                  {labelFrom(OWNERSHIP_LABELS, vehicle.ownershipType)}
                </LedgerRow>
                <LedgerRow label="Acquired">{formatDate(vehicle.acquisitionDate)}</LedgerRow>
                <LedgerRow label="Lease ends">{formatDate(vehicle.leaseEndDate)}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="cost basis">Value</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Acquisition cost" mono>
                  {formatCurrency(vehicle.acquisitionCost, currency)}
                </LedgerRow>
                <LedgerRow label="Current value" mono>
                  {formatCurrency(vehicle.currentValue, currency)}
                </LedgerRow>
                <LedgerRow label="Change" mono>
                  {vehicle.acquisitionCost !== null && vehicle.currentValue !== null
                    ? formatCurrency(vehicle.currentValue - vehicle.acquisitionCost, currency)
                    : null}
                </LedgerRow>
              </LedgerList>
              <StickyNote className="mt-4" rotate="0.8deg">
                <p className="text-xs leading-5">
                  Fuel, tyre and maintenance costs land here in the next release. Today the unit file
                  already carries the cost basis they will be measured against.
                </p>
              </StickyNote>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="record history">Record</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Added">{formatDate(vehicle.createdAt)}</LedgerRow>
                <LedgerRow label="Last updated">{formatDate(vehicle.updatedAt)}</LedgerRow>
                <LedgerRow label="Company">{org?.name}</LedgerRow>
              </LedgerList>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="compliance" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="insurance">Cover</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Policy number" mono>
                  {vehicle.insurancePolicy}
                </LedgerRow>
                <LedgerRow label="Expiry">{formatDate(vehicle.insuranceExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={insurance.tone}>{insurance.label}</Stamp>
              </div>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="registration and service">Compliance dates</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Registration expires">
                  {formatDate(vehicle.registrationExpiry)}
                </LedgerRow>
                <LedgerRow label="Next service date">{formatDate(vehicle.nextServiceDate)}</LedgerRow>
                <LedgerRow label="Next service odometer" mono>
                  {vehicle.nextServiceOdometer
                    ? `${formatNumber(vehicle.nextServiceOdometer)} ${distanceUnit}`
                    : null}
                </LedgerRow>
              </LedgerList>
              <div className="mt-3 flex flex-wrap gap-2">
                <Stamp tone={registration.tone}>Registration: {registration.label}</Stamp>
                <Stamp tone={service.tone}>Service: {service.label}</Stamp>
              </div>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="assignment" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="who runs this unit">Current driver</SectionHeading>
              {driver ? (
                <>
                  <LedgerList className="mt-3">
                    <LedgerRow label="Driver">
                      <Link to={`/drivers/${driver.id}`} className="hover:text-pen hover:underline">
                        {driver.name}
                      </Link>
                    </LedgerRow>
                    <LedgerRow label="Phone">{driver.phone}</LedgerRow>
                    <LedgerRow label="Email">{driver.email}</LedgerRow>
                    <LedgerRow label="Licence" mono>
                      {driver.licenseNumber}
                    </LedgerRow>
                    <LedgerRow label="Licence expiry">{formatDate(driver.licenseExpiry)}</LedgerRow>
                  </LedgerList>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to={`/drivers/${driver.id}`}>Open the driver file</Link>
                  </Button>
                </>
              ) : (
                <div className="mt-3">
                  <EmptyNote
                    title="No driver assigned"
                    description="Assign a driver from this unit's edit form, or from the driver's own file. Either way both records stay in step."
                    action={
                      <Button className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                        <Pencil className="size-4" aria-hidden="true" /> Assign a driver
                      </Button>
                    }
                  />
                </div>
              )}
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="everyone on the roster">Available drivers</SectionHeading>
              <ul className="mt-3 space-y-2">
                {driverOptions.length ? (
                  driverOptions.map((option) => (
                    <li
                      key={option.id}
                      className="flex items-center justify-between gap-2 border-b border-dashed border-border/60 pb-2 text-sm last:border-0"
                    >
                      <Link to={`/drivers/${option.id}`} className="hover:text-pen hover:underline">
                        {option.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.assignedUnit ? `unit ${option.assignedUnit}` : "unassigned"}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    No drivers on the roster yet.{" "}
                    <Link to="/drivers" className="text-pen underline">
                      Add a driver
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
                {vehicle.notes || "No notes on this unit yet."}
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
                  Nothing has changed on this unit since it joined the register.
                </p>
              )}
            </PaperPanel>
          </TabsContent>
        </Tabs>
      </div>

      <VehicleFormDialog
        key={vehicle.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        vehicle={vehicle}
        driverOptions={driverOptions}
      />
    </AppShell>
  );
}
