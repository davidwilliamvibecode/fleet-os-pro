import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookText,
  CheckCircle2,
  Gauge,
  IdCard,
  NotebookPen,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const MODULES = [
  {
    icon: Truck,
    title: "Fleet register",
    body: "Every unit on one page: identification, mileage, ownership, insurance and registration dates — watched for you.",
  },
  {
    icon: IdCard,
    title: "Driver roster",
    body: "Licences, medical cards, pay model and the unit each driver runs. Renewals are flagged before they lapse.",
  },
  {
    icon: Bell,
    title: "Compliance watch",
    body: "Insurance, registration, licence and service dates roll into one attention list with severity ranking.",
  },
  {
    icon: BookText,
    title: "Log book",
    body: "A permanent audit trail. Every create, edit and assignment is recorded with who did it and what changed.",
  },
  {
    icon: Users,
    title: "Roles that fit the yard",
    body: "Owner, admin, fleet manager, dispatcher, maintenance, finance, driver and viewer — enforced on the server, not just hidden in the UI.",
  },
  {
    icon: Gauge,
    title: "Command center",
    body: "Utilisation, book value, depreciation, distance and the open attention list, ready before your first coffee.",
  },
];

const STEPS = [
  {
    title: "Create your company",
    body: "One workspace per company, with your own currency, units and time zone.",
  },
  {
    title: "Add units and drivers",
    body: "Register vehicles, roster drivers, then link them — one dropdown, both records stay in step.",
  },
  {
    title: "Let the flags work",
    body: "Fleet Command watches expiry dates and odometer intervals and raises the flag weeks ahead.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="paper flex size-9 items-center justify-center rounded-md border border-border shadow-sm">
              <NotebookPen className="size-4 text-pen" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">
                Fleet Command
              </span>
              <span className="font-hand block text-sm text-muted-foreground">
                fleet management OS
              </span>
            </span>
          </div>
          <nav aria-label="Marketing" className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="hover:text-ink">Modules</a>
            <a href="#workflow" className="hover:text-ink">How it works</a>
            <a href="#security" className="hover:text-ink">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/auth?returnTo=%2Fsetup">
                Start free <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, var(--rule) 27px, var(--rule) 28px)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-[8%] hidden w-px bg-[var(--margin-line)] opacity-50 md:block"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <p className="font-hand text-2xl text-muted-foreground">
              Retire the spreadsheet. Run the fleet properly.
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
              The fleet management{" "}
              <span className="ink-underline">operating system</span> for working fleets.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Fleet Command centralises vehicles, drivers, compliance dates, maintenance, costs and
              the audit trail in one private company workspace. Enter it once — the register, the
              dashboard and the log book all stay in step.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth?returnTo=%2Fsetup">
                  Create your workspace <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?returnTo=%2Fdashboard">Sign in to your fleet</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                "No spreadsheets",
                "Multi-company isolation",
                "Role-based access",
                "Full audit trail",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-stamp-ok" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Hero artifact: a snapshot of the register as a paper card */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0.6 }}
            transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
            className="paper note-edge relative mx-auto mt-14 w-full max-w-md rounded-lg border border-border p-4 sm:mx-0 sm:ml-auto sm:w-[30rem]"
          >
            <span className="tape absolute -top-2.5 left-6 h-5 w-16 -rotate-3 rounded-[2px]" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-2.5">
              <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Register snapshot
              </p>
              <span className="stamp text-[0.6rem] text-stamp-ok">in order</span>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {[
                { unit: "101", name: "Freightliner Cascadia", status: "Assigned", tone: "text-stamp-ok" },
                { unit: "102", name: "Volvo VNL 860", status: "Assigned", tone: "text-stamp-ok" },
                { unit: "103", name: "Kenworth T680", status: "In maintenance", tone: "text-stamp-warn" },
                { unit: "106", name: "International LT", status: "Out of service", tone: "text-stamp-bad" },
              ].map((row) => (
                <li key={row.unit} className="flex items-center justify-between gap-3">
                  <span className="font-mono font-semibold text-ink">{row.unit}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.name}</span>
                  <span className={`font-mono text-xs ${row.tone}`}>{row.status}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 border-t border-dashed border-border/70 pt-3 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 text-stamp-warn" aria-hidden="true" />
              3 documents need attention · 2 expire inside 45 days
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="font-hand text-2xl text-muted-foreground">One system, not twelve tabs</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Everything a fleet office needs
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Modules share one database — a driver assignment updates the vehicle, the roster and the
            log book in the same second. No double entry, no version drift.
          </p>
        </motion.div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, index) => (
            <motion.article
              key={module.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: index * 0.05 }}
              className="paper note-edge relative rounded-lg border border-border/80 p-5"
            >
              <module.icon className="size-5 text-pen" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-ink">{module.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{module.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="border-y border-border/70 bg-sidebar/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="font-hand text-2xl text-muted-foreground">From zero to running register</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Three steps, then it runs itself
            </h2>
          </motion.div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.07 }}
                className="paper note-edge relative rounded-lg border border-border/80 p-5"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  step {index + 1}
                </span>
                <h3 className="mt-1.5 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </motion.li>
            ))}
          </ol>
          <motion.div {...fadeUp} className="mt-8">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth?returnTo=%2Fsetup">
                Start your checklist <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <motion.div {...fadeUp}>
            <p className="font-hand text-2xl text-muted-foreground">Built for companies, not hobbies</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Private by design
            </h2>
            <ul className="mt-6 space-y-3.5">
              {[
                {
                  title: "Company-scoped data",
                  body: "Every record carries your company's ID, and every query re-checks membership on the server before returning a row.",
                },
                {
                  title: "Eight roles, enforced twice",
                  body: "The interface hides what a role cannot do, and the database refuses what the interface might miss.",
                },
                {
                  title: "An audit trail you can hand to an auditor",
                  body: "Who changed the insurance date, who moved the driver, who cleared the register — recorded with timestamps.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-stamp-ok" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...fadeUp} className="sticky-note rounded-[3px] p-6 text-sm text-[#4a3c12]">
            <p className="font-hand text-2xl">From the dashboard</p>
            <p className="mt-2 leading-6">
              "Utilisation 78%. Insurance on unit 106 expired 9 days ago. Two licences renew inside
              three weeks. Book value down 24% on acquisition." That is your Monday morning, before
              the first coffee — not a monthly spreadsheet reconciliation.
            </p>
            <p className="mt-3 leading-6">
              Fleet Command does the watching so the office can do the driving.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/70 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Your fleet, on one page, from today.
          </h2>
          <p className="max-w-xl text-base leading-7 text-primary-foreground/85">
            Create a workspace, add your first unit, and let Fleet Command keep the paperwork honest.
            Sample fleet included if you would rather look around first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/auth?returnTo=%2Fsetup">
                Create your workspace <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-4 text-pen" aria-hidden="true" />
            <span>Fleet Command · fleet management operating system</span>
          </div>
          <span className="font-mono text-xs">v1 · vehicles, drivers, compliance, audit trail</span>
        </div>
      </footer>
    </div>
  );
}
