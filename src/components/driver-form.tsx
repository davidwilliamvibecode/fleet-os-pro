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
import { COMPENSATION_LABELS, DRIVER_STATUS_META, toDateInput } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export type DriverFormRecord = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  addressLine?: string | null;
  city: string | null;
  licenseNumber: string;
  licenseClass: string | null;
  licenseExpiry: number | null;
  medicalExpiry: number | null;
  hireDate: number | null;
  status: string;
  compensationModel: string;
  rate: number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  depot: string | null;
  notes: string | null;
  assignedVehicleId?: string | null;
};

type Values = Record<string, string>;

function blankValues(assignedVehicleId = ""): Values {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    addressLine: "",
    city: "",
    licenseNumber: "",
    licenseClass: "",
    licenseExpiry: "",
    medicalExpiry: "",
    hireDate: "",
    status: "active",
    compensationModel: "per_mile",
    rate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    depot: "",
    notes: "",
    assignedVehicleId,
  };
}

function valuesFrom(driver: DriverFormRecord): Values {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone ?? "",
    email: driver.email ?? "",
    addressLine: driver.addressLine ?? "",
    city: driver.city ?? "",
    licenseNumber: driver.licenseNumber,
    licenseClass: driver.licenseClass ?? "",
    licenseExpiry: toDateInput(driver.licenseExpiry),
    medicalExpiry: toDateInput(driver.medicalExpiry),
    hireDate: toDateInput(driver.hireDate),
    status: driver.status,
    compensationModel: driver.compensationModel,
    rate: driver.rate !== null && driver.rate !== undefined ? String(driver.rate) : "",
    emergencyContactName: driver.emergencyContactName ?? "",
    emergencyContactPhone: driver.emergencyContactPhone ?? "",
    depot: driver.depot ?? "",
    notes: driver.notes ?? "",
    assignedVehicleId: driver.assignedVehicleId ?? "",
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

export function DriverFormDialog({
  open,
  onOpenChange,
  driver,
  vehicleOptions = [],
  defaultVehicleId = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: DriverFormRecord | null;
  vehicleOptions?: { id: string; label: string; taken: boolean }[];
  defaultVehicleId?: string;
  onSaved?: (driverId: string) => void;
}) {
  const createDriver = useMutation(api.fleet.createDriver);
  const updateDriver = useMutation(api.fleet.updateDriver);
  const [values, setValues] = useState<Values>(() =>
    driver ? valuesFrom(driver) : blankValues(defaultVehicleId),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.firstName.trim()) return setError("First name is required.");
    if (!values.lastName.trim()) return setError("Last name is required.");
    if (!values.licenseNumber.trim()) return setError("License number is required.");

    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: text(values.phone),
      email: text(values.email),
      addressLine: text(values.addressLine),
      city: text(values.city),
      licenseNumber: values.licenseNumber,
      licenseClass: text(values.licenseClass),
      licenseExpiry: date(values.licenseExpiry),
      medicalExpiry: date(values.medicalExpiry),
      hireDate: date(values.hireDate),
      status: values.status as never,
      compensationModel: values.compensationModel as never,
      rate: number(values.rate),
      emergencyContactName: text(values.emergencyContactName),
      emergencyContactPhone: text(values.emergencyContactPhone),
      depot: text(values.depot),
      notes: text(values.notes),
      assignedVehicleId: values.assignedVehicleId
        ? (values.assignedVehicleId as Id<"vehicles">)
        : undefined,
    };

    setSaving(true);
    try {
      if (driver) {
        await updateDriver({ driverId: driver.id as Id<"drivers">, ...payload });
        toast.success(`${values.firstName} ${values.lastName} updated`);
      } else {
        const result = await createDriver(payload);
        toast.success(`${values.firstName} ${values.lastName} added to the roster`);
        onSaved?.(result.driverId as string);
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
        if (next) setValues(driver ? valuesFrom(driver) : blankValues(defaultVehicleId));
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="paper max-h-[90vh] w-full max-w-3xl overflow-y-auto border-border p-0 sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-lg">
              {driver ? `Edit ${driver.firstName} ${driver.lastName}` : "Add a driver"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Credentials, pay model and the unit they run all live on this one record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="required">Driver</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input value={values.firstName} onChange={set("firstName")} className="paper" autoFocus />
                </Field>
                <Field label="Last name">
                  <Input value={values.lastName} onChange={set("lastName")} className="paper" />
                </Field>
                <Field label="Phone">
                  <Input value={values.phone} onChange={set("phone")} placeholder="(415) 555-0117" className="paper" />
                </Field>
                <Field label="Email">
                  <Input value={values.email} onChange={set("email")} type="email" className="paper" />
                </Field>
                <Field label="Address">
                  <Input value={values.addressLine} onChange={set("addressLine")} className="paper" />
                </Field>
                <Field label="City">
                  <Input value={values.city} onChange={set("city")} className="paper" />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="we flag renewals inside 45 days">Licence and credentials</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Licence number">
                  <Input
                    value={values.licenseNumber}
                    onChange={set("licenseNumber")}
                    placeholder="CA-D8841207"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Class">
                  <Input value={values.licenseClass} onChange={set("licenseClass")} placeholder="A" className="paper" />
                </Field>
                <Field label="Licence expires">
                  <Input type="date" value={values.licenseExpiry} onChange={set("licenseExpiry")} className="paper" />
                </Field>
                <Field label="Medical card expires">
                  <Input type="date" value={values.medicalExpiry} onChange={set("medicalExpiry")} className="paper" />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="feeds cost-per-mile later on">Employment</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Hire date">
                  <Input type="date" value={values.hireDate} onChange={set("hireDate")} className="paper" />
                </Field>
                <Field label="Status">
                  <Select
                    value={values.status}
                    onValueChange={(next) => setValues((c) => ({ ...c, status: next }))}
                  >
                    <SelectTrigger className="paper w-full" aria-label="Employment status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      {Object.entries(DRIVER_STATUS_META).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pay model">
                  <Select
                    value={values.compensationModel}
                    onValueChange={(next) => setValues((c) => ({ ...c, compensationModel: next }))}
                  >
                    <SelectTrigger className="paper w-full" aria-label="Compensation model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      {Object.entries(COMPENSATION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rate">
                  <Input
                    value={values.rate}
                    onChange={set("rate")}
                    placeholder="0.62"
                    inputMode="decimal"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Depot / yard">
                  <Input value={values.depot} onChange={set("depot")} className="paper" />
                </Field>
                <Field
                  label="Assigned unit"
                  hint="Assigning here updates the vehicle record too."
                  className="sm:col-span-3"
                >
                  <Select
                    value={values.assignedVehicleId || "none"}
                    onValueChange={(next) =>
                      setValues((c) => ({ ...c, assignedVehicleId: next === "none" ? "" : next }))
                    }
                  >
                    <SelectTrigger className="paper w-full" aria-label="Assigned unit">
                      <SelectValue placeholder="No unit" />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      <SelectItem value="none">No unit assigned</SelectItem>
                      {vehicleOptions.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                          {vehicle.taken ? " (has a driver)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Emergency contact</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={values.emergencyContactName}
                    onChange={set("emergencyContactName")}
                    className="paper"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={values.emergencyContactPhone}
                    onChange={set("emergencyContactPhone")}
                    className="paper"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Notes</SectionHeading>
              <Textarea value={values.notes} onChange={set("notes")} rows={3} className="paper" />
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
              {driver ? "Save changes" : "Add to roster"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
