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
import { useMutation, useQuery } from "convex/react";
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
      <SelectTrigger className="w-full" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
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
  // Se a página não passar a lista de motoristas, o próprio formulário a busca —
  // assim o vínculo veículo ⇄ motorista funciona de qualquer tela.
  const driversQuery = useQuery(api.drivers.listDrivers, driverOptions.length ? "skip" : {});
  const options = driverOptions.length
    ? driverOptions
    : (driversQuery?.rows ?? []).map((row) => ({
        id: row.id as string,
        name: row.name,
        assignedUnit: row.vehicleUnit,
      }));

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

    if (!values.unitNumber.trim()) return setError("Dê um número à unidade (por exemplo 101).");
    if (!values.make.trim()) return setError("A marca é obrigatória.");
    if (!values.model.trim()) return setError("O modelo é obrigatório.");
    if (!values.odometer.trim()) return setError("Informe a quilometragem atual.");
    if (!Number.isFinite(Number(values.odometer))) {
      return setError("A quilometragem deve ser um número.");
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
        toast.success(`Unidade ${values.unitNumber} atualizada`);
      } else {
        const result = await createVehicle(payload);
        toast.success(`Unidade ${values.unitNumber} adicionada ao cadastro`);
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
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border-border p-0 sm:max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-lg">
              {vehicle ? `Editar unidade ${vehicle.unitNumber}` : "Adicionar veículo"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Um único cadastro alimenta toda a operação — prazos de conformidade, alvos de revisão e
              o vínculo com o motorista ficam neste registro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="obrigatório">Identificação</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Número da unidade">
                  <Input
                    value={values.unitNumber}
                    onChange={set("unitNumber")}
                    placeholder="101"
                    className="font-mono"
                    autoFocus
                  />
                </Field>
                <Field label="Tipo">
                  <EnumSelect
                    value={values.vehicleType}
                    onChange={(next) => setValues((c) => ({ ...c, vehicleType: next }))}
                    options={optionList(VEHICLE_TYPE_LABELS)}
                    ariaLabel="Tipo de veículo"
                  />
                </Field>
                <Field label="Ano">
                  <Input
                    value={values.year}
                    onChange={set("year")}
                    placeholder="2022"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </Field>
                <Field label="Marca">
                  <Input value={values.make} onChange={set("make")} placeholder="Volvo" />
                </Field>
                <Field label="Modelo">
                  <Input value={values.model} onChange={set("model")} placeholder="FH 540" />
                </Field>
                <Field label="Placa">
                  <Input value={values.plate} onChange={set("plate")} placeholder="ABC1D23" className="font-mono uppercase" />
                </Field>
                <Field
                  label="Chassi (VIN)"
                  hint="17 caracteres — opcional, mas protege contra unidades duplicadas."
                  className="sm:col-span-3"
                >
                  <Input
                    value={values.vin}
                    onChange={set("vin")}
                    placeholder="9BWZZZ377VT004251"
                    className="font-mono uppercase"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="como a unidade roda e é mantida">Especificação</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Combustível">
                  <EnumSelect
                    value={values.fuelType}
                    onChange={(next) => setValues((c) => ({ ...c, fuelType: next }))}
                    options={optionList(FUEL_TYPE_LABELS)}
                    ariaLabel="Combustível"
                  />
                </Field>
                <Field label="Transmissão">
                  <EnumSelect
                    value={values.transmission}
                    onChange={(next) => setValues((c) => ({ ...c, transmission: next }))}
                    options={optionList(TRANSMISSION_LABELS)}
                    ariaLabel="Transmissão"
                  />
                </Field>
                <Field label="Hodômetro">
                  <Input
                    value={values.odometer}
                    onChange={set("odometer")}
                    placeholder="288900"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </Field>
                <Field label="Situação">
                  <EnumSelect
                    value={values.status}
                    onChange={(next) => setValues((c) => ({ ...c, status: next }))}
                    options={Object.entries(VEHICLE_STATUS_META).map(([value, meta]) => ({
                      value,
                      label: meta.label,
                    }))}
                    ariaLabel="Situação"
                  />
                </Field>
                <Field label="Base / pátio">
                  <Input value={values.depot} onChange={set("depot")} placeholder="Pátio Central" />
                </Field>
                <Field label="Próxima revisão (data)">
                  <Input type="date" value={values.nextServiceDate} onChange={set("nextServiceDate")} />
                </Field>
                <Field label="Próxima revisão (km)">
                  <Input
                    value={values.nextServiceOdometer}
                    onChange={set("nextServiceOdometer")}
                    placeholder="303900"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </Field>
                <Field label="Motorista vinculado" hint="Vincular aqui já atualiza o registro do motorista.">
                  <Select
                    value={values.assignedDriverId || "none"}
                    onValueChange={(next) =>
                      setValues((c) => ({ ...c, assignedDriverId: next === "none" ? "" : next }))
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Motorista vinculado">
                      <SelectValue placeholder="Sem motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem motorista</SelectItem>
                      {options.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                          {driver.assignedUnit ? ` (unidade ${driver.assignedUnit})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="base de custo para relatórios futuros">Propriedade e valor</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Propriedade">
                  <EnumSelect
                    value={values.ownershipType}
                    onChange={(next) => setValues((c) => ({ ...c, ownershipType: next }))}
                    options={optionList(OWNERSHIP_LABELS)}
                    ariaLabel="Tipo de propriedade"
                  />
                </Field>
                <Field label="Adquirido em">
                  <Input type="date" value={values.acquisitionDate} onChange={set("acquisitionDate")} />
                </Field>
                <Field label="Fim do contrato">
                  <Input type="date" value={values.leaseEndDate} onChange={set("leaseEndDate")} />
                </Field>
                <Field label="Custo de aquisição (R$)">
                  <Input
                    value={values.acquisitionCost}
                    onChange={set("acquisitionCost")}
                    placeholder="480000"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </Field>
                <Field label="Valor atual (R$)">
                  <Input
                    value={values.currentValue}
                    onChange={set("currentValue")}
                    placeholder="392000"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="avisamos com 45 dias de antecedência">Datas de conformidade</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Apólice do seguro">
                  <Input
                    value={values.insurancePolicy}
                    onChange={set("insurancePolicy")}
                    placeholder="POL-1019932"
                    className="font-mono"
                  />
                </Field>
                <Field label="Seguro vence em">
                  <Input type="date" value={values.insuranceExpiry} onChange={set("insuranceExpiry")} />
                </Field>
                <Field label="Licenciamento vence em">
                  <Input
                    type="date"
                    value={values.registrationExpiry}
                    onChange={set("registrationExpiry")}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading>Observações</SectionHeading>
              <Textarea
                value={values.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Qualquer informação que a próxima pessoa a usar esta unidade deva saber."
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
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {vehicle ? "Salvar alterações" : "Adicionar ao cadastro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
