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
        <LoadingNote label="Abrindo o prontuário do motorista…" />
      </AppShell>
    );
  }

  if (data === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={IdCard}
          title="Esse motorista não está na sua equipe"
          description="O registro pode ter sido removido, ou o link pertence a outra empresa."
          action={
            <Button asChild>
              <Link to="/drivers">Voltar à equipe</Link>
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
      toast.success(`${driver.name} removido da equipe`);
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
            <ArrowLeft className="size-4" aria-hidden="true" /> Equipe de motoristas
          </Link>
        </Button>

        <PaperPanel className="p-5">
          <PageHeader
            eyebrow="Prontuário do motorista"
            title={driver.name}
            description={`${labelFrom(COMPENSATION_LABELS, driver.compensationModel)}${driver.depot ? ` · ${driver.depot}` : ""}`}
            actions={
              <>
                <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                  <Pencil className="size-4" aria-hidden="true" /> Editar registro
                </Button>
                {canDelete ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 text-stamp-bad">
                        <Trash2 className="size-4" aria-hidden="true" /> Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="paper">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {driver.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O motorista sai da equipe e qualquer unidade vinculada é liberada. Esta ação
                          não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter o motorista</AlertDialogCancel>
                        <AlertDialogAction onClick={remove}>Remover motorista</AlertDialogAction>
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
                Categoria {driver.licenseClass}
              </Stamp>
            ) : null}
            {driver.phone ? (
              <span className="font-mono text-xs text-muted-foreground">{driver.phone}</span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="CNH"
              value={driver.licenseExpiry ? formatDate(driver.licenseExpiry) : "—"}
              hint={driver.licenseNumber}
              tone={license.tone}
            />
            <KpiCard
              label="Exame toxicológico"
              value={driver.medicalExpiry ? formatDate(driver.medicalExpiry) : "—"}
              hint={medical.label}
              tone={medical.tone}
            />
            <KpiCard
              label="Unidade"
              value={assignedVehicle ? `Unidade ${assignedVehicle.unitNumber}` : "—"}
              hint={
                assignedVehicle
                  ? `${assignedVehicle.make} ${assignedVehicle.model} · ${formatDistance(assignedVehicle.odometer, distanceUnit)}`
                  : "Nenhuma unidade vinculada"
              }
              tone={assignedVehicle ? "ok" : "info"}
            />
            <KpiCard
              label="Remuneração"
              value={
                driver.rate !== null
                  ? driver.compensationModel === "salary"
                    ? formatCurrency(driver.rate, currency)
                    : driver.compensationModel === "hourly"
                      ? `${currency} ${driver.rate}/h`
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
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="credentials">Credenciais</TabsTrigger>
            <TabsTrigger value="assignment">Unidade vinculada</TabsTrigger>
            <TabsTrigger value="notes">Observações</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="na equipe">Motorista</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Nome">{driver.name}</LedgerRow>
                <LedgerRow label="Situação">{meta.label}</LedgerRow>
                <LedgerRow label="Telefone" mono>
                  {driver.phone}
                </LedgerRow>
                <LedgerRow label="E-mail">{driver.email}</LedgerRow>
                <LedgerRow label="Endereço">{driver.addressLine}</LedgerRow>
                <LedgerRow label="Cidade">{driver.city}</LedgerRow>
                <LedgerRow label="Admissão">{formatDate(driver.hireDate)}</LedgerRow>
                <LedgerRow label="Base / pátio">{driver.depot}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="como ele é remunerado">Remuneração</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Modelo">
                  {labelFrom(COMPENSATION_LABELS, driver.compensationModel)}
                </LedgerRow>
                <LedgerRow label="Valor" mono>
                  {driver.rate !== null
                    ? driver.compensationModel === "salary"
                      ? `${formatCurrency(driver.rate, currency)} / ano`
                      : driver.compensationModel === "hourly"
                        ? `${currency} ${formatNumber(driver.rate)} / h`
                        : driver.compensationModel === "per_mile"
                          ? `${currency} ${driver.rate} / ${distanceUnit}`
                          : driver.compensationModel === "per_trip"
                            ? `${currency} ${formatNumber(driver.rate)} / viagem`
                            : formatCurrency(driver.rate, currency)
                    : null}
                </LedgerRow>
                <LedgerRow label="Contato de emergência">{driver.emergencyContactName}</LedgerRow>
                <LedgerRow label="Telefone de emergência" mono>
                  {driver.emergencyContactPhone}
                </LedgerRow>
              </LedgerList>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="credentials" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="avisamos com 45 dias de antecedência">CNH</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Número" mono>
                  {driver.licenseNumber}
                </LedgerRow>
                <LedgerRow label="Categoria">{driver.licenseClass}</LedgerRow>
                <LedgerRow label="Vence em">{formatDate(driver.licenseExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={license.tone}>{license.label}</Stamp>
              </div>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="aptidão do motorista">Exame toxicológico</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Vence em">{formatDate(driver.medicalExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={medical.tone}>{medical.label}</Stamp>
              </div>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="assignment" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="qual unidade ele opera">Unidade atual</SectionHeading>
              {assignedVehicle ? (
                <>
                  <LedgerList className="mt-3">
                    <LedgerRow label="Unidade" mono>
                      <Link
                        to={`/vehicles/${assignedVehicle.id}`}
                        className="font-mono hover:text-pen hover:underline"
                      >
                        {assignedVehicle.unitNumber}
                      </Link>
                    </LedgerRow>
                    <LedgerRow label="Veículo">
                      {assignedVehicle.make} {assignedVehicle.model}
                    </LedgerRow>
                    <LedgerRow label="Hodômetro" mono>
                      {formatDistance(assignedVehicle.odometer, distanceUnit)}
                    </LedgerRow>
                    <LedgerRow label="Situação da unidade">
                      <Stamp tone={statusMeta(VEHICLE_STATUS_META, assignedVehicle.status).tone}>
                        {statusMeta(VEHICLE_STATUS_META, assignedVehicle.status).label}
                      </Stamp>
                    </LedgerRow>
                  </LedgerList>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to={`/vehicles/${assignedVehicle.id}`}>Abrir prontuário da unidade</Link>
                  </Button>
                </>
              ) : (
                <div className="mt-3">
                  <EmptyNote
                    title="Nenhuma unidade vinculada"
                    description="Vincule uma unidade pelo formulário deste motorista — os dois registros ficam sincronizados automaticamente."
                    action={
                      <Button className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                        <Pencil className="size-4" aria-hidden="true" /> Vincular unidade
                      </Button>
                    }
                  />
                </div>
              )}
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="disponíveis no cadastro">Opções de veículo</SectionHeading>
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
                        {option.taken ? "com motorista" : "livre"}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    Nenhum veículo no cadastro ainda.{" "}
                    <Link to="/vehicles" className="text-pen underline">
                      Adicionar veículo
                    </Link>
                    .
                  </li>
                )}
              </ul>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="notes">
            <PaperPanel className="p-5">
              <SectionHeading hint="texto livre, visível para toda a equipe">Observações</SectionHeading>
              <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-ink">
                {driver.notes || "Nenhuma observação sobre este motorista ainda."}
              </p>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="activity">
            <PaperPanel className="p-5">
              <SectionHeading hint={`${activity.length} registro(s)`}>Histórico de atividades</SectionHeading>
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
                  Nada mudou neste motorista desde que entrou na equipe.
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
