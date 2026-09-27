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
import { MAINTENANCE_TYPE_LABELS, toDateInput } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { Loader2, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type Values = Record<string, string>;

function blankValues(vehicleId: string): Values {
  return {
    vehicleId,
    serviceDate: toDateInput(Date.now()),
    maintenanceType: "preventive",
    description: "",
    partsReplaced: "",
    cost: "",
    odometerAtService: "",
    location: "",
    vendor: "",
    nextServiceDate: "",
    nextServiceOdometer: "",
    notes: "",
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

export function MaintenanceFormDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleUnit,
  currentOdometer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleUnit: string;
  currentOdometer: number;
  onSaved?: () => void;
}) {
  const create = useMutation(api.maintenance.createMaintenance);
  const [values, setValues] = useState<Values>(() => blankValues(vehicleId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.description.trim()) return setError("Descreva o serviço realizado.");
    if (!values.odometerAtService.trim()) return setError("Informe a quilometragem do veículo no momento do serviço.");
    if (!Number.isFinite(Number(values.odometerAtService))) {
      return setError("A quilometragem deve ser um número.");
    }
    if (Number(values.odometerAtService) < currentOdometer) {
      return setError(`A quilometragem não pode ser menor que a última leitura (${currentOdometer.toLocaleString("pt-BR")}).`);
    }

    setSaving(true);
    try {
      await create({
        vehicleId: vehicleId as Id<"vehicles">,
        serviceDate: date(values.serviceDate) ?? Date.now(),
        maintenanceType: values.maintenanceType as never,
        description: values.description.trim(),
        partsReplaced: text(values.partsReplaced),
        cost: number(values.cost),
        odometerAtService: Number(values.odometerAtService),
        location: text(values.location),
        vendor: text(values.vendor),
        nextServiceDate: date(values.nextServiceDate),
        nextServiceOdometer: number(values.nextServiceOdometer),
        notes: text(values.notes),
      });
      toast.success(`Manutenção registrada na unidade ${vehicleUnit}`);
      setValues(blankValues(vehicleId));
      onSaved?.();
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
        if (next) setValues(blankValues(vehicleId));
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="paper max-h-[90vh] w-full max-w-2xl overflow-y-auto border-border p-0 sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wrench className="size-4 text-pen" aria-hidden="true" />
              Registrar manutenção — unidade {vehicleUnit}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Serviços realizados, peças trocadas, valores, quilometragem e local. A leitura do
              serviço atualiza o hodômetro do veículo automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="obrigatório">Serviço realizado</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data do serviço">
                  <Input type="date" value={values.serviceDate} onChange={set("serviceDate")} className="paper" />
                </Field>
                <Field label="Tipo de manutenção">
                  <Select
                    value={values.maintenanceType}
                    onValueChange={(next) => setValues((c) => ({ ...c, maintenanceType: next }))}
                  >
                    <SelectTrigger className="paper w-full" aria-label="Tipo de manutenção">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      {Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Descrição do serviço" className="sm:col-span-2">
                  <Input
                    value={values.description}
                    onChange={set("description")}
                    placeholder="Ex.: troca de pastilhas e disco de freio dianteiro"
                    className="paper"
                    autoFocus
                  />
                </Field>
                <Field label="Peças trocadas" hint="Separe por vírgula.">
                  <Input
                    value={values.partsReplaced}
                    onChange={set("partsReplaced")}
                    placeholder="Pastilhas dianteiras, disco de freio, óleo 15W40"
                    className="paper"
                  />
                </Field>
                <Field label="Valor (R$)">
                  <Input
                    value={values.cost}
                    onChange={set("cost")}
                    placeholder="1.240,90"
                    inputMode="decimal"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Quilometragem no serviço" hint={`Última leitura: ${currentOdometer.toLocaleString("pt-BR")}`}>
                  <Input
                    value={values.odometerAtService}
                    onChange={set("odometerAtService")}
                    placeholder={String(currentOdometer)}
                    inputMode="numeric"
                    className="paper font-mono"
                  />
                </Field>
                <Field label="Local onde foi realizada">
                  <Input
                    value={values.location}
                    onChange={set("location")}
                    placeholder="Oficina central — Curitiba/PR"
                    className="paper"
                  />
                </Field>
                <Field label="Oficina / fornecedor">
                  <Input
                    value={values.vendor}
                    onChange={set("vendor")}
                    placeholder="Auto Center Silva"
                    className="paper"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading hint="opcional — gera alertas">Próxima revisão</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data prevista">
                  <Input type="date" value={values.nextServiceDate} onChange={set("nextServiceDate")} className="paper" />
                </Field>
                <Field label="Quilometragem prevista">
                  <Input
                    value={values.nextServiceOdometer}
                    onChange={set("nextServiceOdometer")}
                    placeholder="303900"
                    inputMode="numeric"
                    className="paper font-mono"
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
                placeholder="Detalhes adicionais sobre o serviço, garantia, etc."
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
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Registrar manutenção
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
