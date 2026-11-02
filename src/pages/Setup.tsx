import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { VehicleFormDialog } from "@/components/vehicle-form";
import { DriverFormDialog } from "@/components/driver-form";
import {
  LoadingNote,
  PageHeader,
  PaperPanel,
  SectionHeading,
  Stamp,
  StickyNote,
} from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISTANCE_UNITS, VOLUME_UNITS } from "@/convex/constants";
import { errorMessage } from "@/lib/errors";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  IdCard,
  Loader2,
  ListChecks,
  Sparkles,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "UTC",
];

function CreateCompanyForm() {
  const { workspace } = useWorkspace();
  const createOrg = useMutation(api.team.createOrganization);
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    currency: "BRL",
    distanceUnit: "km",
    volumeUnit: "l",
    timeZone: "America/Sao_Paulo",
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createOrg({
        name: values.name.trim(),
        currency: values.currency.trim().toUpperCase(),
        distanceUnit: values.distanceUnit as "mi" | "km",
        volumeUnit: values.volumeUnit as "gal" | "l",
        timeZone: values.timeZone,
      });
      toast.success("Espaço de trabalho criado — bem-vindo a bordo");
      navigate("/setup");
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8">
      <PageHeader
        eyebrow="Bem-vindo ao Fleet OS Pro"
        title="Crie sua empresa"
        description="Um espaço de trabalho por empresa. Seus veículos, motoristas e registros serão privados desta conta — ninguém de outra empresa consegue ver nada."
      />
      <PaperPanel className="p-4">
        <p className="font-medium">Vai entrar na empresa de alguém?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie seu identificador ao proprietário. Ele libera seu acesso em
          Configurações → Equipe. Você não precisa criar outra empresa.
        </p>
        <code className="mt-2 block select-all break-all rounded bg-muted p-2 text-xs">
          {workspace?.user.id}
        </code>
      </PaperPanel>
      <form onSubmit={submit}>
        <PaperPanel className="p-5">
          <SectionHeading
            icon={Building2}
            hint="você pode alterar tudo isso depois"
          >
            Dados básicos
          </SectionHeading>
          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="setup-name">Nome da empresa</Label>
              <Input
                id="setup-name"
                value={values.name}
                onChange={(event) =>
                  setValues((c) => ({ ...c, name: event.target.value }))
                }
                placeholder="Transportadora Rota Certa Ltda."
                required
                maxLength={80}
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="setup-currency">Moeda</Label>
                <Input
                  id="setup-currency"
                  value={values.currency}
                  onChange={(event) =>
                    setValues((c) => ({
                      ...c,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                  maxLength={3}
                  required
                  className="mt-1.5 font-mono uppercase"
                />
              </div>
              <div>
                <Label>Distância</Label>
                <Select
                  value={values.distanceUnit}
                  onValueChange={(v) =>
                    setValues((c) => ({ ...c, distanceUnit: v }))
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTANCE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "mi" ? "Milhas" : "Quilômetros"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Volume de combustível</Label>
                <Select
                  value={values.volumeUnit}
                  onValueChange={(v) =>
                    setValues((c) => ({ ...c, volumeUnit: v }))
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "gal" ? "Galões" : "Litros"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuso horário</Label>
                <Select
                  value={values.timeZone}
                  onValueChange={(v) =>
                    setValues((c) => ({ ...c, timeZone: v }))
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TIME_ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-dashed border-border/70 pt-4">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Criar espaço de trabalho
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Você será o proprietário, com acesso total.
            </p>
          </div>
        </PaperPanel>
      </form>
      <StickyNote rotate="-0.8deg">
        <p className="text-sm font-semibold">Por que começar pela empresa?</p>
        <p className="mt-1 text-sm leading-6">
          O Fleet OS Pro foi feito para equipes. A empresa é a fronteira que
          mantém seu cadastro privado e permite convidar despachantes, mecânicos
          e financeiro com o nível certo de acesso depois.
        </p>
      </StickyNote>
    </div>
  );
}

function SetupChecklist() {
  const { org, role } = useWorkspace();
  const progress = useQuery(api.fleet.setupProgress);
  const completeSetup = useMutation(api.team.completeSetup);
  const seedDemo = useMutation(api.fleet.seedDemoFleet);
  const navigate = useNavigate();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const canEdit =
    role === "owner" || role === "admin" || role === "fleet_manager";

  if (progress === undefined || progress === null) {
    return <LoadingNote label="Verificando sua configuração…" />;
  }

  const checklist = [
    {
      label: "Dados da empresa preenchidos",
      done: true,
      hint: org?.name,
      icon: Building2,
    },
    {
      label: "Primeiro veículo no cadastro",
      done: progress.hasVehicle,
      hint: progress.hasVehicle
        ? "Adicionado"
        : "Cadastre as unidades que você opera",
      icon: Truck,
      action: (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setVehicleOpen(true)}
          disabled={!canEdit}
        >
          <Truck className="size-3.5" aria-hidden="true" /> Adicionar veículo
        </Button>
      ),
    },
    {
      label: "Primeiro motorista na equipe",
      done: progress.hasDriver,
      hint: progress.hasDriver ? "Adicionado" : "Cadastre quem dirige",
      icon: IdCard,
      action: (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setDriverOpen(true)}
          disabled={!canEdit}
        >
          <IdCard className="size-3.5" aria-hidden="true" /> Adicionar motorista
        </Button>
      ),
    },
  ];
  const done = checklist.filter((item) => item.done).length;

  async function loadSamples() {
    setSeeding(true);
    try {
      const result = await seedDemo({});
      toast.success(
        `Carregados ${result.vehicles} veículos e ${result.drivers} motoristas de exemplo`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSeeding(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await completeSetup({});
      toast.success("Configuração concluída — o cadastro é seu");
      navigate("/dashboard");
    } catch (error) {
      toast.error(errorMessage(error));
      setFinishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${org?.name ?? "Sua empresa"} · primeiros passos`}
        title="Lista de configuração"
        description="Três passos rápidos e o cadastro está no ar. Tudo o que você inserir aqui fica privado da sua empresa e registrado no livro de registros."
        actions={
          <Stamp
            tone={done === checklist.length ? "ok" : "info"}
            rotate={false}
          >
            {done} de {checklist.length} concluído
          </Stamp>
        }
      />

      <PaperPanel className="p-5">
        <SectionHeading icon={ListChecks}>A lista</SectionHeading>
        <ul className="mt-4 divide-y divide-dashed divide-border/60">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex flex-wrap items-center gap-3 py-3.5"
            >
              {item.done ? (
                <CheckCircle2
                  className="size-5 shrink-0 text-stamp-ok"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${item.done ? "text-muted-foreground line-through" : "text-ink"}`}
                >
                  {item.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {item.hint}
                </span>
              </span>
              {!item.done && item.action ? item.action : null}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-dashed border-border/70 pt-4">
          <Button onClick={finish} disabled={finishing} className="gap-2">
            {finishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {done === checklist.length
              ? "Concluir configuração"
              : "Ir direto para o painel"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          {!progress.hasVehicle && canEdit ? (
            <Button
              variant="outline"
              onClick={loadSamples}
              disabled={seeding}
              className="gap-2"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {seeding ? "Carregando…" : "Carregar frota de exemplo"}
            </Button>
          ) : null}
        </div>
      </PaperPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <PaperPanel className="p-5">
          <SectionHeading icon={Truck} hint="o que vem depois">
            Depois da configuração
          </SectionHeading>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-muted-foreground">
            <li>
              <Link to="/vehicles" className="text-pen underline">
                O cadastro
              </Link>{" "}
              lista cada unidade com seguro, licenciamento e revisões
              monitorados para você.
            </li>
            <li>
              <Link to="/drivers" className="text-pen underline">
                A equipe
              </Link>{" "}
              acompanha CNH e exame toxicológico, e vincula cada motorista à sua
              unidade.
            </li>
            <li>
              A vinculação é um único campo — no veículo ou no motorista, os
              dois registros ficam sincronizados.
            </li>
            <li>
              <Link to="/settings?tab=logbook" className="text-pen underline">
                O livro de registros
              </Link>{" "}
              grava cada alteração, para você sempre saber quem fez o quê.
            </li>
          </ul>
        </PaperPanel>
        <StickyNote rotate="1deg">
          <p className="text-sm font-semibold">Uma dica de estrada</p>
          <p className="mt-1 text-sm leading-6">
            Informe o hodômetro e as datas de vencimento ao cadastrar cada
            unidade. A partir daí o Fleet OS Pro levanta a bandeira no sino e no
            painel — semanas antes do documento vencer, não depois.
          </p>
        </StickyNote>
      </div>

      <VehicleFormDialog open={vehicleOpen} onOpenChange={setVehicleOpen} />
      <DriverFormDialog open={driverOpen} onOpenChange={setDriverOpen} />
    </div>
  );
}

export default function SetupPage() {
  const { workspace, org } = useWorkspace();

  if (workspace === undefined) {
    return (
      <AppShell>
        <LoadingNote label="Abrindo a configuração…" />
      </AppShell>
    );
  }

  return (
    <AppShell>{org ? <SetupChecklist /> : <CreateCompanyForm />}</AppShell>
  );
}
