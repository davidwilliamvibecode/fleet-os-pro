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
  NotebookPen,
  Sparkles,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const TIME_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Australia/Sydney",
  "UTC",
];

function CreateCompanyForm() {
  const createOrg = useMutation(api.fleet.createOrganization);
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    currency: "USD",
    distanceUnit: "mi",
    volumeUnit: "gal",
    timeZone: "America/Los_Angeles",
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
      toast.success("Company workspace created — welcome aboard");
      navigate("/setup");
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8">
      <PageHeader
        eyebrow="Welcome to Fleet Command"
        title="Create your company"
        description="One workspace per company. Your vehicles, drivers and log book will be private to this account — nobody from another company can see a thing."
      />
      <form onSubmit={submit}>
        <PaperPanel className="p-5">
          <SectionHeading icon={Building2} hint="you can change all of this later">
            Company basics
          </SectionHeading>
          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="setup-name">Company name</Label>
              <Input
                id="setup-name"
                value={values.name}
                onChange={(event) => setValues((c) => ({ ...c, name: event.target.value }))}
                placeholder="Harbourline Freight Co."
                required
                maxLength={80}
                className="paper mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="setup-currency">Currency</Label>
                <Input
                  id="setup-currency"
                  value={values.currency}
                  onChange={(event) =>
                    setValues((c) => ({ ...c, currency: event.target.value.toUpperCase() }))
                  }
                  maxLength={3}
                  required
                  className="paper mt-1.5 font-mono uppercase"
                />
              </div>
              <div>
                <Label>Distance</Label>
                <Select
                  value={values.distanceUnit}
                  onValueChange={(v) => setValues((c) => ({ ...c, distanceUnit: v }))}
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper">
                    {DISTANCE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "mi" ? "Miles" : "Kilometres"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuel volume</Label>
                <Select
                  value={values.volumeUnit}
                  onValueChange={(v) => setValues((c) => ({ ...c, volumeUnit: v }))}
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper">
                    {VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "gal" ? "Gallons" : "Litres"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time zone</Label>
                <Select
                  value={values.timeZone}
                  onValueChange={(v) => setValues((c) => ({ ...c, timeZone: v }))}
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper max-h-72">
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
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Create workspace
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-xs text-muted-foreground">
              You will be the owner with full access.
            </p>
          </div>
        </PaperPanel>
      </form>
      <StickyNote rotate="-0.8deg">
        <p className="font-hand text-xl">Why a company first?</p>
        <p className="mt-1 text-sm leading-6">
          Fleet Command is built for teams. The company is the boundary that keeps your register
          private and lets you invite dispatchers, mechanics and accountants with the right level of
          access later.
        </p>
      </StickyNote>
    </div>
  );
}

function SetupChecklist() {
  const { org, role } = useWorkspace();
  const progress = useQuery(api.fleet.setupProgress);
  const completeSetup = useMutation(api.fleet.completeSetup);
  const seedDemo = useMutation(api.fleet.seedDemoFleet);
  const navigate = useNavigate();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const canEdit = role === "owner" || role === "admin" || role === "fleet_manager";

  if (progress === undefined || progress === null) {
    return <LoadingNote label="Checking your setup…" />;
  }

  const checklist = [
    {
      label: "Company details on file",
      done: true,
      hint: org?.name,
      icon: Building2,
    },
    {
      label: "First vehicle on the register",
      done: progress.hasVehicle,
      hint: progress.hasVehicle ? "Added" : "Add the units you operate",
      icon: Truck,
      action: (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setVehicleOpen(true)} disabled={!canEdit}>
          <Truck className="size-3.5" aria-hidden="true" /> Add vehicle
        </Button>
      ),
    },
    {
      label: "First driver on the roster",
      done: progress.hasDriver,
      hint: progress.hasDriver ? "Added" : "Add who drives them",
      icon: IdCard,
      action: (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDriverOpen(true)} disabled={!canEdit}>
          <IdCard className="size-3.5" aria-hidden="true" /> Add driver
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
        `Loaded ${result.vehicles} sample vehicles and ${result.drivers} sample drivers`,
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
      toast.success("Setup complete — the register is yours");
      navigate("/dashboard");
    } catch (error) {
      toast.error(errorMessage(error));
      setFinishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${org?.name ?? "Your company"} · getting started`}
        title="Setup checklist"
        description="Three quick steps and the register is live. Everything you enter here is kept private to your company and recorded in the log book."
        actions={
          <Stamp tone={done === checklist.length ? "ok" : "info"} rotate={false}>
            {done} of {checklist.length} done
          </Stamp>
        }
      />

      <PaperPanel className="p-5">
        <SectionHeading icon={NotebookPen}>The checklist</SectionHeading>
        <ul className="mt-4 divide-y divide-dashed divide-border/60">
          {checklist.map((item) => (
            <li key={item.label} className="flex flex-wrap items-center gap-3 py-3.5">
              {item.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-stamp-ok" aria-hidden="true" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${item.done ? "text-muted-foreground line-through" : "text-ink"}`}>
                  {item.label}
                </span>
                <span className="block text-xs text-muted-foreground">{item.hint}</span>
              </span>
              {!item.done && item.action ? item.action : null}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-dashed border-border/70 pt-4">
          <Button onClick={finish} disabled={finishing} className="gap-2">
            {finishing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {done === checklist.length ? "Finish setup" : "Skip ahead to the dashboard"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          {!progress.hasVehicle && canEdit ? (
            <Button variant="outline" onClick={loadSamples} disabled={seeding} className="gap-2">
              <Sparkles className="size-4" aria-hidden="true" />
              {seeding ? "Loading…" : "Load sample fleet instead"}
            </Button>
          ) : null}
        </div>
      </PaperPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <PaperPanel className="p-5">
          <SectionHeading icon={Truck} hint="what happens next">
            After setup
          </SectionHeading>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-muted-foreground">
            <li>
              <Link to="/vehicles" className="text-pen underline">The register</Link> lists every
              unit with insurance, registration and service dates watched for you.
            </li>
            <li>
              <Link to="/drivers" className="text-pen underline">The roster</Link> tracks licences
              and medical cards, and links each driver to their unit.
            </li>
            <li>
              Assigning is one dropdown — on the vehicle or the driver, both records stay in step.
            </li>
            <li>
              <Link to="/logbook" className="text-pen underline">The log book</Link> records every
              change, so you always know who did what.
            </li>
          </ul>
        </PaperPanel>
        <StickyNote rotate="1deg">
          <p className="font-hand text-xl">A tip from the road</p>
          <p className="mt-1 text-sm leading-6">
            Enter the odometer and the expiry dates when you add each unit. From then on Fleet
            Command raises the flag in the bell and on the dashboard — weeks before the paperwork
            lapses, not after.
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
        <LoadingNote label="Opening setup…" />
      </AppShell>
    );
  }

  return <AppShell>{org ? <SetupChecklist /> : <CreateCompanyForm />}</AppShell>;
}
