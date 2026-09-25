import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LoadingNote, Stamp } from "@/components/notebook";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { ORG_ROLE_LABELS, initials, labelFrom } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Bell,
  BookText,
  ChevronRight,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Search,
  Settings,
  Truck,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";

const NAV_SECTIONS = [
  {
    label: "Command",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "The register",
    items: [
      { to: "/vehicles", label: "Vehicles", icon: Truck },
      { to: "/drivers", label: "Drivers", icon: IdCard },
    ],
  },
  {
    label: "Paperwork",
    items: [{ to: "/logbook", label: "Log book", icon: BookText }],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

const CRUMBS: Record<string, string> = {
  dashboard: "Dashboard",
  vehicles: "Vehicles",
  drivers: "Drivers",
  logbook: "Log book",
  settings: "Settings",
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="paper flex size-9 items-center justify-center rounded-md border border-border shadow-sm">
        <NotebookPen className="size-4 text-pen" aria-hidden="true" />
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-ink">Fleet Command</span>
          <span className="font-hand block text-sm text-muted-foreground">fleet register</span>
        </span>
      )}
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Main">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tab-row flex items-center gap-2.5 rounded-r-md py-2 pr-2 pl-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-ink",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function GlobalSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(term);
  const results = useQuery(api.fleet.search, { term: deferred });
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const hasResults = Boolean(results && (results.vehicles.length || results.drivers.length));
  const showPanel = open && term.trim().length >= 2;

  function go(href: string) {
    setOpen(false);
    setTerm("");
    onNavigate?.();
    navigate(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Search units, plates, VINs, drivers…"
        aria-label="Search the fleet register"
        className="paper h-9 border-border/80 pl-9 text-sm shadow-none"
      />
      {showPanel ? (
        <div className="paper note-edge absolute top-11 left-0 z-50 w-full rounded-lg border border-border p-2">
          {!hasResults ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No units or drivers match “{term.trim()}”.
            </p>
          ) : (
            <div className="space-y-2">
              {results?.vehicles.length ? (
                <div>
                  <p className="px-2 pb-1 text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Vehicles
                  </p>
                  {results.vehicles.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => go(`/vehicles/${row.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">
                        <span className="font-medium text-ink">{row.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{row.subtitle}</span>
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
              {results?.drivers.length ? (
                <div>
                  <p className="px-2 pb-1 text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Drivers
                  </p>
                  {results.drivers.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => go(`/drivers/${row.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">
                        <span className="font-medium text-ink">{row.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{row.subtitle}</span>
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AttentionBell({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const dashboard = useQuery(api.fleet.dashboard);
  const counts = dashboard?.attentionCounts;
  const items = dashboard?.attention.slice(0, 6) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Alerts: ${counts?.total ?? 0} needing attention`}
        >
          <Bell className="size-4" aria-hidden="true" />
          {counts?.total ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-stamp-bad px-1 font-mono text-[0.62rem] font-semibold text-white">
              {counts.total}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="paper w-80 border-border">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Needs attention</span>
          {counts?.critical ? (
            <Badge variant="outline" className="rounded-md text-stamp-bad">
              {counts.critical} urgent
            </Badge>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => {
                onNavigate?.();
                navigate(item.href);
              }}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                <AlertTriangle
                  className={cn(
                    "size-3.5",
                    item.severity === "critical" ? "text-stamp-bad" : "text-stamp-warn",
                  )}
                  aria-hidden="true"
                />
                {item.title}
              </span>
              <span className="pl-5 text-xs text-muted-foreground">{item.detail}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            Nothing overdue. Your paperwork is in order.
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            navigate("/dashboard#attention");
          }}
          className="text-sm font-medium text-pen"
        >
          Open the full attention list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth();
  const { workspace, role, org } = useWorkspace();
  const navigate = useNavigate();
  const user = workspace?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs font-semibold text-ink">
            {initials(org?.name ?? "FC")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="paper w-64 border-border">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm text-ink">{org?.name ?? "Your company"}</span>
          <span className="font-mono text-[0.7rem] font-normal text-muted-foreground">
            {role ? labelFrom(ORG_ROLE_LABELS, role) : "—"} · {user?.id ? "signed in" : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            navigate("/settings");
          }}
        >
          <Settings className="size-4" aria-hidden="true" /> Company settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            navigate("/setup");
          }}
        >
          <NotebookPen className="size-4" aria-hidden="true" /> Setup checklist
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { workspace, isLoading, org, role } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const [activeSection, detailId] = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return [parts[0] ?? "dashboard", parts[1] ?? null];
  }, [location.pathname]);

  if (isLoading) return <LoadingNote label="Opening Fleet Command…" />;
  if (workspace && !org) return <Navigate to="/setup" replace />;

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3.5">
        <Link to="/dashboard" onClick={() => setMobileOpen(false)} aria-label="Fleet Command home">
          <BrandMark />
        </Link>
      </div>
      <div className="border-b border-sidebar-border px-4 py-3">
        <p className="truncate text-sm font-medium text-ink">{org?.name ?? "Your company"}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Stamp tone="info" rotate={false}>
            {role ? labelFrom(ORG_ROLE_LABELS, role) : "member"}
          </Stamp>
          <span className="font-mono text-[0.68rem] text-muted-foreground">
            {org?.currency ?? "USD"} · {org?.distanceUnit ?? "mi"}
          </span>
        </div>
      </div>
      <div className="scrollbar-paper flex-1 overflow-y-auto">
        <NavList onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-sidebar-border px-3 py-3">
        <p className="px-2 pb-2 text-xs leading-5 text-muted-foreground">
          Version 1 covers the fleet register: vehicles, drivers and the paperwork around them.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          asChild
        >
          <Link to="/setup" onClick={() => setMobileOpen(false)}>
            <NotebookPen className="size-4" aria-hidden="true" /> Setup checklist
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        {sidebarInner}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-border/80 bg-background/85 px-4 py-2.5 backdrop-blur-sm sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Fleet Command navigation</SheetTitle>
              </SheetHeader>
              {sidebarInner}
            </SheetContent>
          </Sheet>

          <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm lg:flex">
            <Link to="/dashboard" className="text-muted-foreground hover:text-ink">
              Fleet Command
            </Link>
            <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-ink">
              {CRUMBS[activeSection] ?? "Dashboard"}
              {detailId && activeSection === "vehicles" ? " · unit file" : ""}
              {detailId && activeSection === "drivers" ? " · driver file" : ""}
            </span>
          </nav>

          <div className="order-3 w-full sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:max-w-md">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <AttentionBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children ?? <Outlet />}
        </main>

        <footer className="border-t border-border/70 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Fleet Command · {org?.name ?? "Your company"} · signed-in records are private to your
            company.
          </p>
        </footer>
      </div>
    </div>
  );
}
