import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { VehicleFormDialog } from "@/components/vehicle-form";
import { MaintenanceFormDialog } from "@/components/maintenance-form";
import { VehicleDocumentFormDialog } from "@/components/vehicle-document-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canEditFleet, canManageCompany, useWorkspace } from "@/hooks/use-workspace";
import { errorMessage } from "@/lib/errors";
import {
  ACTIVITY_ACTION_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  FUEL_TYPE_LABELS,
  MAINTENANCE_TYPE_LABELS,
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
import {
  ArrowLeft,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const TAB_BY_HASH: Record<string, string> = {
  manutencao: "maintenance",
  documentos: "documents",
  conformidade: "compliance",
  ativacao: "assignment",
  atividade: "activity",
};

function documentStatusTone(status: string) {
  if (status === "pago") return "ok" as const;
  if (status === "atrasado") return "bad" as const;
  return "warn" as const;
}

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const { currency, distanceUnit, role, org } = useWorkspace();
  const data = useQuery(
    api.fleet.vehicleDetail,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip",
  );
  const deleteVehicle = useMutation(api.fleet.deleteVehicle);
  const deleteMaintenance = useMutation(api.maintenance.deleteMaintenance);
  const updateDocumentStatus = useMutation(api.maintenance.updateVehicleDocumentStatus);
  const deleteDocument = useMutation(api.maintenance.deleteVehicleDocument);

  const [editOpen, setEditOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return TAB_BY_HASH[hash] ?? "overview";
  });

  const maintenanceList = useQuery(
    api.maintenance.listMaintenance,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip",
  );
  const documents = useQuery(
    api.maintenance.listVehicleDocuments,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip",
  );

  if (data === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Abrindo o prontuário da unidade…" />
      </AppShell>
    );
  }

  if (data === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={Truck}
          title="Essa unidade não está no seu cadastro"
          description="O registro pode ter sido removido, ou o link pertence a outra empresa."
          action={
            <Button asChild>
              <Link to="/vehicles">Voltar ao cadastro</Link>
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
  const pendingDocuments = (documents ?? []).filter((doc) => doc.status !== "pago");
  const maintenanceCost = (maintenanceList ?? []).reduce((sum, row) => sum + (row.cost ?? 0), 0);

  async function remove() {
    try {
      await deleteVehicle({ vehicleId: vehicle.id });
      toast.success(`Unidade ${vehicle.unitNumber} removida do cadastro`);
      navigate("/vehicles");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeMaintenance(recordId: string) {
    try {
      await deleteMaintenance({ recordId: recordId as Id<"maintenanceRecords"> });
      toast.success("Registro de manutenção removido");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function changeDocumentStatus(docId: string, status: string) {
    try {
      await updateDocumentStatus({
        docId: docId as Id<"vehicleDocuments">,
        status: status as never,
      });
      toast.success("Situação do documento atualizada");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeDocument(docId: string) {
    try {
      await deleteDocument({ docId: docId as Id<"vehicleDocuments"> });
      toast.success("Documento removido");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
          <Link to="/vehicles">
            <ArrowLeft className="size-4" aria-hidden="true" /> Cadastro de veículos
          </Link>
        </Button>

        <PaperPanel className="p-5">
          <PageHeader
            eyebrow={`${labelFrom(VEHICLE_TYPE_LABELS, vehicle.vehicleType)} · prontuário`}
            title={`Unidade ${vehicle.unitNumber}`}
            description={`${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.make} ${vehicle.model}${
              vehicle.plate ? ` · placa ${vehicle.plate}` : ""
            }`}
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
                        <AlertDialogTitle>Remover a unidade {vehicle.unitNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O registro sai do cadastro e o motorista é liberado. Esta ação não pode ser
                          desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter a unidade</AlertDialogCancel>
                        <AlertDialogAction onClick={remove}>Remover unidade</AlertDialogAction>
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
              <span className="font-mono text-xs text-muted-foreground">Chassi {vehicle.vin}</span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Hodômetro"
              value={formatDistance(vehicle.odometer, distanceUnit)}
              hint={
                vehicle.odometerUpdatedAt
                  ? `Lido em ${formatDate(vehicle.odometerUpdatedAt)}`
                  : "Nenhuma leitura registrada ainda"
              }
            />
            <KpiCard
              label="Motorista vinculado"
              value={driver ? driver.name.split(" ")[0] : "—"}
              hint={driver ? `CNH ${driver.licenseNumber}` : "Ninguém está vinculado a esta unidade"}
              tone={driver ? "ok" : "info"}
            />
            <KpiCard
              label="Próxima revisão"
              value={vehicle.nextServiceDate ? formatDate(vehicle.nextServiceDate) : "—"}
              hint={
                vehicle.nextServiceOdometer
                  ? `Ou em ${formatDistance(vehicle.nextServiceOdometer, distanceUnit)}`
                  : service.label
              }
              tone={service.tone}
            />
            <KpiCard
              label="Documentos pendentes"
              value={documents === undefined ? "…" : `${pendingDocuments.length}`}
              hint={
                pendingDocuments.some((doc) => doc.status === "atrasado")
                  ? "Há impostos/documentos atrasados"
                  : "Impostos, taxas e renovações"
              }
              tone={pendingDocuments.some((doc) => doc.status === "atrasado") ? "bad" : pendingDocuments.length ? "warn" : "ok"}
            />
          </div>
        </PaperPanel>

        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="paper h-auto flex-wrap justify-start gap-1 rounded-lg border border-border p-1">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="compliance">Conformidade</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5">
              <Wrench className="size-3.5" aria-hidden="true" /> Manutenção
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="size-3.5" aria-hidden="true" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="assignment">Vinculação</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
            <TabsTrigger value="notes">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="identificação">Veículo</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Número da unidade" mono>
                  {vehicle.unitNumber}
                </LedgerRow>
                <LedgerRow label="Tipo">{labelFrom(VEHICLE_TYPE_LABELS, vehicle.vehicleType)}</LedgerRow>
                <LedgerRow label="Marca e modelo">
                  {vehicle.year ? `${vehicle.year} ` : ""}
                  {vehicle.make} {vehicle.model}
                </LedgerRow>
                <LedgerRow label="Chassi (VIN)" mono>
                  {vehicle.vin}
                </LedgerRow>
                <LedgerRow label="Placa" mono>
                  {vehicle.plate}
                </LedgerRow>
                <LedgerRow label="Base / pátio">{vehicle.depot}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="como ele roda">Especificação</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Combustível">{labelFrom(FUEL_TYPE_LABELS, vehicle.fuelType)}</LedgerRow>
                <LedgerRow label="Transmissão">
                  {vehicle.transmission
                    ? labelFrom(TRANSMISSION_LABELS, vehicle.transmission)
                    : null}
                </LedgerRow>
                <LedgerRow label="Hodômetro" mono>
                  {formatNumber(vehicle.odometer)} {distanceUnit}
                </LedgerRow>
                <LedgerRow label="Propriedade">
                  {labelFrom(OWNERSHIP_LABELS, vehicle.ownershipType)}
                </LedgerRow>
                <LedgerRow label="Adquirido em">{formatDate(vehicle.acquisitionDate)}</LedgerRow>
                <LedgerRow label="Fim do contrato">{formatDate(vehicle.leaseEndDate)}</LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="base de custo">Valor</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Custo de aquisição" mono>
                  {formatCurrency(vehicle.acquisitionCost, currency)}
                </LedgerRow>
                <LedgerRow label="Valor atual" mono>
                  {formatCurrency(vehicle.currentValue, currency)}
                </LedgerRow>
                <LedgerRow label="Variação" mono>
                  {vehicle.acquisitionCost !== null && vehicle.currentValue !== null
                    ? formatCurrency(vehicle.currentValue - vehicle.acquisitionCost, currency)
                    : null}
                </LedgerRow>
                <LedgerRow label="Manutenções registradas" mono>
                  {maintenanceList === undefined
                    ? "…"
                    : `${maintenanceList.length} · ${formatCurrency(maintenanceCost, currency)}`}
                </LedgerRow>
              </LedgerList>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="histórico do registro">Registro</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Cadastrado em">{formatDate(vehicle.createdAt)}</LedgerRow>
                <LedgerRow label="Última atualização">{formatDate(vehicle.updatedAt)}</LedgerRow>
                <LedgerRow label="Empresa">{org?.name}</LedgerRow>
              </LedgerList>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="compliance" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="seguro">Cobertura</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Apólice" mono>
                  {vehicle.insurancePolicy}
                </LedgerRow>
                <LedgerRow label="Vencimento">{formatDate(vehicle.insuranceExpiry)}</LedgerRow>
              </LedgerList>
              <div className="mt-3">
                <Stamp tone={insurance.tone}>{insurance.label}</Stamp>
              </div>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="licenciamento e revisão">Datas de conformidade</SectionHeading>
              <LedgerList className="mt-3">
                <LedgerRow label="Licenciamento vence">
                  {formatDate(vehicle.registrationExpiry)}
                </LedgerRow>
                <LedgerRow label="Próxima revisão">{formatDate(vehicle.nextServiceDate)}</LedgerRow>
                <LedgerRow label="Hodômetro da próxima revisão" mono>
                  {vehicle.nextServiceOdometer
                    ? `${formatNumber(vehicle.nextServiceOdometer)} ${distanceUnit}`
                    : null}
                </LedgerRow>
              </LedgerList>
              <div className="mt-3 flex flex-wrap gap-2">
                <Stamp tone={registration.tone}>Licenciamento: {registration.label}</Stamp>
                <Stamp tone={service.tone}>Revisão: {service.label}</Stamp>
              </div>
            </PaperPanel>
          </TabsContent>

          <TabsContent value="maintenance">
            <PaperPanel className="p-5">
              <SectionHeading
                icon={Wrench}
                hint={
                  maintenanceList === undefined
                    ? "carregando…"
                    : `${maintenanceList.length} registro(s) · ${formatCurrency(maintenanceCost, currency)}`
                }
              >
                Registros de manutenção
              </SectionHeading>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  className="gap-2"
                  onClick={() => setMaintenanceOpen(true)}
                  disabled={!canEdit}
                  title={canEdit ? undefined : "Seu papel é somente leitura"}
                >
                  <Plus className="size-4" aria-hidden="true" /> Registrar manutenção
                </Button>
                <p className="text-xs text-muted-foreground">
                  Serviços realizados, peças trocadas, valores, quilometragem e local.
                </p>
              </div>

              {maintenanceList === undefined ? (
                <p className="mt-4 text-sm text-muted-foreground">Carregando registros…</p>
              ) : maintenanceList.length === 0 ? (
                <div className="mt-4">
                  <EmptyNote
                    icon={Wrench}
                    title="Nenhuma manutenção registrada"
                    description="Registre o primeiro serviço para acompanhar preventivas, custos e a próxima revisão desta unidade."
                  />
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-dashed divide-border/60">
                  {maintenanceList.map((record) => (
                    <li key={record.id} className="flex flex-col gap-2 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stamp tone="info" rotate={false}>
                          {labelFrom(MAINTENANCE_TYPE_LABELS, record.maintenanceType)}
                        </Stamp>
                        <span className="text-sm font-medium text-ink">{record.description}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDate(record.serviceDate)}
                        </span>
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto text-stamp-bad"
                            aria-label="Remover registro"
                            onClick={() => removeMaintenance(record.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                        <span>
                          <span className="font-medium text-ink">Quilometragem:</span>{" "}
                          {formatNumber(record.odometerAtService)} {distanceUnit}
                        </span>
                        <span>
                          <span className="font-medium text-ink">Valor:</span>{" "}
                          {formatCurrency(record.cost, currency)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {record.location || record.vendor || "Local não informado"}
                        </span>
                        <span className="sm:col-span-2 lg:col-span-3">
                          <span className="font-medium text-ink">Peças trocadas:</span>{" "}
                          {record.partsReplaced || "—"}
                        </span>
                        {record.nextServiceDate || record.nextServiceOdometer ? (
                          <span className="sm:col-span-2 lg:col-span-3">
                            <span className="font-medium text-ink">Próxima revisão:</span>{" "}
                            {record.nextServiceDate ? formatDate(record.nextServiceDate) : "—"}
                            {record.nextServiceOdometer
                              ? ` · ${formatNumber(record.nextServiceOdometer)} ${distanceUnit}`
                              : ""}
                          </span>
                        ) : null}
                        {record.notes ? (
                          <span className="sm:col-span-2 lg:col-span-3">{record.notes}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PaperPanel>
          </TabsContent>

          <TabsContent value="documents">
            <PaperPanel className="p-5">
              <SectionHeading
                icon={FileText}
                hint={
                  documents === undefined
                    ? "carregando…"
                    : `${pendingDocuments.length} pendente(s) de ${documents.length}`
                }
              >
                Documentos, impostos e renovações
              </SectionHeading>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  className="gap-2"
                  onClick={() => setDocumentOpen(true)}
                  disabled={!canEdit}
                  title={canEdit ? undefined : "Seu papel é somente leitura"}
                >
                  <Plus className="size-4" aria-hidden="true" /> Novo documento
                </Button>
                <p className="text-xs text-muted-foreground">
                  IPVA, licenciamento, seguro, DPVAT, inspeção, TAF, ANTT e outros.
                </p>
              </div>

              {documents === undefined ? (
                <p className="mt-4 text-sm text-muted-foreground">Carregando documentos…</p>
              ) : documents.length === 0 ? (
                <div className="mt-4">
                  <EmptyNote
                    icon={FileText}
                    title="Nenhum documento cadastrado"
                    description="Cadastre os impostos e renovações desta unidade para receber alertas de vencimento no painel e no sino."
                  />
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-dashed divide-border/60">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Stamp tone="neutral" rotate={false}>
                        {labelFrom(DOCUMENT_TYPE_LABELS, doc.documentType)}
                      </Stamp>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{doc.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          Vencimento: {formatDate(doc.dueDate)} · Valor:{" "}
                          {formatCurrency(doc.amount, currency)}
                          {doc.paidAt ? ` · Pago em ${formatDate(doc.paidAt)}` : ""}
                        </span>
                      </span>
                      <Stamp tone={documentStatusTone(doc.status)} rotate={false}>
                        {labelFrom(DOCUMENT_STATUS_LABELS, doc.status)}
                      </Stamp>
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={doc.status}
                            onValueChange={(value) => changeDocumentStatus(doc.id, value)}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs" aria-label="Alterar situação">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-stamp-bad"
                            aria-label="Remover documento"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </PaperPanel>
          </TabsContent>

          <TabsContent value="assignment" className="grid gap-5 lg:grid-cols-2">
            <PaperPanel className="p-5">
              <SectionHeading hint="quem opera esta unidade">Motorista atual</SectionHeading>
              {driver ? (
                <>
                  <LedgerList className="mt-3">
                    <LedgerRow label="Motorista">
                      <Link to={`/drivers/${driver.id}`} className="hover:text-pen hover:underline">
                        {driver.name}
                      </Link>
                    </LedgerRow>
                    <LedgerRow label="Telefone">{driver.phone}</LedgerRow>
                    <LedgerRow label="E-mail">{driver.email}</LedgerRow>
                    <LedgerRow label="CNH" mono>
                      {driver.licenseNumber}
                    </LedgerRow>
                    <LedgerRow label="Validade da CNH">{formatDate(driver.licenseExpiry)}</LedgerRow>
                  </LedgerList>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to={`/drivers/${driver.id}`}>Abrir prontuário do motorista</Link>
                  </Button>
                </>
              ) : (
                <div className="mt-3">
                  <EmptyNote
                    title="Nenhum motorista vinculado"
                    description="Vincule um motorista pelo formulário desta unidade, ou pelo prontuário do próprio motorista. Os dois registros ficam sincronizados."
                    action={
                      <Button className="gap-2" onClick={() => setEditOpen(true)} disabled={!canEdit}>
                        <Pencil className="size-4" aria-hidden="true" /> Vincular motorista
                      </Button>
                    }
                  />
                </div>
              )}
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading hint="todos da equipe">Motoristas disponíveis</SectionHeading>
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
                        {option.assignedUnit ? `unidade ${option.assignedUnit}` : "sem unidade"}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    Nenhum motorista na equipe ainda.{" "}
                    <Link to="/drivers" className="text-pen underline">
                      Adicionar motorista
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
                {vehicle.notes || "Nenhuma observação nesta unidade ainda."}
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
                  Nada mudou nesta unidade desde que entrou no cadastro.
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
      {vehicleId ? (
        <>
          <MaintenanceFormDialog
            open={maintenanceOpen}
            onOpenChange={setMaintenanceOpen}
            vehicleId={vehicleId}
            vehicleUnit={vehicle.unitNumber}
            currentOdometer={vehicle.odometer}
          />
          <VehicleDocumentFormDialog
            open={documentOpen}
            onOpenChange={setDocumentOpen}
            vehicleId={vehicleId}
            vehicleUnit={vehicle.unitNumber}
          />
        </>
      ) : null}
    </AppShell>
  );
}
