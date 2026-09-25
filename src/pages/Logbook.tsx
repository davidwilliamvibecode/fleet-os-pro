import { api } from "@/convex/_generated/api";
import type { ActivityEntity } from "@/convex/schema";
import { AppShell } from "@/components/app-shell";
import {
  EmptyNote,
  LoadingNote,
  LogEntry,
  PageHeader,
  PaperPanel,
  SectionHeading,
} from "@/components/notebook";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_ACTION_LABELS,
  formatNumber,
  labelFrom,
  timeAgo,
} from "@/lib/format";
import { useQuery } from "convex/react";
import { BookText, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "vehicle", label: "Vehicles" },
  { value: "driver", label: "Drivers" },
  { value: "member", label: "Team" },
  { value: "company", label: "Company" },
  { value: "workspace", label: "Workspace" },
];

export default function LogbookPage() {
  const [entity, setEntity] = useState("all");
  const [limit, setLimit] = useState(60);

  const entries = useQuery(api.fleet.activityFeed, {
    entity: entity === "all" ? undefined : (entity as ActivityEntity),
    limit,
  });

  const filtersActive = entity !== "all";
  const feedIsEmpty = entries !== undefined && entries.length === 0 && !filtersActive;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Audit trail"
          title="Log book"
          description="Every create, edit, assignment, status change and team update is written here — who did it, what changed, and when."
        />

        <PaperPanel className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52">
              <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                Record type
              </span>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger className="paper mt-1.5 w-full" aria-label="Filter by record type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="paper">
                  {ENTITY_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <span className="text-[0.7rem] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                Show
              </span>
              <Select
                value={String(limit)}
                onValueChange={(value) => setLimit(Number(value))}
              >
                <SelectTrigger className="paper mt-1.5 w-full" aria-label="Number of entries">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="paper">
                  <SelectItem value="60">Last 60</SelectItem>
                  <SelectItem value="120">Last 120</SelectItem>
                  <SelectItem value="200">Last 200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtersActive ? (
              <Button variant="ghost" className="gap-1.5" onClick={() => setEntity("all")}>
                <X className="size-4" aria-hidden="true" /> Clear
              </Button>
            ) : null}

            <p className="ml-auto font-mono text-xs text-muted-foreground">
              {entries === undefined
                ? "counting…"
                : `${formatNumber(entries.length)} entr${entries.length === 1 ? "y" : "ies"}`}
            </p>
          </div>
        </PaperPanel>

        {entries === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : entries.length === 0 ? (
          feedIsEmpty ? (
            <EmptyNote
              icon={BookText}
              title="The log book is empty"
              description="As soon as you or your team add, edit or assign anything in Fleet Command, it is recorded here — a permanent audit trail for the whole company."
            />
          ) : (
            <EmptyNote
              icon={BookText}
              title="No entries for that record type"
              description="Nothing has been logged under this filter yet. Clear the filter to see the full log book."
              action={
                <Button variant="outline" onClick={() => setEntity("all")}>
                  Clear filter
                </Button>
              }
            />
          )
        ) : (
          <PaperPanel className="p-5">
            <SectionHeading hint="newest first">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </SectionHeading>
            <ul className="mt-3 space-y-3">
              {entries.map((entry) => {
                const href =
                  entry.entity === "vehicle" && entry.entityId
                    ? `/vehicles/${entry.entityId}`
                    : entry.entity === "driver" && entry.entityId
                      ? `/drivers/${entry.entityId}`
                      : entry.entity === "member" || entry.entity === "company"
                        ? "/settings"
                        : entry.entity === "workspace"
                          ? "/setup"
                          : null;
                return (
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
                    changes={entry.changes}
                    meta={
                      <>
                        {entry.actorName} · {timeAgo(entry.createdAt)}
                        {href ? (
                          <>
                            {" · "}
                            <Link to={href} className="text-pen hover:underline">
                              open record
                            </Link>
                          </>
                        ) : null}
                      </>
                    }
                  />
                );
              })}
            </ul>
          </PaperPanel>
        )}
      </div>
    </AppShell>
  );
}
