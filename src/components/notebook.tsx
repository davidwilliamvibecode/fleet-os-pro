import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, TONE_DOT, type Tone } from "@/lib/format";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  Surfaces                                                                  */
/* -------------------------------------------------------------------------- */

/** Warm paper card with a soft edge shadow — the base surface of the app. */
export function PaperPanel({
  children,
  className,
  ruled = false,
  as: Comp = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  ruled?: boolean;
  as?: "section" | "div" | "article" | "aside";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Comp
      className={cn(
        "paper note-edge relative rounded-lg border border-border/80",
        ruled && "ruled",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Small translucent tape strip, for pinning headings and cards to the page. */
export function TapeStrip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("tape absolute h-5 w-16 rounded-[2px]", className)}
    />
  );
}

export function StickyNote({
  children,
  className,
  rotate = "-1.4deg",
}: {
  children: ReactNode;
  className?: string;
  rotate?: string;
}) {
  return (
    <div
      style={{ rotate }}
      className={cn("sticky-note p-4 text-sm", className)}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Headings                                                                  */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-hand text-lg text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  children,
  hint,
  icon: Icon,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        {Icon ? <Icon className="size-4 text-pen" aria-hidden="true" /> : null}
        <span className="ink-underline pb-0.5">{children}</span>
      </h2>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI cards                                                                 */
/* -------------------------------------------------------------------------- */

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  tape = false,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  tape?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <div className="paper note-edge relative flex flex-col gap-2 rounded-lg border border-border/80 px-4 py-3.5">
      {tape ? <TapeStrip className="-top-2.5 left-4 -rotate-3" /> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.68rem] font-medium tracking-[0.09em] text-muted-foreground uppercase">
          {label}
        </span>
        {Icon ? <Icon className={cn("size-4", tone === "neutral" ? "text-muted-foreground" : "")} aria-hidden="true" /> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-semibold text-ink tabular-nums">{value}</span>
        {tone !== "neutral" ? (
          <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
        ) : null}
      </div>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stamps and pills                                                          */
/* -------------------------------------------------------------------------- */

export function Stamp({
  children,
  tone = "neutral",
  className,
  rotate = true,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  rotate?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.66rem] font-semibold",
        rotate ? "stamp" : "tracking-[0.06em] uppercase",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return (
    <span className={cn("inline-block size-2 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
  );
}

export function CountPill({
  count,
  tone = "neutral",
  className,
}: {
  count: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md font-mono tabular-nums", TONE_CLASSES[tone], className)}
    >
      {count}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ledger-style detail lists                                                 */
/* -------------------------------------------------------------------------- */

export function LedgerList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-border/50", className)}>{children}</dl>;
}

export function LedgerRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-border/60 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase sm:w-44 sm:shrink-0">
        {label}
      </dt>
      <dd className={cn("text-sm text-ink", mono && "font-mono tracking-tight")}>
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  States                                                                    */
/* -------------------------------------------------------------------------- */

export function EmptyNote({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "margin-rule paper relative rounded-lg border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border border-border bg-background/70">
          <Icon className="size-5 text-pen" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="font-hand text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function LoadingNote({ label = "Abrindo o cadastro…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-stamp-bad/40 bg-stamp-bad/5 px-4 py-3 text-sm text-stamp-bad">
      {message}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Log book entry                                                            */
/* -------------------------------------------------------------------------- */

export function LogEntry({
  title,
  meta,
  changes,
  icon: Icon,
}: {
  title: ReactNode;
  meta: ReactNode;
  changes?: { field: string; from?: string; to?: string }[];
  icon?: LucideIcon;
}) {
  return (
    <li className="relative pl-6">
      <span
        className="absolute top-1.5 left-0 flex size-3.5 items-center justify-center rounded-full border border-border bg-card"
        aria-hidden="true"
      >
        {Icon ? <Icon className="size-2.5 text-pen" /> : <span className="size-1 rounded-full bg-pen" />}
      </span>
      <div className="border-b border-dashed border-border/60 pb-3">
        <p className="text-sm text-ink">{title}</p>
        {changes && changes.length ? (
          <ul className="mt-1.5 space-y-0.5">
            {changes.map((change) => (
              <li key={`${change.field}-${change.to}`} className="font-mono text-[0.7rem] text-muted-foreground">
                {change.field}: {change.from ?? "—"} → {change.to ?? "—"}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      </div>
    </li>
  );
}
