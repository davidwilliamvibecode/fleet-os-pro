import type { ActivityAction } from "@/convex/schema";

/* -------------------------------------------------------------------------- */
/*  Números, dinheiro e datas                                                 */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number | null | undefined, currency = "BRL") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number | null | undefined, currency = "BRL") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDistance(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value)} ${unit}`;
}

export function formatDate(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateShort(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
}

export function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("pt-BR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return formatDate(timestamp);
}

export function daysUntil(timestamp: number) {
  return Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Converte um timestamp no valor esperado por <input type="date">. */
export function toDateInput(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/* -------------------------------------------------------------------------- */
/*  Metadados de status                                                       */
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
  active: { label: "Em operação", tone: "ok" },
  available: { label: "Disponível", tone: "info" },
  assigned: { label: "Vinculado", tone: "info" },
  maintenance: { label: "Em manutenção", tone: "warn" },
  out_of_service: { label: "Fora de operação", tone: "bad" },
  sold: { label: "Vendido", tone: "neutral" },
  retired: { label: "Aposentado", tone: "neutral" },
};

export const DRIVER_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Ativo", tone: "ok" },
  on_leave: { label: "De férias", tone: "warn" },
  suspended: { label: "Suspenso", tone: "bad" },
  inactive: { label: "Inativo", tone: "neutral" },
};

export function statusMeta(map: Record<string, { label: string; tone: Tone }>, key: string) {
  return map[key] ?? { label: key.replace(/_/g, " "), tone: "neutral" as Tone };
}

/** Data de conformidade → cor e texto usados em veículos e motoristas. */
export function expiryInfo(timestamp: number | null | undefined, warningDays = 45) {
  if (!timestamp) return { tone: "neutral" as Tone, label: "Não definido", days: null };
  const days = daysUntil(timestamp);
  if (days < 0) {
    return {
      tone: "bad" as Tone,
      label: `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`,
      days,
    };
  }
  if (days <= warningDays) {
    return { tone: "warn" as Tone, label: `Vence em ${days} dia${days === 1 ? "" : "s"}`, days };
  }
  return { tone: "ok" as Tone, label: formatDate(timestamp), days };
}

/* -------------------------------------------------------------------------- */
/*  Mapas de rótulos                                                          */
/* -------------------------------------------------------------------------- */

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const VEHICLE_TYPE_LABELS = {
  truck: "Caminhão",
  van: "Van",
  pickup: "Picape",
  suv: "SUV",
  trailer: "Carreta",
  bus: "Ônibus",
  car: "Automóvel",
  equipment: "Equipamento",
  other: "Outro",
} as const;

export const FUEL_TYPE_LABELS = {
  diesel: "Diesel",
  gasoline: "Gasolina",
  electric: "Elétrico",
  hybrid: "Híbrido",
  cng: "GNV",
  lpg: "GLP",
  other: "Outro",
} as const;

export const OWNERSHIP_LABELS = {
  owned: "Próprio",
  financed: "Financiado",
  leased: "Arrendado",
  rented: "Alugado",
} as const;

export const TRANSMISSION_LABELS = {
  automatic: "Automática",
  manual: "Manual",
  automated_manual: "Automatizada",
} as const;

export const COMPENSATION_LABELS = {
  salary: "Salário fixo",
  hourly: "Por hora",
  per_mile: "Por km rodado",
  per_trip: "Por viagem",
  owner_operator: "Agregado",
} as const;

export const ORG_ROLE_LABELS = {
  owner: "Proprietário",
  admin: "Administrador",
  fleet_manager: "Gestor de frota",
  dispatcher: "Despachante",
  maintenance: "Gestor de manutenção",
  finance: "Financeiro",
  driver: "Motorista",
  viewer: "Leitura apenas",
} as const;

export const MAINTENANCE_TYPE_LABELS = {
  preventive: "Preventiva",
  corrective: "Corretiva",
  inspection: "Inspeção",
  tires: "Pneus",
  oil_change: "Troca de óleo",
  brakes: "Freios",
  suspension: "Suspensão",
  electrical: "Elétrica",
  bodywork: "Funilaria",
  other: "Outro",
} as const;

export const DOCUMENT_TYPE_LABELS = {
  ipva: "IPVA",
  licenciamento: "Licenciamento",
  seguro: "Seguro",
  dpvat: "DPVAT",
  inspecao: "Inspeção técnica",
  taf: "TAF",
  antt: "ANTT",
  outro: "Outro",
} as const;

export const DOCUMENT_STATUS_LABELS = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
} as const;

export function labelFrom(map: Record<string, string>, key: string) {
  return map[key] ?? titleCase(key);
}

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  create: "Cadastrou",
  update: "Atualizou",
  delete: "Removeu",
  assign: "Vinculou",
  status_change: "Status alterado em",
  seed: "Carregou",
  export: "Exportou",
  member: "Equipe —",
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
