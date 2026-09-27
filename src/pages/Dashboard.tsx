import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { DriverFormDialog } from "@/components/driver-form";
import { VehicleFormDialog } from "@/components/vehicle-form";
import {
  EmptyNote,
  KpiCard,
  LoadingNote,
  LogEntry,
  PageHeader,
  PaperPanel,
  SectionHeading,
  Stamp,
} from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { canEditFleet, useWorkspace } from "@/hooks/use-workspace";
import {
  ACTIVITY_ACTION_LABELS,
  VEHICLE_TYPE_LABELS,
  formatCurrency,
  formatDistance,
  formatNumber,
  labelFrom,
  pluralize,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Fuel,
  Gauge,
  IdCard,
  Plus,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export default function DashboardPage() {
  const { org, currency, distanceUnit, role } = useWorkspace();
  const dashboard = useQuery(api.fleet.dashboard);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const canEdit = canEditFleet(role);

  if (dashboard === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Abrindo o painel…" />
      </AppShell>
    );
  }

  if (dashboard === null) {
    return (
      <AppShell>
        <EmptyNote
          icon={ClipboardList}
          title="Nenhuma empresa ainda"
          description="Crie o perfil da empresa e o Fleet Command começa a cuidar do seu cadastro para você."
          action={
            <Button asChild>
              <Link to="/setup">Começar configuração</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { counts, value, odometer, utilization, attention, attentionCounts, setup } = dashboard;
  const hasFleet = counts.vehicles > 0;
  const hasDrivers = counts.drivers > 0;
  const checklist = [
    { label: "Dados da empresa", done: Boolean(setup.hasOrgDetails) },
    { label: "Primeiro veículo no cadastro", done: setup.hasVehicle },
    { label: "Primeiro motorista na equipe", done: setup.hasDriver },
  ];
  const checklistDone = checklist.filter((item) => item.done).length;
  const maintenanceAlerts = attention.filter((item) => item.kind === "service");
  const pendingAlerts = attention.filter(
    (item) => item.kind === "compliance" || item.kind === "status",
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow={`${org?.name ?? "Sua empresa"} · painel da frota`}
          title="Centro de comando"
          description="Tudo o que o gestor precisa em uma tela: o que está rodando, o que está parado e qual documentação está prestes a vencer."
          actions={
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDriverOpen(true)}
                disabled={!canEdit}
                title={canEdit ? undefined : "Seu papel é somente leitura"}
              >
                <IdCard className="size-4" aria-hidden="true" /> Adicionar motorista
              </Button>
              <Button
                className="gap-2"
                onClick={() => setVehicleOpen(true)}
                disabled={!canEdit}
                title={canEdit ? undefined : "Seu papel é somente leitura"}
              >
                <Plus className="size-4" aria-hidden="true" /> Adicionar veículo
              </Button>
            </>
          }
        />

        {checklistDone < checklist.length ? (
          <PaperPanel className="flex flex-col gap-3 p-5">
            <SectionHeading icon={ClipboardList} hint={`${checklistDone} de ${checklist.length} concluído`}>
              Lista de configuração
            </SectionHeading>
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  {item.done ? (
                    <CheckCircle2 className="size-4 text-stamp-ok" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className={cn(item.done && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="self-start gap-2" asChild>
              <Link to="/setup">
                Abrir a lista <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </PaperPanel>
        ) : null}

        <section aria-label="Totais da frota" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Veículos no cadastro"
            value={formatNumber(counts.vehicles)}
            hint={`${counts.inService} em operação · ${counts.retired} aposentados ou vendidos`}
            icon={Truck}
          />
          <KpiCard
            label="Motoristas"
            value={formatNumber(counts.drivers)}
            hint={`${counts.activeDrivers} ativos · ${counts.unassignedDrivers} sem unidade`}
            icon={IdCard}
            tone={counts.unassignedDrivers ? "warn" : "neutral"}
          />
          <KpiCard
            label="Utilização da frota"
            value={`${utilization}%`}
            hint={`${counts.assigned} de ${counts.inService} unidades em operação com motorista`}
            icon={BadgeCheck}
            tone={utilization >= 70 ? "ok" : utilization > 0 ? "warn" : "neutral"}
          />
          <KpiCard
            label="Pendências abertas"
            value={formatNumber(attentionCounts.total)}
            hint={`${attentionCounts.critical} críticas · ${attentionCounts.warning} em alerta`}
            icon={AlertTriangle}
            tone={attentionCounts.critical ? "bad" : attentionCounts.warning ? "warn" : "ok"}
          />
          <KpiCard
            label="Valor contábil"
            value={formatCurrency(value.bookValue, currency)}
            hint={`Adquiridos por ${formatCurrency(value.acquisitionTotal, currency)}`}
            icon={Wallet}
          />
          <KpiCard
            label="Depreciação acumulada"
            value={formatCurrency(value.depreciation, currency)}
            hint="Custo de aquisição menos valor atual"
            icon={Wallet}
          />
          <KpiCard
            label="Distância acumulada"
            value={formatDistance(odometer.total, distanceUnit)}
            hint={`Média de ${formatDistance(odometer.average, distanceUnit)} por unidade`}
            icon={Gauge}
          />
          <KpiCard
            label="Maior hodômetro"
            value={formatDistance(odometer.highest.odometer, distanceUnit)}
            hint={`Unidade ${odometer.highest.unit}`}
            icon={Fuel}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <PaperPanel id="attention" className="p-5">
            <SectionHeading
              icon={AlertTriangle}
              hint={attention.length ? `${attention.length} em aberto` : "tudo em ordem"}
            >
              Precisa de atenção
            </SectionHeading>
            {attention.length ? (
              <ul className="mt-3 divide-y divide-dashed divide-border/60">
                {attention.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <Stamp
                        tone={
                          item.severity === "critical"
                            ? "bad"
                            : item.severity === "warning"
                              ? "warn"
                              : "info"
                        }
                      >
                        {item.kind === "service"
                          ? "Manutenção"
                          : item.kind === "compliance"
                            ? "Documento"
                            : item.kind === "assignment"
                              ? "Vinculação"
                              : "Status"}
                      </Stamp>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {hasFleet
                  ? "Todas as datas de conformidade estão tranquilas no futuro. Nada vencido."
                  : "Adicione a primeira unidade e o Fleet Command começa a monitorar seguro, licenciamento e revisões para você."}
              </p>
            )}
          </PaperPanel>

          <div className="flex flex-col gap-5">
            <PaperPanel className="p-5">
              <SectionHeading
                icon={Wrench}
                hint={maintenanceAlerts.length ? `${maintenanceAlerts.length} em aberto` : "em dia"}
              >
                Alertas de manutenção
              </SectionHeading>
              {maintenanceAlerts.length ? (
                <ul className="mt-3 space-y-2.5">
                  {maintenanceAlerts.slice(0, 6).map((item) => (
                    <li key={item.id} className="border-b border-dashed border-border/60 pb-2 last:border-0">
                      <Link to={item.href} className="block hover:text-pen">
                        <span className="block text-sm font-medium text-ink">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {hasFleet
                    ? "Nenhuma revisão vencida ou por vencer. Registre as manutenções para manter o histórico completo."
                    : "Registre manutenções por veículo — serviços, peças, valores, quilometragem e local."}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-4 self-start" asChild>
                <Link to="/vehicles">Ver unidades</Link>
              </Button>
            </PaperPanel>

            <PaperPanel className="p-5">
              <SectionHeading
                icon={CalendarClock}
                hint={pendingAlerts.length ? `${pendingAlerts.length} em aberto` : "em dia"}
              >
                Documentos e impostos
              </SectionHeading>
              {pendingAlerts.length ? (
                <ul className="mt-3 space-y-2.5">
                  {pendingAlerts.slice(0, 6).map((item) => (
                    <li key={item.id} className="border-b border-dashed border-border/60 pb-2 last:border-0">
                      <Link to={item.href} className="block hover:text-pen">
                        <span className="block text-sm font-medium text-ink">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhum documento, imposto ou renovação pendente no momento.
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-4 self-start" asChild>
                <Link to="/vehicles">Abrir unidades</Link>
              </Button>
            </PaperPanel>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <PaperPanel className="p-5">
            <SectionHeading icon={ClipboardList} hint="toda alteração fica registrada">
              Últimas atividades
            </SectionHeading>
            {dashboard.recentActivity.length ? (
              <ul className="mt-3 space-y-3">
                {dashboard.recentActivity.map((entry) => (
                  <LogEntry
                    key={entry.id}
                    title={
                      <>
                        <span className="font-medium">
                          {labelFrom(ACTIVITY_ACTION_LABELS, entry.action)} {entry.entityLabel}
                        </span>{" "}
                        <span className="text-muted-foreground">{entry.summary}</span>
                      </>
                    }
                    meta={`${entry.actorName} · ${timeAgo(entry.createdAt)}`}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                O livro de registros grava cada cadastro, edição, vinculação e mudança de status.
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-2 self-start" asChild>
              <Link to="/settings?tab=logbook">Ver o livro completo</Link>
            </Button>
          </PaperPanel>

          <PaperPanel className="p-5">
            <SectionHeading icon={Truck} hint="por tipo de veículo">
              Composição da frota
            </SectionHeading>
            {counts.typeCounts.length ? (
              <ul className="mt-3 space-y-2">
                {counts.typeCounts.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between border-b border-dashed border-border/60 pb-1.5 text-sm last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {labelFrom(VEHICLE_TYPE_LABELS, row.label)}
                    </span>
                    <span className="font-mono text-ink tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Nada cadastrado ainda.</p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              {pluralize(counts.vehicles, "unidade")} · {pluralize(counts.drivers, "motorista")}
              {hasDrivers ? "" : " — cadastre a equipe para vincular às unidades"}
            </p>
          </PaperPanel>
        </div>
      </div>

      <VehicleFormDialog open={vehicleOpen} onOpenChange={setVehicleOpen} />
      <DriverFormDialog open={driverOpen} onOpenChange={setDriverOpen} />
    </AppShell>
  );
}
