import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/notebook";
import {
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_LABELS,
  toDateInput,
} from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export type VehicleFormRecord = {
  id: string;
  unitNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  plate: string | null;
  fuelType: string;
  transmission?: string | null;
  odometer: number;
  ownershipType: string;
  acquisitionDate?: number | null;
  acquisitionCost: number | null;
  currentValue: number | null;
  leaseEndDate?: number | null;
  insurancePolicy?: string | null;
  insuranceExpiry: number | null;
  registrationExpiry: number | null;
  nextServiceDate: number | null;
  nextServiceOdometer: number | null;
  status: string;
  depot: string | null;
  notes: string | null;
  assignedDriver: { id: string; name: string } | null;
};

type Values = Record<string, string>;

function blankValues(): Values {
  return {
    unitNumber: "",
    vehicleType: "truck",
    make: "",
    model: "",
    year: "",
    vin: "",
    plate: "",
    fuelType: "diesel",
    transmission: "automatic",
    odometer: "",
    ownershipType: "owned",
    acquisitionDate: "",
    acquisitionCost: "",
    currentValue: "",
    leaseEndDate: "",
    insurancePolicy: "",
    insuranceExpiry: "",
    registrationExpiry: "",
    nextServiceDate: "",
    nextServiceOdometer: "",
    status: "active",
    assignedDriverId: "",
    depot: "",
    notes: "",
  };
}

function valuesFrom(vehicle: VehicleFormRecord): Values {
  return {
    unitNumber: vehicle.unitNumber,
    vehicleType: vehicle.vehicleType,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ? String(vehicle.year) : "",
    vin: vehicle.vin ?? "",
    plate: vehicle.plate ?? "",
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission ?? "automatic",
    odometer: String(vehicle.odometer),
    ownershipType: vehicle.ownershipType,
    acquisitionDate: toDateInput(vehicle.acquisitionDate),
    acquisitionCost: vehicle.acquisitionCost !== null ? String(vehicle.acquisitionCost) : "",
    currentValue: vehicle.currentValue !== null ? String(vehicle.currentValue) : "",
    leaseEndDate: toDateInput(vehicle.leaseEndDate),
    insurancePolicy: vehicle.insurancePolicy ?? "",
    insuranceExpiry: toDateInput(vehicle.insuranceExpiry),
    registrationExpiry: toDateInput(vehicle.registrationExpiry),
    nextServiceDate: toDateInput(vehicle.nextServiceDate),
    nextServiceOdometer:
      vehicle.nextServiceOdometer !== null ? String(vehicle.nextServiceOdometer) : "",
    status: vehicle.status,
    assignedDriverId: vehicle.assignedDriver?.id ?? "",
    depot: vehicle.depot ?? "",
    notes: vehicle.notes ?? "",
  };
}

function text(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function number(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function date(value: string) {
  const trimmed = value.trim();
  return trimmed ? Date.parse(`${trimmed}T00:00:00`) : undefined;
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EnumSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="paper w-full" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="paper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function optionList(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  driverOptions = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: VehicleFormRecord | null;
  driverOptions?: { id: string; name: string; assignedUnit: string | null }[];
  onSaved?: (vehicleId: string) => void;
}) {
  const createVehicle = useMutation(api.fleet.createVehicle);
  const updateVehicle = useMutation(api.fleet.updateVehicle);
  const [values, setValues] = useState<Values>(() =>
    vehicle ? valuesFrom(vehicle) : blankValues(),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.unitNumber.trim()) return setError("Give the unit a number (for example 101).");
    if (!values.make.trim()) return setError("Make is required.");
    if (!values.model.trim()) return setError("Model is required.");
    if (!values.odometer.trim()) return setError("Enter the current odometer reading.");
    if (!Number.isFinite(Number(values.odometer))) {
      return setError("Odometer must be a number.");
    }

    const payload = {
      unitNumber: values.unitNumber,
      vehicleType: values.vehicleType as never,
      make: values.make,
      model: values.model,
      year: number(values.year),
      vin: text(values.vin),
      plate: text(values.plate),
      fuelType: values.fuelType as never,
      transmission: (values.transmission || undefined) as never,
      odometer: Number(values.odometer),
      ownershipType: values.ownershipType as never,
      acquisitionDate: date(values.acquisitionDate),
      acquisitionCost: number(values.acquisitionCost),
      currentValue: number(values.currentValue),
      leaseEndDate: date(values.leaseEndDate),
      insurancePolicy: text(values.insurancePolicy),
      insuranceExpiry: date(values.insuranceExpiry),
      registrationExpiry: date(values.registrationExpiry),
      nextServiceDate: date(values.nextServiceDate),
      nextServiceOdometer: number(values.nextServiceOdometer),
      status: values.status as never,
      assignedDriverId: values.assignedDriverId
        ? (values.assignedDriverId as Id<"drivers">)
        : undefined,
      depot: text(values.depot),
      notes: text(values.notes),
    };

    setSaving(true);
    try {
      if (vehicle) {
        await updateVehicle({ vehicleId: vehicle.id as Id<"vehicles">, ...payload });
        toast.success(`Unit ${values.unitNumber} updated`);
      } else {
        const result = await createVehicle(payload);
        toast.success(`Unit ${values.unitNumber} added to the register`);
        onSaved?.(result.vehicleId as string);
      }
      onOpenChange(false);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && vehicle) setValues(valuesFrom(vehicle));
        if (next && !vehicle) setValues(blankValues());
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="paper max-h-[90vh] w-full max-w-3xl overflow-y-auto border-border p-0 sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-lg">
              {vehicle ? `Edit unit ${vehicle.unitNumber}` : "Add a vehicle"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              One entry here feeds the whole register — compliance dates, service targets and the
              driver assignment all live on this record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="required">Identification</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Unit number">
                  <Input
                    value={values.unitNumber}
                    onChange={set("unitNumber")}
                    placeholder="101"
                    className="paper font-mono"
                    autoFocus
                  />
                </Field>
                <Field label="Type">
                  <EnumSelect
                    value={values.vehicleType}
                    onChange={(next) => setValues((c) => ({ ...c, vehicleType: next }))}
                    options={optionList(VEHICLE_TYPE_LABELS)}
                    ariaLabel="Vehicle type"
                  />
                </Field>
                <Field label="Year">
                  <Input
                    value={values.year}
                    onChange={set("year")}
                    placeholder="2022"
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Make">
                  <Input value={values.make} onChange={set("make")} placeholder="Volvo" className="paper" />
                </Field>
                <Field label="Model">
                  <Input value={values.model} onChange={set("model")} placeholder="VNL 860" className="paper" />
                </Field>
                <Field label="License plate">
                  <Input value={values.plate} onChange={set("plate")} placeholder="NW-4821" className="paper font-mono uppercase" />
                </Field>
                <Field
                  label="VIN"
                  hint="17 characters — optional, but it protects against duplicate units."
                  className="sm:col-span-3"
                >
                  <Input
                    value={values.vin}
                    onChange={set("vin")}
                    placeholder="4V4NC9EH2NN654321"
                    className="paper font-mono uppercase"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="how the unit is driven and serviced">Specification</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Fuel">
                  <EnumSelect
                    value={values.fuelType}
                    onChange={(next) => setValues((c) => ({ ...c, fuelType: next }))}
                    options={optionList(FUEL_TYPE_LABELS)}
                    ariaLabel="Fuel type"
                  />
                </Field>
                <Field label="Transmission">
                  <EnumSelect
                    value={values.transmission}
                    onChange={(next) => setValues((c) => ({ ...c, transmission: next }))}
                    options={optionList(TRANSMISSION_LABELS)}
                    ariaLabel="Transmission"
                  />
                </Field>
                <Field label="Odometer">
                  <Input
                    value={values.odometer}
                    onChange={set("odometer")}
                    placeholder="288900"
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Status">
                  <EnumSelect
                    value={values.status}
                    onChange={(next) => setValues((c) => ({ ...c, status: next }))}
                    options={Object.entries(VEHICLE_STATUS_META).map(([value, meta]) => ({
                      value,
                      label: meta.label,
                    }))}
                    ariaLabel="Status"
                  />
                </Field>
                <Field label="Depot / yard">
                  <Input value={values.depot} onChange={set("depot")} placeholder="Harbour Yard" className="paper" />
                </Field>
                <Field label="Next service date">
                  <Input type="date" value={values.nextServiceDate} onChange={set("nextServiceDate")} className="paper" />
                </Field>
                <Field label="Next service odometer">
                  <Input
                    value={values.nextServiceOdometer}
                    onChange={set("nextServiceOdometer")}
                    placeholder="303900"
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Assigned driver" hint="Adding a driver here assigns the unit.">
                  <Select
                    value={values.assignedDriverId || "none"}
                    onValueChange={(next) =>
                      setValues((c) => ({ ...c, assignedDriverId: next === "none" ? "" : next }))
                    }
                  >
                    <SelectTrigger className="paper w-full" aria-label="Assigned driver">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      <SelectItem value="none">Unassigned</SelectItem>
                      {driverOptions.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                          {driver.assignedUnit ? ` (unit ${driver.assignedUnit})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="cost basis for future reporting">Ownership and value</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Ownership">
                  <EnumSelect
                    value={values.ownershipType}
                    onChange={(next) => setValues((c) => ({ ...c, ownershipType: next }))}
                    options={optionList(OWNERSHIP_LABELS)}
                    ariaLabel="Ownership type"
                  />
                </Field>
                <Field label="Acquired on">
                  <Input type="date" value={values.acquisitionDate} onChange={set("acquisitionDate")} className="paper" />
                </Field>
                <Field label="Lease ends">
                  <Input type="date" value={values.leaseEndDate} onChange={set("leaseEndDate")} className="paper" />
                </Field>
                <Field label="Acquisition cost">
                  <Input
                    value={values.acquisitionCost}
                    onChange={set("acquisitionCost")}
                    placeholder="148000"
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Current value">
                  <Input
                    value={values.currentValue}
                    onChange={set("currentValue")}
                    placeholder="112000"
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="we flag anything inside 45 days">Compliance dates</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Insurance policy">
                  <Input
                    value={values.insurancePolicy}
                    onChange={set("insurancePolicy")}
                    placeholder="POL-1019932"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Insurance expires">
                  <Input type="date" value={values.insuranceExpiry} onChange={set("insuranceExpiry")} className="paper" />
                </Field>
                <Field label="Registration expires">
                  <Input
                    type="date"
                    value={values.registrationExpiry}
                    onChange={set("registrationExpiry")}
                    className="paper"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Notes</SectionHeading>
              <Textarea
                value={values.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Anything the next person to touch this unit should know."
                className="paper"
              />
            </section>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-stamp-bad/40 bg-stamp-bad/5 px-3 py-2 text-sm text-stamp-bad"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {vehicle ? "Save changes" : "Add to register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
