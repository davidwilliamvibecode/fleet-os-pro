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
import { useMutation, useQuery } from "convex/react";
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
  const createDriver = useMutation(api.drivers.createDriver);
  const updateDriver = useMutation(api.drivers.updateDriver);
  // Se a página não passar a lista de veículos, o formulário busca sozinho —
  // o vínculo motorista ⇄ unidade funciona de qualquer tela.
  const vehiclesQuery = useQuery(api.fleet.listVehicles, vehicleOptions.length ? "skip" : {});
  const options = vehicleOptions.length
    ? vehicleOptions
    : (vehiclesQuery?.rows ?? []).map((row) => ({
        id: row.id as string,
        label: `Unidade ${row.unitNumber} · ${row.make} ${row.model}`,
        // Uma unidade ocupada por outro motorista não pode ser escolhida: o
        // servidor recusa a vinculação, então nem oferecemos a opção.
        taken: Boolean(row.assignedDriver) && row.assignedDriver?.id !== driver?.id,
      }));

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

    if (!values.firstName.trim()) return setError("O nome é obrigatório.");
    if (!values.lastName.trim()) return setError("O sobrenome é obrigatório.");
    if (!values.licenseNumber.trim()) return setError("O número da CNH é obrigatório.");

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
        toast.success(`${values.firstName} ${values.lastName} atualizado`);
      } else {
        const result = await createDriver(payload);
        toast.success(`${values.firstName} ${values.lastName} adicionado à equipe`);
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
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border-border p-0 sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-lg">
              {driver ? `Editar ${driver.firstName} ${driver.lastName}` : "Adicionar motorista"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Habilitação, modelo de remuneração e a unidade que ele opera ficam neste único
              registro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="obrigatório">Motorista</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <Input value={values.firstName} onChange={set("firstName")} autoFocus />
                </Field>
                <Field label="Sobrenome">
                  <Input value={values.lastName} onChange={set("lastName")} />
                </Field>
                <Field label="Telefone">
                  <Input value={values.phone} onChange={set("phone")} placeholder="(11) 99999-0117" />
                </Field>
                <Field label="E-mail">
                  <Input value={values.email} onChange={set("email")} type="email" />
                </Field>
                <Field label="Endereço">
                  <Input value={values.addressLine} onChange={set("addressLine")} />
                </Field>
                <Field label="Cidade">
                  <Input value={values.city} onChange={set("city")} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="avisamos sobre renovações com 45 dias">Habilitação e credenciais</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Número da CNH">
                  <Input
                    value={values.licenseNumber}
                    onChange={set("licenseNumber")}
                    placeholder="SP-8841207"
                    className="font-mono"
                  />
                </Field>
                <Field label="Categoria">
                  <Input value={values.licenseClass} onChange={set("licenseClass")} placeholder="AE" />
                </Field>
                <Field label="Validade da CNH">
                  <Input type="date" value={values.licenseExpiry} onChange={set("licenseExpiry")} />
                </Field>
                <Field label="Validade do exame toxicológico">
                  <Input type="date" value={values.medicalExpiry} onChange={set("medicalExpiry")} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="alimenta o custo por km depois">Vínculo de trabalho</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Data de admissão">
                  <Input type="date" value={values.hireDate} onChange={set("hireDate")} />
                </Field>
                <Field label="Situação">
                  <Select
                    value={values.status}
                    onValueChange={(next) => setValues((c) => ({ ...c, status: next }))}
                  >
                    <SelectTrigger className="w-full" aria-label="Situação do vínculo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DRIVER_STATUS_META).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Modelo de remuneração">
                  <Select
                    value={values.compensationModel}
                    onValueChange={(next) => setValues((c) => ({ ...c, compensationModel: next }))}
                  >
                    <SelectTrigger className="w-full" aria-label="Modelo de remuneração">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMPENSATION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor da remuneração">
                  <Input
                    value={values.rate}
                    onChange={set("rate")}
                    placeholder="2.40"
                    inputMode="decimal"
                    className="font-mono"
                  />
                </Field>
                <Field label="Base / pátio">
                  <Input value={values.depot} onChange={set("depot")} />
                </Field>
                <Field
                  label="Unidade vinculada"
                  hint="Vincular aqui também atualiza o registro do veículo."
                  className="sm:col-span-3"
                >
                  <Select
                    value={values.assignedVehicleId || "none"}
                    onValueChange={(next) =>
                      setValues((c) => ({ ...c, assignedVehicleId: next === "none" ? "" : next }))
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Unidade vinculada">
                      <SelectValue placeholder="Sem unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem unidade vinculada</SelectItem>
                      {options.map((vehicle) => (
                        <SelectItem
                          key={vehicle.id}
                          value={vehicle.id}
                          disabled={vehicle.taken}
                        >
                          {vehicle.label}
                          {vehicle.taken ? " (já tem motorista)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Contato de emergência</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <Input
                    value={values.emergencyContactName}
                    onChange={set("emergencyContactName")}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={values.emergencyContactPhone}
                    onChange={set("emergencyContactPhone")}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Observações</SectionHeading>
              <Textarea value={values.notes} onChange={set("notes")} rows={3} />
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
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {driver ? "Salvar alterações" : "Adicionar à equipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
