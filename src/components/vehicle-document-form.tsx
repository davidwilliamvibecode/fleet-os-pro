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
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, toDateInput } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { FileText, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type Values = Record<string, string>;

function blankValues(vehicleId: string): Values {
  return {
    vehicleId,
    documentType: "licenciamento",
    title: "",
    dueDate: "",
    amount: "",
    status: "pendente",
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

export function VehicleDocumentFormDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleUnit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleUnit: string;
  onSaved?: () => void;
}) {
  const create = useMutation(api.maintenance.createVehicleDocument);
  const [values, setValues] = useState<Values>(() => blankValues(vehicleId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.title.trim()) return setError("Informe o título do documento (ex.: IPVA 2026 — Unidade 101).");

    setSaving(true);
    try {
      await create({
        vehicleId: vehicleId as Id<"vehicles">,
        documentType: values.documentType as never,
        title: values.title.trim(),
        dueDate: date(values.dueDate),
        amount: number(values.amount),
        status: values.status as never,
        notes: text(values.notes),
      });
      toast.success(`Documento cadastrado para a unidade ${vehicleUnit}`);
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
      <DialogContent className="paper max-h-[90vh] w-full max-w-xl overflow-y-auto border-border p-0 sm:max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="size-4 text-pen" aria-hidden="true" />
              Novo documento — unidade {vehicleUnit}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Impostos, renovações e taxas por veículo: IPVA, licenciamento, seguro, DPVAT,
              inspeção, TAF, ANTT e outros. Vencimentos entram nos alertas do painel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 px-6 py-5">
            <section className="space-y-4">
              <SectionHeading hint="obrigatório">Documento</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select
                    value={values.documentType}
                    onValueChange={(next) => setValues((c) => ({ ...c, documentType: next }))}
                  >
                    <SelectTrigger className="paper w-full" aria-label="Tipo de documento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Situação">
                  <Select
                    value={values.status}
                    onValueChange={(next) => setValues((c) => ({ ...c, status: next }))}
                  >
                    <SelectTrigger className="paper w-full" aria-label="Situação do documento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="paper">
                      {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Título / identificação" className="sm:col-span-2">
                  <Input
                    value={values.title}
                    onChange={set("title")}
                    placeholder="Ex.: IPVA 2026 — Unidade 101"
                    className="paper"
                    autoFocus
                  />
                </Field>
                <Field label="Vencimento" hint="Gerará alerta 30 dias antes.">
                  <Input type="date" value={values.dueDate} onChange={set("dueDate")} className="paper" />
                </Field>
                <Field label="Valor (R$)">
                  <Input
                    value={values.amount}
                    onChange={set("amount")}
                    placeholder="2.340,00"
                    inputMode="decimal"
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
                rows={2}
                placeholder="Ex.: cota única, pagamento via banco X, guia em anexo."
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
              Cadastrar documento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
