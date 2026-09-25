import type { ActivityAction } from "@/convex/schema";

/* -------------------------------------------------------------------------- */
/*  Numbers, money and dates                                                  */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDistance(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value)} ${unit}`;
}

export function formatDate(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateShort(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(timestamp);
}

export function daysUntil(timestamp: number) {
  return Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Turn a timestamp into the value an <input type="date"> expects. */
export function toDateInput(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/* -------------------------------------------------------------------------- */
/*  Status metadata                                                           */
/* -------------------------------------------------------------------------- */

export type Tone = "ok" | "warn" | "bad" | "neutral" | "info";

export const TONE_CLASSES: Record<Tone, string> = {
  ok: "text-stamp-ok border-stamp-ok/45 bg-stamp-ok/10",
  warn: "text-stamp-warn border-stamp-warn/45 bg-stamp-warn/10",
  bad: "text-stamp-bad border-stamp-bad/45 bg-stamp-bad/10",
  info: "text-pen border-pen/40 bg-pen/10",
  neutral: "text-muted-foreground border-border bg-muted/60",
};

export const TONE_DOT: Record<Tone, string> = {
  ok: "bg-stamp-ok",
  warn: "bg-stamp-warn",
  bad: "bg-stamp-bad",
  info: "bg-pen",
  neutral: "bg-muted-foreground",
};

export const VEHICLE_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  available: { label: "Available", tone: "info" },
  assigned: { label: "Assigned", tone: "info" },
  maintenance: { label: "In maintenance", tone: "warn" },
  out_of_service: { label: "Out of service", tone: "bad" },
  sold: { label: "Sold", tone: "neutral" },
  retired: { label: "Retired", tone: "neutral" },
};

export const DRIVER_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  on_leave: { label: "On leave", tone: "warn" },
  suspended: { label: "Suspended", tone: "bad" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export function statusMeta(map: Record<string, { label: string; tone: Tone }>, key: string) {
  return map[key] ?? { label: key.replace(/_/g, " "), tone: "neutral" as Tone };
}

/** Compliance date → colour + wording used across vehicles and drivers. */
export function expiryInfo(timestamp: number | null | undefined, warningDays = 45) {
  if (!timestamp) return { tone: "neutral" as Tone, label: "Not set", days: null };
  const days = daysUntil(timestamp);
  if (days < 0) {
    return {
      tone: "bad" as Tone,
      label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`,
      days,
    };
  }
  if (days <= warningDays) {
    return { tone: "warn" as Tone, label: `Expires in ${days} day${days === 1 ? "" : "s"}`, days };
  }
  return { tone: "ok" as Tone, label: formatDate(timestamp), days };
}

/* -------------------------------------------------------------------------- */
/*  Label maps                                                                */
/* -------------------------------------------------------------------------- */

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const VEHICLE_TYPE_LABELS = {
  truck: "Truck",
  van: "Van",
  pickup: "Pickup",
  suv: "SUV",
  trailer: "Trailer",
  bus: "Bus",
  car: "Car",
  equipment: "Equipment",
  other: "Other",
} as const;

export const FUEL_TYPE_LABELS = {
  diesel: "Diesel",
  gasoline: "Gasoline",
  electric: "Electric",
  hybrid: "Hybrid",
  cng: "CNG",
  lpg: "LPG",
  other: "Other",
} as const;

export const OWNERSHIP_LABELS = {
  owned: "Owned",
  financed: "Financed",
  leased: "Leased",
  rented: "Rented",
} as const;

export const TRANSMISSION_LABELS = {
  automatic: "Automatic",
  manual: "Manual",
  automated_manual: "Automated manual",
} as const;

export const COMPENSATION_LABELS = {
  salary: "Salary",
  hourly: "Hourly",
  per_mile: "Per mile / km",
  per_trip: "Per trip",
  owner_operator: "Owner-operator",
} as const;

export const ORG_ROLE_LABELS = {
  owner: "Owner",
  admin: "Administrator",
  fleet_manager: "Fleet manager",
  dispatcher: "Dispatcher",
  maintenance: "Maintenance manager",
  finance: "Accountant",
  driver: "Driver",
  viewer: "Read-only viewer",
} as const;

export function labelFrom(map: Record<string, string>, key: string) {
  return map[key] ?? titleCase(key);
}

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  create: "Added",
  update: "Updated",
  delete: "Removed",
  assign: "Assigned",
  status_change: "Status changed",
  seed: "Loaded",
  member: "Team",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
