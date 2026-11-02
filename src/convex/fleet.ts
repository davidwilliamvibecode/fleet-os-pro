import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { canSeeDriverPersonalData, visibleActivity } from "./access";
import { limit } from "./limits";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  COMPANY_ROLES,
  COMPENSATION_ROLES,
  EXPIRY_WARNING_DAYS,
  FLEET_WRITE_ROLES,
  FUEL_TYPES,
  ORG_ROLES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type OrgRole,
} from "./constants";
import {
  compensationValidator,
  driverStatusValidator,
  fuelTypeValidator,
  ownershipValidator,
  transmissionValidator,
  vehicleStatusValidator,
  vehicleTypeValidator,
  type ActivityAction,
  type ActivityEntity,
} from "./schema";

const DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Shared input validators                                                   */
/* -------------------------------------------------------------------------- */

const vehicleInput = {
  unitNumber: v.string(),
  vehicleType: vehicleTypeValidator,
  make: v.string(),
  model: v.string(),
  year: v.optional(v.number()),
  vin: v.optional(v.string()),
  plate: v.optional(v.string()),
  fuelType: fuelTypeValidator,
  transmission: v.optional(transmissionValidator),
  odometer: v.number(),
  ownershipType: ownershipValidator,
  acquisitionDate: v.optional(v.number()),
  acquisitionCost: v.optional(v.number()),
  currentValue: v.optional(v.number()),
  leaseEndDate: v.optional(v.number()),
  insurancePolicy: v.optional(v.string()),
  insuranceExpiry: v.optional(v.number()),
  registrationExpiry: v.optional(v.number()),
  nextServiceDate: v.optional(v.number()),
  nextServiceOdometer: v.optional(v.number()),
  status: vehicleStatusValidator,
  assignedDriverId: v.optional(v.id("drivers")),
  depot: v.optional(v.string()),
  notes: v.optional(v.string()),
};

type CleanVehicle = {
  unitNumber: string;
  vehicleType: Infer<typeof vehicleTypeValidator>;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  plate?: string;
  fuelType: Infer<typeof fuelTypeValidator>;
  transmission?: Infer<typeof transmissionValidator>;
  odometer: number;
  odometerUpdatedAt?: number;
  ownershipType: Infer<typeof ownershipValidator>;
  acquisitionDate?: number;
  acquisitionCost?: number;
  currentValue?: number;
  leaseEndDate?: number;
  insurancePolicy?: string;
  insuranceExpiry?: number;
  registrationExpiry?: number;
  nextServiceDate?: number;
  nextServiceOdometer?: number;
  status: Infer<typeof vehicleStatusValidator>;
  assignedDriverId?: Id<"drivers">;
  depot?: string;
  notes?: string;
};

/* -------------------------------------------------------------------------- */
/*  Context + authorization helpers                                           */
/* -------------------------------------------------------------------------- */

type OrgContext = {
  userId: Id<"users">;
  actorName: string;
  orgId: Id<"organizations">;
  orgName: string;
  role: OrgRole;
};

export async function signedInUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return {
    userId,
    name: user?.name ?? user?.email ?? "Membro da equipe",
    email: user?.email ?? "",
  };
}

/** Resolves the signed-in user's company. Null when there is no company yet. */
export async function orgContext(ctx: QueryCtx | MutationCtx) {
  const user = await signedInUser(ctx);
  if (!user) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", user.userId))
    .first();
  if (!membership) return null;
  const org = await ctx.db.get(membership.orgId);
  if (!org) return null;
  return {
    userId: user.userId,
    actorName: user.name,
    email: user.email,
    org,
    orgId: org._id,
    role: membership.role as OrgRole,
    membershipId: membership._id,
  };
}

export async function requireOrg(
  ctx: QueryCtx | MutationCtx,
): Promise<OrgContext> {
  const user = await signedInUser(ctx);
  if (!user) throw new ConvexError("Sua sessão expirou. Entre novamente.");
  const context = await orgContext(ctx);
  if (!context) {
    throw new ConvexError(
      "Crie o perfil da empresa antes de registrar dados da frota.",
    );
  }
  return {
    userId: context.userId,
    actorName: context.actorName,
    orgId: context.orgId,
    orgName: context.org.name,
    role: context.role,
  };
}

export function requireRole(
  role: OrgRole,
  allowed: OrgRole[],
  message: string,
) {
  if (!allowed.includes(role)) throw new ConvexError(message);
}

/**
 * Compensation is payroll data. Only the roles that actually run the numbers
 * get to read it — a driver or a dispatcher must not see what a colleague
 * earns (LGPD: dado pessoal sensível no contexto trabalhista).
 */
export function canSeeCompensation(role: OrgRole) {
  return COMPENSATION_ROLES.includes(role);
}

/* -------------------------------------------------------------------------- */
/*  Field parsing / validation                                                */
/* -------------------------------------------------------------------------- */

export function readText(
  input: Record<string, unknown>,
  key: string,
  label: string,
  max = 120,
) {
  const raw = input[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new ConvexError(`${label} é obrigatório.`);
  if (value.length > max)
    throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

export function readOptionalText(
  input: Record<string, unknown>,
  key: string,
  label: string,
  max = 400,
) {
  const raw = input[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "number") return String(raw);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return undefined;
  if (value.length > max)
    throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

export function readEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  label: string,
): T {
  const raw = input[key];
  if (typeof raw !== "string" || !allowed.includes(raw as T)) {
    throw new ConvexError(`Selecione um ${label.toLowerCase()} válido.`);
  }
  return raw as T;
}

export function readOptionalEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  label: string,
): T | undefined {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !allowed.includes(raw as T)) {
    throw new ConvexError(`Selecione um ${label.toLowerCase()} válido.`);
  }
  return raw as T;
}

function readNumber(
  input: Record<string, unknown>,
  key: string,
  label: string,
  opts: { min?: number; max?: number } = {},
) {
  const raw = input[key];
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${label} deve ser um número.`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ConvexError(`${label} não pode ser menor que ${opts.min}.`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ConvexError(`${label} parece alto demais — confira o valor.`);
  }
  return value;
}

export function readOptionalNumber(
  input: Record<string, unknown>,
  key: string,
  label: string,
  opts: { min?: number; max?: number } = {},
) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return readNumber(input, key, label, opts);
}

export function readOptionalDate(
  input: Record<string, unknown>,
  key: string,
  label: string,
) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Date.parse(`${raw}T00:00:00`)
        : NaN;
  if (!Number.isFinite(value))
    throw new ConvexError(`${label} não é uma data válida.`);
  if (value < Date.parse("1900-01-01") || value > Date.now() + 40 * 365 * DAY) {
    throw new ConvexError(`${label} está fora do intervalo suportado.`);
  }
  return value;
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

function normalizeVin(raw: string | undefined, label: string) {
  if (!raw) return undefined;
  const vin = raw.replace(/\s+/g, "").toUpperCase();
  if (!VIN_PATTERN.test(vin)) {
    throw new ConvexError(
      `${label} deve ter 17 caracteres (letras e números, sem I, O ou Q).`,
    );
  }
  return vin;
}

function vehicleFromInput(
  input: Record<string, unknown>,
  current?: { status?: string; odometer?: number },
): CleanVehicle {
  const odometer = readNumber(input, "odometer", "Odometer", {
    min: 0,
    max: 5_000_000,
  });
  const unitNumber = readText(input, "unitNumber", "Número da unidade", 40);
  const year = readOptionalNumber(input, "year", "Ano", {
    min: 1900,
    max: new Date().getFullYear() + 2,
  });

  const draft: CleanVehicle = {
    unitNumber,
    vehicleType: readEnum(
      input,
      "vehicleType",
      VEHICLE_TYPES,
      "Tipo de veículo",
    ),
    make: readText(input, "make", "Marca", 60),
    model: readText(input, "model", "Modelo", 60),
    fuelType: readEnum(input, "fuelType", FUEL_TYPES, "Combustível"),
    ownershipType: readEnum(
      input,
      "ownershipType",
      ["owned", "financed", "leased", "rented"] as const,
      "Tipo de propriedade",
    ),
    status: readEnum(input, "status", VEHICLE_STATUSES, "Situação"),
    odometer,
    odometerUpdatedAt: Date.now(),
    notes: readOptionalText(input, "notes", "Observações", 2000),
  };

  if (year !== undefined) draft.year = Math.round(year);
  const vin = normalizeVin(
    readOptionalText(input, "vin", "Chassi (VIN)", 40),
    "Chassi (VIN)",
  );
  if (vin) draft.vin = vin;
  const plate = readOptionalText(input, "plate", "Placa", 20);
  if (plate) draft.plate = plate.toUpperCase();

  const transmission = readOptionalEnum(
    input,
    "transmission",
    ["automatic", "manual", "automated_manual"] as const,
    "Câmbio",
  );
  if (transmission) draft.transmission = transmission;

  const acquisitionDate = readOptionalDate(
    input,
    "acquisitionDate",
    "Data de aquisição",
  );
  if (acquisitionDate) draft.acquisitionDate = acquisitionDate;
  const leaseEndDate = readOptionalDate(
    input,
    "leaseEndDate",
    "Fim do contrato de locação",
  );
  if (leaseEndDate) draft.leaseEndDate = leaseEndDate;
  const insuranceExpiry = readOptionalDate(
    input,
    "insuranceExpiry",
    "Vencimento do seguro",
  );
  if (insuranceExpiry) draft.insuranceExpiry = insuranceExpiry;
  const registrationExpiry = readOptionalDate(
    input,
    "registrationExpiry",
    "Vencimento do licenciamento",
  );
  if (registrationExpiry) draft.registrationExpiry = registrationExpiry;
  const nextServiceDate = readOptionalDate(
    input,
    "nextServiceDate",
    "Próxima revisão",
  );
  if (nextServiceDate) draft.nextServiceDate = nextServiceDate;

  const acquisitionCost = readOptionalNumber(
    input,
    "acquisitionCost",
    "Custo de aquisição",
    {
      min: 0,
      max: 100_000_000,
    },
  );
  if (acquisitionCost !== undefined) draft.acquisitionCost = acquisitionCost;
  const currentValue = readOptionalNumber(
    input,
    "currentValue",
    "Valor atual",
    {
      min: 0,
      max: 100_000_000,
    },
  );
  if (currentValue !== undefined) draft.currentValue = currentValue;
  const nextServiceOdometer = readOptionalNumber(
    input,
    "nextServiceOdometer",
    "Hodômetro da próxima revisão",
    {
      min: 0,
      max: 5_000_000,
    },
  );
  if (nextServiceOdometer !== undefined)
    draft.nextServiceOdometer = nextServiceOdometer;

  const insurancePolicy = readOptionalText(
    input,
    "insurancePolicy",
    "Apólice do seguro",
    80,
  );
  if (insurancePolicy) draft.insurancePolicy = insurancePolicy;
  const depot = readOptionalText(input, "depot", "Base / pátio", 80);
  if (depot) draft.depot = depot;

  const assignedDriverId = input.assignedDriverId;
  if (assignedDriverId)
    draft.assignedDriverId = assignedDriverId as Id<"drivers">;

  if (current?.odometer !== undefined && odometer < current.odometer) {
    throw new ConvexError(
      `O odômetro não pode ser menor que a última leitura (${current.odometer.toLocaleString("pt-BR")}).`,
    );
  }

  return draft;
}

/* -------------------------------------------------------------------------- */
/*  Audit trail                                                               */
/* -------------------------------------------------------------------------- */

export async function logActivity(
  ctx: MutationCtx,
  entry: {
    orgId: Id<"organizations">;
    userId: Id<"users">;
    actorName: string;
    action: ActivityAction;
    entity: ActivityEntity;
    entityId?: string;
    entityLabel: string;
    summary: string;
    changes?: { field: string; from?: string; to?: string }[];
  },
) {
  await ctx.db.insert("activityLog", { ...entry, createdAt: Date.now() });
}

function formatChangeValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

const VEHICLE_TRACKED_FIELDS: { key: keyof CleanVehicle; label: string }[] = [
  { key: "unitNumber", label: "Número da unidade" },
  { key: "status", label: "Situação" },
  { key: "odometer", label: "Odômetro" },
  { key: "plate", label: "Placa" },
  { key: "vin", label: "Chassi (VIN)" },
  { key: "assignedDriverId", label: "Motorista vinculado" },
  { key: "insuranceExpiry", label: "Vencimento do seguro" },
  { key: "registrationExpiry", label: "Vencimento do licenciamento" },
  { key: "nextServiceDate", label: "Próxima revisão (data)" },
  { key: "nextServiceOdometer", label: "Próxima revisão (km)" },
  { key: "currentValue", label: "Valor atual" },
];

async function vehicleChanges(
  ctx: MutationCtx,
  before: Record<string, unknown>,
  after: CleanVehicle,
  orgId: Id<"organizations">,
) {
  const changes: { field: string; from?: string; to?: string }[] = [];
  for (const { key, label } of VEHICLE_TRACKED_FIELDS) {
    const from = before[key as string];
    const to = after[key];
    if (key === "assignedDriverId") {
      const fromName = from
        ? await driverName(ctx, from as Id<"drivers">, orgId)
        : undefined;
      const toName = to
        ? await driverName(ctx, to as Id<"drivers">, orgId)
        : undefined;
      if (fromName !== toName)
        changes.push({ field: label, from: fromName, to: toName });
      continue;
    }
    if (formatChangeValue(from) !== formatChangeValue(to)) {
      changes.push({
        field: label,
        from: formatChangeValue(from),
        to: formatChangeValue(to),
      });
    }
  }
  return changes;
}

export function diffFields<T>(
  before: Record<string, unknown>,
  after: T,
  fields: { key: keyof T; label: string }[],
) {
  const changes: { field: string; from?: string; to?: string }[] = [];
  for (const { key, label } of fields) {
    const from = formatChangeValue(before[key as string]);
    const to = formatChangeValue(after[key]);
    if (from !== to) changes.push({ field: label, from, to });
  }
  return changes;
}

/**
 * Nome do motorista para os registros de auditoria.
 *
 * Recebe a empresa de quem está solicitando e reconfirma: se a referência vier
 * corrompida, vira "Não vinculado" em vez de gravar o nome de um motorista de
 * outra empresa no histórico de quem fez a alteração.
 */
async function driverName(
  ctx: MutationCtx | QueryCtx,
  driverId: Id<"drivers">,
  orgId: Id<"organizations">,
) {
  const driver = await ctx.db.get(driverId);
  if (!driver || driver.orgId !== orgId) return "Não vinculado";
  return `${driver.firstName} ${driver.lastName}`;
}

/* -------------------------------------------------------------------------- */
/*  Workspace                                                                 */
/* -------------------------------------------------------------------------- */

export const workspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await signedInUser(ctx);
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .first();

    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", user.userId))
      .take(20);

    if (!membership) {
      return {
        user: { id: user.userId, name: user.name, email: user.email },
        org: null,
        role: null as OrgRole | null,
        members: [],
        organizations: organizations.map((org) => ({
          id: org._id,
          name: org.name,
        })),
      };
    }

    const org = await ctx.db.get(membership.orgId);
    if (!org) {
      return {
        user: { id: user.userId, name: user.name, email: user.email },
        org: null,
        role: null as OrgRole | null,
        members: [],
        organizations: organizations.map((o) => ({ id: o._id, name: o.name })),
      };
    }

    const memberRows = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(50);
    const members = await Promise.all(
      memberRows.map(async (row) => {
        const memberUser = await ctx.db.get(row.userId);
        // O e-mail de um integrante é dado pessoal: quem gere contas (owner e
        // admin) precisa dele, os demais papéis só veem nome e papel.
        const canSeeEmail =
          membership.role === "owner" || membership.role === "admin";
        return {
          membershipId: row._id,
          userId: row.userId,
          name: memberUser?.name ?? memberUser?.email ?? "Integrante",
          email: canSeeEmail ? (memberUser?.email ?? "") : "",
          role: row.role as OrgRole,
          joinedAt: row.createdAt,
        };
      }),
    );

    return {
      user: { id: user.userId, name: user.name, email: user.email },
      org: {
        id: org._id,
        name: org.name,
        legalName: org.legalName ?? "",
        contactEmail: org.contactEmail ?? "",
        phone: org.phone ?? "",
        addressLine: org.addressLine ?? "",
        city: org.city ?? "",
        region: org.region ?? "",
        country: org.country ?? "",
        taxId: org.taxId ?? "",
        currency: org.currency,
        distanceUnit: org.distanceUnit,
        volumeUnit: org.volumeUnit,
        timeZone: org.timeZone,
        plan: org.plan,
        setupCompletedAt: org.setupCompletedAt ?? null,
        createdAt: org.createdAt,
      },
      role: membership.role as OrgRole,
      members,
      organizations: organizations.map((o) => ({ id: o._id, name: o.name })),
    };
  },
});

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                 */
/* -------------------------------------------------------------------------- */

export type AttentionItem = {
  id: string;
  kind: "compliance" | "service" | "assignment" | "status";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
};

function daysUntil(timestamp: number) {
  return Math.ceil((timestamp - Date.now()) / DAY);
}

function expirySeverity(timestamp: number): AttentionItem["severity"] | null {
  const days = daysUntil(timestamp);
  if (days < 0) return "critical";
  if (days <= EXPIRY_WARNING_DAYS) return "warning";
  return null;
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const context = await orgContext(ctx);
    if (!context) return null;
    const { orgId, org } = context;

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(10);

    const vehicleByDriver = new Map<string, (typeof vehicles)[number]>();
    for (const vehicle of vehicles) {
      if (vehicle.assignedDriverId)
        vehicleByDriver.set(vehicle.assignedDriverId as string, vehicle);
    }

    const inService = vehicles.filter(
      (v) => v.status !== "retired" && v.status !== "sold",
    );
    const assignedVehicles = inService.filter((v) =>
      Boolean(v.assignedDriverId),
    );
    const statusCounts = VEHICLE_STATUSES.reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = vehicles.filter((v) => v.status === status).length;
        return acc;
      },
      {},
    );
    const typeCounts = VEHICLE_TYPES.map((type) => ({
      label: type,
      count: vehicles.filter((v) => v.vehicleType === type).length,
    })).filter((row) => row.count > 0);

    const activeDrivers = drivers.filter((d) => d.status === "active");
    const unassignedDrivers = activeDrivers.filter(
      (d) => !vehicleByDriver.has(d._id as string),
    );

    const attention: AttentionItem[] = [];
    for (const vehicle of vehicles) {
      const label = `Unidade ${vehicle.unitNumber}`;

      if (vehicle.insuranceExpiry) {
        const severity = expirySeverity(vehicle.insuranceExpiry);
        if (severity) {
          const days = daysUntil(vehicle.insuranceExpiry);
          attention.push({
            id: `${vehicle._id}-insurance`,
            kind: "compliance",
            severity,
            title:
              days < 0
                ? `Seguro da ${label} vencido`
                : `Seguro da ${label} vence em breve`,
            detail:
              days < 0
                ? `Vencido há ${Math.abs(days)} dia(s)`
                : `Vence em ${days} dia(s)`,
            href: `/vehicles/${vehicle._id}`,
          });
        }
      }
      if (vehicle.registrationExpiry) {
        const severity = expirySeverity(vehicle.registrationExpiry);
        if (severity) {
          const days = daysUntil(vehicle.registrationExpiry);
          attention.push({
            id: `${vehicle._id}-registration`,
            kind: "compliance",
            severity,
            title:
              days < 0
                ? `Licenciamento da ${label} vencido`
                : `Licenciamento da ${label} vence em breve`,
            detail:
              days < 0
                ? `Vencido há ${Math.abs(days)} dia(s)`
                : `Vence em ${days} dia(s)`,
            href: `/vehicles/${vehicle._id}`,
          });
        }
      }
      if (vehicle.status !== "retired" && vehicle.status !== "sold") {
        if (vehicle.nextServiceDate && vehicle.nextServiceDate < Date.now()) {
          attention.push({
            id: `${vehicle._id}-service-date`,
            kind: "service",
            severity: "warning",
            title: `Revisão da ${label} vencida`,
            detail: `Prevista para há ${Math.abs(daysUntil(vehicle.nextServiceDate))} dia(s)`,
            href: `/vehicles/${vehicle._id}`,
          });
        } else if (
          vehicle.nextServiceOdometer &&
          vehicle.odometer >= vehicle.nextServiceOdometer
        ) {
          attention.push({
            id: `${vehicle._id}-service-odo`,
            kind: "service",
            severity: "warning",
            title: `Revisão da ${label} por quilometragem`,
            detail: `Odômetro ${vehicle.odometer.toLocaleString("pt-BR")} ${org.distanceUnit} ≥ meta ${vehicle.nextServiceOdometer.toLocaleString("pt-BR")}`,
            href: `/vehicles/${vehicle._id}`,
          });
        } else if (
          vehicle.nextServiceDate &&
          daysUntil(vehicle.nextServiceDate) <= 14
        ) {
          attention.push({
            id: `${vehicle._id}-service-soon`,
            kind: "service",
            severity: "info",
            title: `Revisão da ${label} se aproximando`,
            detail: `Vence em ${daysUntil(vehicle.nextServiceDate)} dia(s)`,
            href: `/vehicles/${vehicle._id}`,
          });
        }
      }
      if (vehicle.status === "out_of_service") {
        attention.push({
          id: `${vehicle._id}-oos`,
          kind: "status",
          severity: "critical",
          title: `${label} está fora de operação`,
          detail: vehicle.notes
            ? vehicle.notes.slice(0, 90)
            : "Nenhum motivo registrado ainda",
          href: `/vehicles/${vehicle._id}`,
        });
      } else if (
        vehicle.status !== "retired" &&
        vehicle.status !== "sold" &&
        vehicle.status !== "maintenance" &&
        !vehicle.assignedDriverId
      ) {
        attention.push({
          id: `${vehicle._id}-unassigned`,
          kind: "assignment",
          severity: "info",
          title: `${label} sem motorista`,
          detail: "Disponível para vinculação",
          href: `/vehicles/${vehicle._id}`,
        });
      }
    }

    for (const driver of drivers) {
      if (
        !canSeeDriverPersonalData(
          context.role,
          driver.accountUserId,
          context.userId,
        )
      )
        continue;
      const name = `${driver.firstName} ${driver.lastName}`;
      if (driver.licenseExpiry) {
        const severity = expirySeverity(driver.licenseExpiry);
        if (severity) {
          const days = daysUntil(driver.licenseExpiry);
          attention.push({
            id: `${driver._id}-license`,
            kind: "compliance",
            severity,
            title:
              days < 0
                ? `CNH de ${name} vencida`
                : `CNH de ${name} vence em breve`,
            detail:
              days < 0
                ? `Vencida há ${Math.abs(days)} dia(s)`
                : `Vence em ${days} dia(s)`,
            href: `/drivers/${driver._id}`,
          });
        }
      }
      if (driver.medicalExpiry) {
        const severity = expirySeverity(driver.medicalExpiry);
        if (severity) {
          const days = daysUntil(driver.medicalExpiry);
          attention.push({
            id: `${driver._id}-medical`,
            kind: "compliance",
            severity,
            title: `Exame tocicódico de ${name} ${days < 0 ? "vencido" : "vence em breve"}`,
            detail:
              days < 0
                ? `Vencido há ${Math.abs(days)} dia(s)`
                : `Vence em ${days} dia(s)`,
            href: `/drivers/${driver._id}`,
          });
        }
      }
    }

    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    attention.sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity],
    );

    // ----------------------------------------------------------------------
    // Manutenção: serviços vencidos/previstos e documentos/impostos a pagar
    // ----------------------------------------------------------------------
    const maintenanceRows = await ctx.db
      .query("maintenanceRecords")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);
    const documentRows = await ctx.db
      .query("vehicleDocuments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);
    const unitLabel = new Map(
      vehicles.map((v) => [v._id as string, v.unitNumber]),
    );

    for (const doc of documentRows) {
      if (doc.status === "pago") continue;
      const unit = unitLabel.get(doc.vehicleId as string) ?? "?";
      const days = doc.dueDate ? daysUntil(doc.dueDate) : null;
      if (doc.status === "atrasado" || (days !== null && days < 0)) {
        attention.push({
          id: `${doc._id}-doc-late`,
          kind: "compliance",
          severity: "critical",
          title: `${doc.title} da unidade ${unit} está atrasado`,
          detail: doc.amount
            ? `Vencido ${doc.dueDate ? Math.abs(days ?? 0) + " dia(s)" : ""} · valor ${doc.amount.toLocaleString("pt-BR", { style: "currency", currency: org.currency })}`
            : "Regularize o pagamento o quanto antes",
          href: `/vehicles/${doc.vehicleId}#documentos`,
        });
      } else if (days !== null && days <= 30) {
        attention.push({
          id: `${doc._id}-doc-soon`,
          kind: "compliance",
          severity: "warning",
          title: `${doc.title} da unidade ${unit} vence em ${days} dia${days === 1 ? "" : "s"}`,
          detail: doc.amount
            ? `Valor ${doc.amount.toLocaleString("pt-BR", { style: "currency", currency: org.currency })}`
            : "Programar o pagamento",
          href: `/vehicles/${doc.vehicleId}#documentos`,
        });
      }
    }

    for (const record of maintenanceRows) {
      const unit = unitLabel.get(record.vehicleId as string) ?? "?";
      if (record.nextServiceDate && record.nextServiceDate < Date.now()) {
        const days = Math.abs(daysUntil(record.nextServiceDate));
        attention.push({
          id: `${record._id}-mt-date`,
          kind: "service",
          severity: "warning",
          title: `Revisão da unidade ${unit} vencida`,
          detail: `${record.description.slice(0, 60)} — prevista para ${days} dia(s) atrás`,
          href: `/vehicles/${record.vehicleId}#manutencao`,
        });
      } else if (record.nextServiceOdometer && record.nextServiceOdometer > 0) {
        const vehicle = vehicles.find((v) => v._id === record.vehicleId);
        if (vehicle && vehicle.odometer >= record.nextServiceOdometer) {
          attention.push({
            id: `${record._id}-mt-odo`,
            kind: "service",
            severity: "warning",
            title: `Revisão por quilometragem na unidade ${unit}`,
            detail: `Odômetro ${vehicle.odometer.toLocaleString("pt-BR")} ≥ ${record.nextServiceOdometer.toLocaleString("pt-BR")}`,
            href: `/vehicles/${record.vehicleId}#manutencao`,
          });
        }
      }
    }

    const acquisitionTotal = vehicles.reduce(
      (sum, v) => sum + (v.acquisitionCost ?? 0),
      0,
    );
    const bookValue = vehicles.reduce(
      (sum, v) => sum + (v.currentValue ?? v.acquisitionCost ?? 0),
      0,
    );
    const odometerTotal = vehicles.reduce((sum, v) => sum + v.odometer, 0);

    return {
      org: {
        name: org.name,
        currency: org.currency,
        distanceUnit: org.distanceUnit,
        plan: org.plan,
      },
      counts: {
        vehicles: vehicles.length,
        inService: inService.length,
        assigned: assignedVehicles.length,
        available: statusCounts.available ?? 0,
        active: statusCounts.active ?? 0,
        maintenance: statusCounts.maintenance ?? 0,
        outOfService: statusCounts.out_of_service ?? 0,
        retired: (statusCounts.retired ?? 0) + (statusCounts.sold ?? 0),
        drivers: drivers.length,
        activeDrivers: activeDrivers.length,
        unassignedDrivers: unassignedDrivers.length,
        statusCounts,
        typeCounts,
      },
      value: {
        acquisitionTotal,
        bookValue,
        depreciation: Math.max(acquisitionTotal - bookValue, 0),
      },
      odometer: {
        total: odometerTotal,
        average: vehicles.length
          ? Math.round(odometerTotal / vehicles.length)
          : 0,
        highest: vehicles.reduce(
          (top, v) =>
            v.odometer > top.odometer
              ? { unit: v.unitNumber, odometer: v.odometer }
              : top,
          { unit: "—", odometer: 0 },
        ),
      },
      utilization: inService.length
        ? Math.round((assignedVehicles.length / inService.length) * 100)
        : 0,
      attention,
      attentionCounts: {
        critical: attention.filter((item) => item.severity === "critical")
          .length,
        warning: attention.filter((item) => item.severity === "warning").length,
        total: attention.length,
      },
      recentActivity: activity
        .map((raw) => visibleActivity(context.role, raw))
        .map((row) => ({
          id: row._id,
          action: row.action as ActivityAction,
          entity: row.entity as ActivityEntity,
          entityId: row.entityId ?? null,
          entityLabel: row.entityLabel,
          summary: row.summary,
          actorName: row.actorName,
          createdAt: row.createdAt,
        })),
      setup: {
        hasVehicle: vehicles.length > 0,
        hasDriver: drivers.length > 0,
        hasOrgDetails: Boolean(org.phone || org.addressLine),
      },
      driverRoster: drivers.slice(0, 6).map((driver) => ({
        id: driver._id,
        name: `${driver.firstName} ${driver.lastName}`,
        status: driver.status,
        vehicleUnit:
          vehicleByDriver.get(driver._id as string)?.unitNumber ?? null,
      })),
      unassignedVehicles: inService
        .filter((v) => !v.assignedDriverId && v.status !== "maintenance")
        .slice(0, 6)
        .map((v) => ({
          id: v._id,
          unitNumber: v.unitNumber,
          make: v.make,
          model: v.model,
          status: v.status,
        })),
    };
  },
});

/* -------------------------------------------------------------------------- */
/*  Vehicles                                                                  */
/* -------------------------------------------------------------------------- */

type VehicleRow = {
  id: Id<"vehicles">;
  unitNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number | null;
  plate: string | null;
  vin: string | null;
  fuelType: string;
  odometer: number;
  status: string;
  ownershipType: string;
  acquisitionCost: number | null;
  currentValue: number | null;
  insuranceExpiry: number | null;
  registrationExpiry: number | null;
  nextServiceDate: number | null;
  nextServiceOdometer: number | null;
  depot: string | null;
  notes: string | null;
  assignedDriver: { id: Id<"drivers">; name: string } | null;
  createdAt: number;
  updatedAt: number;
};

function toVehicleRow(
  vehicle: Doc<"vehicles">,
  driver: { id: Id<"drivers">; name: string } | null,
): VehicleRow {
  return {
    id: vehicle._id,
    unitNumber: vehicle.unitNumber,
    vehicleType: vehicle.vehicleType,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ?? null,
    plate: vehicle.plate ?? null,
    vin: vehicle.vin ?? null,
    fuelType: vehicle.fuelType,
    odometer: vehicle.odometer,
    status: vehicle.status,
    ownershipType: vehicle.ownershipType,
    acquisitionCost: vehicle.acquisitionCost ?? null,
    currentValue: vehicle.currentValue ?? null,
    insuranceExpiry: vehicle.insuranceExpiry ?? null,
    registrationExpiry: vehicle.registrationExpiry ?? null,
    nextServiceDate: vehicle.nextServiceDate ?? null,
    nextServiceOdometer: vehicle.nextServiceOdometer ?? null,
    depot: vehicle.depot ?? null,
    notes: vehicle.notes ?? null,
    assignedDriver: driver,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

export const listVehicles = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    driverId: v.optional(v.id("drivers")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return { rows: [] as VehicleRow[], total: 0 };

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);

    const driverIds = Array.from(
      new Set(
        vehicles
          .map((v) => v.assignedDriverId)
          .filter((id): id is Id<"drivers"> => Boolean(id)),
      ),
    );
    // Mesmo cuidado aqui: só entra no mapa o motorista da própria empresa.
    const drivers = await Promise.all(driverIds.map((id) => ctx.db.get(id)));
    const ownDrivers = drivers.filter(
      (driver): driver is NonNullable<typeof driver> =>
        driver !== null && driver.orgId === context.orgId,
    );
    const driverMap = new Map(
      ownDrivers.map((driver) => [
        driver._id as string,
        { id: driver._id, name: `${driver.firstName} ${driver.lastName}` },
      ]),
    );

    const term = (args.search ?? "").trim().toLowerCase();
    let rows = vehicles.map((vehicle) =>
      toVehicleRow(
        vehicle,
        vehicle.assignedDriverId
          ? (driverMap.get(vehicle.assignedDriverId as string) ?? null)
          : null,
      ),
    );

    if (args.status && args.status !== "all")
      rows = rows.filter((row) => row.status === args.status);
    if (args.driverId) {
      rows = rows.filter((row) => row.assignedDriver?.id === args.driverId);
    }
    if (term) {
      rows = rows.filter((row) =>
        [
          row.unitNumber,
          row.plate,
          row.vin,
          row.make,
          row.model,
          row.assignedDriver?.name,
          row.depot,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    }

    rows.sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );
    const limit = Math.min(args.limit ?? 100, 500);
    return { rows: rows.slice(0, limit), total: rows.length };
  },
});

export const vehicleDetail = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return null;
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.orgId !== context.orgId) return null;

    // O veículo já passou pela checagem de orgId acima, mas o motorista vinculado
    // é buscado por id: reconferimos a empresa para que uma referência corrompida
    // (ou um bug de escrita) nunca exponha prontuário de outra empresa.
    const linked = vehicle.assignedDriverId
      ? await ctx.db.get(vehicle.assignedDriverId)
      : null;
    const driver = linked && linked.orgId === context.orgId ? linked : null;
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_record", (q) =>
        q
          .eq("orgId", context.orgId)
          .eq("entity", "vehicle")
          .eq("entityId", args.vehicleId as string),
      )
      .order("desc")
      .take(40);

    // Veículos disponíveis mostrados no seletor de vinculação para mover um motorista em uma etapa.
    const otherVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const activeDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    // Contato e CNH do motorista vinculado são dado pessoal: valem só para quem
    // tem acesso ao prontuário dele (ver access.ts).
    const canSeeDriverContact = driver
      ? canSeeDriverPersonalData(
          context.role,
          driver.accountUserId,
          context.userId,
        )
      : true;

    return {
      vehicle: {
        ...toVehicleRow(
          vehicle,
          driver
            ? { id: driver._id, name: `${driver.firstName} ${driver.lastName}` }
            : null,
        ),
        insurancePolicy: vehicle.insurancePolicy ?? null,
        acquisitionDate: vehicle.acquisitionDate ?? null,
        leaseEndDate: vehicle.leaseEndDate ?? null,
        transmission: vehicle.transmission ?? null,
        odometerUpdatedAt: vehicle.odometerUpdatedAt ?? null,
        createdBy: vehicle.createdBy,
      },
      driver: driver
        ? {
            id: driver._id,
            name: `${driver.firstName} ${driver.lastName}`,
            phone: canSeeDriverContact ? (driver.phone ?? null) : null,
            email: canSeeDriverContact ? (driver.email ?? null) : null,
            status: driver.status,
            licenseNumber: canSeeDriverContact ? driver.licenseNumber : "",
            licenseExpiry: canSeeDriverContact
              ? (driver.licenseExpiry ?? null)
              : null,
          }
        : null,
      activity: activity
        .map((raw) => visibleActivity(context.role, raw))
        .map((row) => ({
          id: row._id,
          action: row.action as ActivityAction,
          summary: row.summary,
          actorName: row.actorName,
          changes: row.changes ?? [],
          createdAt: row.createdAt,
        })),
      driverOptions: activeDrivers.map((row) => ({
        id: row._id,
        name: `${row.firstName} ${row.lastName}`,
        status: row.status,
        assignedUnit:
          otherVehicles.find((v) => v.assignedDriverId === row._id)
            ?.unitNumber ?? null,
      })),
    };
  },
});

export const createVehicle = mutation({
  args: { ...vehicleInput },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(
      context.role,
      FLEET_WRITE_ROLES,
      "Seu papel não permite cadastrar veículos.",
    );
    await limit(ctx, context.orgId, "createVehicle");

    const clean = vehicleFromInput(args as unknown as Record<string, unknown>);

    const duplicateUnit = await ctx.db
      .query("vehicles")
      .withIndex("by_org_unit", (q) =>
        q.eq("orgId", context.orgId).eq("unitNumber", clean.unitNumber),
      )
      .first();
    if (duplicateUnit) {
      throw new ConvexError(
        `A unidade ${clean.unitNumber} já existe no seu registro.`,
      );
    }
    if (clean.vin) {
      const duplicateVin = await ctx.db
        .query("vehicles")
        .withIndex("by_org_vin", (q) =>
          q.eq("orgId", context.orgId).eq("vin", clean.vin!),
        )
        .first();
      if (duplicateVin)
        throw new ConvexError(
          "Esse chassi (VIN) já está cadastrado em outra unidade.",
        );
    }
    if (clean.plate) {
      const duplicatePlate = await ctx.db
        .query("vehicles")
        .withIndex("by_org_plate", (q) =>
          q.eq("orgId", context.orgId).eq("plate", clean.plate!),
        )
        .first();
      if (duplicatePlate) {
        throw new ConvexError(
          `A placa ${clean.plate} já é usada pela unidade ${duplicatePlate.unitNumber}.`,
        );
      }
    }
    if (clean.assignedDriverId) {
      const driver = await ctx.db.get(clean.assignedDriverId);
      if (!driver || driver.orgId !== context.orgId) {
        throw new ConvexError("Esse motorista não faz parte da sua empresa.");
      }
    }

    const now = Date.now();
    const vehicleId = await ctx.db.insert("vehicles", {
      ...clean,
      orgId: context.orgId,
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "create",
      entity: "vehicle",
      entityId: vehicleId as string,
      entityLabel: `Unidade ${clean.unitNumber}`,
      summary: `Cadastrou ${clean.year ? `${clean.year} ` : ""}${clean.make} ${clean.model} como unidade ${clean.unitNumber}.`,
    });

    return { vehicleId };
  },
});

export const updateVehicle = mutation({
  args: { vehicleId: v.id("vehicles"), ...vehicleInput },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(
      context.role,
      FLEET_WRITE_ROLES,
      "Seu papel não permite editar veículos.",
    );

    const existing = await ctx.db.get(args.vehicleId);
    if (!existing || existing.orgId !== context.orgId) {
      throw new ConvexError("Esse veículo não está no seu registro.");
    }

    const clean = vehicleFromInput(args as unknown as Record<string, unknown>, {
      status: existing.status,
      odometer: existing.odometer,
    });

    const duplicateUnit = await ctx.db
      .query("vehicles")
      .withIndex("by_org_unit", (q) =>
        q.eq("orgId", context.orgId).eq("unitNumber", clean.unitNumber),
      )
      .first();
    if (duplicateUnit && duplicateUnit._id !== existing._id) {
      throw new ConvexError(
        `A unidade ${clean.unitNumber} já existe no seu registro.`,
      );
    }
    if (clean.vin && clean.vin !== existing.vin) {
      const duplicateVin = await ctx.db
        .query("vehicles")
        .withIndex("by_org_vin", (q) =>
          q.eq("orgId", context.orgId).eq("vin", clean.vin!),
        )
        .first();
      if (duplicateVin && duplicateVin._id !== existing._id) {
        throw new ConvexError(
          "Esse chassi (VIN) já está cadastrado em outra unidade.",
        );
      }
    }
    if (clean.plate && clean.plate !== existing.plate) {
      const duplicatePlate = await ctx.db
        .query("vehicles")
        .withIndex("by_org_plate", (q) =>
          q.eq("orgId", context.orgId).eq("plate", clean.plate!),
        )
        .first();
      if (duplicatePlate && duplicatePlate._id !== existing._id) {
        throw new ConvexError(
          `A placa ${clean.plate} já é usada pela unidade ${duplicatePlate.unitNumber}.`,
        );
      }
    }
    if (clean.assignedDriverId) {
      const driver = await ctx.db.get(clean.assignedDriverId);
      if (!driver || driver.orgId !== context.orgId) {
        throw new ConvexError("Esse motorista não faz parte da sua empresa.");
      }
    }

    // One driver runs one unit. If the chosen driver is currently on another
    // vehicle, release that vehicle first — otherwise the driver would be
    // linked to two units at once and the register would disagree with itself.
    if (
      clean.assignedDriverId &&
      clean.assignedDriverId !== existing.assignedDriverId
    ) {
      const previousHolders = await ctx.db
        .query("vehicles")
        .withIndex("by_org_driver", (q) =>
          q
            .eq("orgId", context.orgId)
            .eq("assignedDriverId", clean.assignedDriverId!),
        )
        .take(10);
      for (const holder of previousHolders) {
        if (holder._id === existing._id) continue;
        await ctx.db.patch(holder._id, {
          assignedDriverId: undefined,
          status: holder.status === "assigned" ? "available" : holder.status,
          updatedAt: Date.now(),
        });
      }
    }

    // Keep the status column honest with the assignment.
    if (
      clean.assignedDriverId &&
      !existing.assignedDriverId &&
      (clean.status === "available" || clean.status === "active")
    ) {
      clean.status = "assigned";
    } else if (
      !clean.assignedDriverId &&
      existing.assignedDriverId &&
      clean.status === "assigned"
    ) {
      clean.status = "available";
    }

    // Clearing a field must remove the stored value, not leave it behind.
    const patch: Record<string, unknown> = { ...clean, updatedAt: Date.now() };
    for (const key of [
      "year",
      "vin",
      "plate",
      "transmission",
      "acquisitionDate",
      "acquisitionCost",
      "currentValue",
      "leaseEndDate",
      "insurancePolicy",
      "insuranceExpiry",
      "registrationExpiry",
      "nextServiceDate",
      "nextServiceOdometer",
      "assignedDriverId",
      "depot",
      "notes",
    ]) {
      if ((clean as Record<string, unknown>)[key] === undefined)
        patch[key] = undefined;
    }

    const changes = await vehicleChanges(
      ctx,
      existing as unknown as Record<string, unknown>,
      clean,
      context.orgId,
    );
    await ctx.db.patch(existing._id, patch);

    const statusChanged = existing.status !== clean.status;
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: statusChanged
        ? "status_change"
        : changes.some((c) => c.field === "Motorista vinculado")
          ? "assign"
          : "update",
      entity: "vehicle",
      entityId: existing._id as string,
      entityLabel: `Unidade ${clean.unitNumber}`,
      summary: statusChanged
        ? `Situação alterada de ${existing.status.replace(/_/g, " ")} para ${clean.status.replace(/_/g, " ")}.`
        : "Registro do veículo atualizado com sucesso.",
      changes,
    });

    return { vehicleId: existing._id };
  },
});

export const deleteVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(
      context.role,
      COMPANY_ROLES,
      "Somente proprietário ou administrador pode excluir veículos.",
    );

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.orgId !== context.orgId) {
      throw new ConvexError("Esse veículo não está no seu registro.");
    }

    // Cascade: service records and documents belong to the vehicle. Leaving them
    // behind kept personal data (costs, vendors, notes, tax amounts) alive after
    // the user asked for the vehicle to be gone — and made "clear my data" a lie.
    const maintenanceRows = await ctx.db
      .query("maintenanceRecords")
      .withIndex("by_org_vehicle", (q) =>
        q.eq("orgId", context.orgId).eq("vehicleId", vehicle._id),
      )
      .collect();
    const documentRows = await ctx.db
      .query("vehicleDocuments")
      .withIndex("by_org_vehicle", (q) =>
        q.eq("orgId", context.orgId).eq("vehicleId", vehicle._id),
      )
      .collect();

    for (const row of maintenanceRows) await ctx.db.delete(row._id);
    for (const row of documentRows) await ctx.db.delete(row._id);
    await ctx.db.delete(vehicle._id);

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "vehicle",
      entityId: vehicle._id as string,
      entityLabel: `Unidade ${vehicle.unitNumber}`,
      summary: `Removeu a unidade ${vehicle.unitNumber} (${vehicle.make} ${vehicle.model}) do registro, com ${maintenanceRows.length} manutenção(ões) e ${documentRows.length} documento(s).`,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/*  Demo data                                                                 */
/* -------------------------------------------------------------------------- */

const DEMO_VEHICLES: {
  unitNumber: string;
  vehicleType: (typeof VEHICLE_TYPES)[number];
  make: string;
  model: string;
  year: number;
  vin: string;
  plate: string;
  fuelType: (typeof FUEL_TYPES)[number];
  odometer: number;
  acquisitionCost: number;
  currentValue: number;
  status: string;
  depot: string;
  insuranceOffset: number;
  registrationOffset: number;
  serviceOffset: number;
}[] = [
  {
    unitNumber: "101",
    vehicleType: "truck",
    make: "Volvo",
    model: "FH 500",
    year: 2021,
    vin: "9ZZ00000000000101",
    plate: "SPP-1012",
    fuelType: "diesel",
    odometer: 412500,
    acquisitionCost: 238000,
    currentValue: 142000,
    status: "assigned",
    depot: "Galpão Centro",
    insuranceOffset: 210,
    registrationOffset: 96,
    serviceOffset: 18,
  },
  {
    unitNumber: "102",
    vehicleType: "truck",
    make: "Mercedes-Benz",
    model: "Actros 1848",
    year: 2022,
    vin: "9ZZ00000000000102",
    plate: "SPP-2071",
    fuelType: "diesel",
    odometer: 288900,
    acquisitionCost: 276000,
    currentValue: 171000,
    status: "assigned",
    depot: "Galpão Centro",
    insuranceOffset: 12,
    registrationOffset: 240,
    serviceOffset: 40,
  },
  {
    unitNumber: "103",
    vehicleType: "truck",
    make: "Scania",
    model: "S530",
    year: 2020,
    vin: "9ZZ00000000000103",
    plate: "SPP-3045",
    fuelType: "diesel",
    odometer: 521300,
    acquisitionCost: 229000,
    currentValue: 101000,
    status: "maintenance",
    depot: "Pátio Norte",
    insuranceOffset: 150,
    registrationOffset: 20,
    serviceOffset: -6,
  },
  {
    unitNumber: "104",
    vehicleType: "van",
    make: "Ford",
    model: "Transit 2.4",
    year: 2023,
    vin: "9ZZ00000000000104",
    plate: "SPP-4783",
    fuelType: "diesel",
    odometer: 62400,
    acquisitionCost: 142000,
    currentValue: 98000,
    status: "assigned",
    depot: "Base Metropolitana",
    insuranceOffset: 320,
    registrationOffset: 300,
    serviceOffset: 55,
  },
  {
    unitNumber: "105",
    vehicleType: "pickup",
    make: "Toyota",
    model: "Hilux 4x4",
    year: 2022,
    vin: "9ZZ00000000000105",
    plate: "SPP-5528",
    fuelType: "diesel",
    odometer: 98700,
    acquisitionCost: 186000,
    currentValue: 112000,
    status: "available",
    depot: "Base Metropolitana",
    insuranceOffset: 88,
    registrationOffset: 150,
    serviceOffset: 30,
  },
  {
    unitNumber: "106",
    vehicleType: "truck",
    make: "International",
    model: "HT7100",
    year: 2019,
    vin: "9ZZ00000000000106",
    plate: "SPP-6020",
    fuelType: "diesel",
    odometer: 688400,
    acquisitionCost: 187000,
    currentValue: 71000,
    status: "out_of_service",
    depot: "Pátio Norte",
    insuranceOffset: -9,
    registrationOffset: 60,
    serviceOffset: -21,
  },
  {
    unitNumber: "107",
    vehicleType: "van",
    make: "Mercedes-Benz",
    model: "Sprinter 313 CDI",
    year: 2024,
    vin: "9ZZ00000000000107",
    plate: "SPP-7394",
    fuelType: "diesel",
    odometer: 21850,
    acquisitionCost: 198000,
    currentValue: 181000,
    status: "assigned",
    depot: "Base Metropolitana",
    insuranceOffset: 400,
    registrationOffset: 380,
    serviceOffset: 80,
  },
  {
    unitNumber: "108",
    vehicleType: "trailer",
    make: "Great Dane",
    model: "Everest 53",
    year: 2020,
    vin: "9ZZ00000000000108",
    plate: "SPP-8112",
    fuelType: "diesel",
    odometer: 0,
    acquisitionCost: 42000,
    currentValue: 31000,
    status: "available",
    depot: "Galpão Centro",
    insuranceOffset: 200,
    registrationOffset: 44,
    serviceOffset: 120,
  },
];

const DEMO_DRIVERS: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  licenseNumber: string;
  licenseClass: string;
  licenseOffset: number;
  medicalOffset: number;
  hireOffset: number;
  status: string;
  compensationModel: string;
  rate: number;
  unit?: string;
}[] = [
  {
    firstName: "Ricardo",
    lastName: "D'Almeida",
    phone: "(11) 96521-8847",
    email: "ricardo.dalmeida@exemplo.com.br",
    city: "São Paulo",
    licenseNumber: "SP-14825796",
    licenseClass: "A",
    licenseOffset: 420,
    medicalOffset: 190,
    hireOffset: -1450,
    status: "active",
    compensationModel: "per_mile",
    rate: 0.62,
    unit: "101",
  },
  {
    firstName: "Gabriela",
    lastName: "Machado",
    phone: "(21) 98254-0193",
    email: "gabriela.machado@exemplo.com.br",
    city: "Rio de Janeiro",
    licenseNumber: "SP-25741099",
    licenseClass: "A",
    licenseOffset: 18,
    medicalOffset: 42,
    hireOffset: -980,
    status: "active",
    compensationModel: "per_mile",
    rate: 0.64,
    unit: "102",
  },
  {
    firstName: "Carlos",
    lastName: "Sousa",
    phone: "(31) 99102-7742",
    email: "carlos.sousa@exemplo.com.br",
    city: "Belo Horizonte",
    licenseNumber: "SP-37610884",
    licenseClass: "A",
    licenseOffset: -12,
    medicalOffset: 25,
    hireOffset: -2200,
    status: "active",
    compensationModel: "hourly",
    rate: 34,
    unit: "104",
  },
  {
    firstName: "Sofia",
    lastName: "Marchetti",
    phone: "(11) 97348-6166",
    email: "sofia.marchetti@exemplo.com.br",
    city: "São Paulo",
    licenseNumber: "SP-48922105",
    licenseClass: "B",
    licenseOffset: 260,
    medicalOffset: 150,
    hireOffset: -640,
    status: "active",
    compensationModel: "salary",
    rate: 78000,
    unit: "107",
  },
  {
    firstName: "Gustavo",
    lastName: "Pereira",
    phone: "(19) 98783-7781",
    email: "gustavo.pereira@exemplo.com.br",
    city: "Campinas",
    licenseNumber: "SP-59502112",
    licenseClass: "A",
    licenseOffset: 132,
    medicalOffset: 38,
    hireOffset: -3100,
    status: "on_leave",
    compensationModel: "per_trip",
    rate: 210,
  },
  {
    firstName: "Elena",
    lastName: "Vargas",
    phone: "(51) 98431-5221",
    email: "elena.vargas@exemplo.com.br",
    city: "Porto Alegre",
    licenseNumber: "SP-61095638",
    licenseClass: "C",
    licenseOffset: 96,
    medicalOffset: 88,
    hireOffset: -320,
    status: "active",
    compensationModel: "hourly",
    rate: 29,
  },
];

export const seedDemoFleet = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireOrg(ctx);
    requireRole(
      context.role,
      FLEET_WRITE_ROLES,
      "Seu papel não permite carregar dados de exemplo na frota.",
    );
    await limit(ctx, context.orgId, "seed");

    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(1);
    const existingDriver = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .first();
    if (existingVehicles.length || existingDriver) {
      throw new ConvexError(
        "Seu cadastro já possui veículos ou motoristas. Use exemplos apenas em uma empresa vazia.",
      );
    }

    const now = Date.now();
    const vehicleIds = new Map<string, Id<"vehicles">>();

    for (const sample of DEMO_VEHICLES) {
      const id = await ctx.db.insert("vehicles", {
        orgId: context.orgId,
        unitNumber: sample.unitNumber,
        vehicleType: sample.vehicleType,
        make: sample.make,
        model: sample.model,
        year: sample.year,
        vin: sample.vin,
        plate: sample.plate,
        fuelType: sample.fuelType,
        transmission: "automatic",
        odometer: sample.odometer,
        odometerUpdatedAt: now - 2 * DAY,
        ownershipType: sample.unitNumber === "108" ? "leased" : "owned",
        acquisitionDate: now - 900 * DAY,
        acquisitionCost: sample.acquisitionCost,
        currentValue: sample.currentValue,
        insurancePolicy: `POL-${sample.unitNumber}9932`,
        insuranceExpiry: now + sample.insuranceOffset * DAY,
        registrationExpiry: now + sample.registrationOffset * DAY,
        nextServiceDate: now + sample.serviceOffset * DAY,
        nextServiceOdometer: sample.odometer + 15000,
        status: sample.status as Infer<typeof vehicleStatusValidator>,
        depot: undefined,
        notes:
          sample.status === "out_of_service"
            ? "Falha no turbo — aguardando peças do fornecedor."
            : undefined,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      vehicleIds.set(sample.unitNumber, id);
    }

    for (const sample of DEMO_DRIVERS) {
      const vehicleId = sample.unit ? vehicleIds.get(sample.unit) : undefined;
      await ctx.db.insert("drivers", {
        orgId: context.orgId,
        firstName: sample.firstName,
        lastName: sample.lastName,
        phone: sample.phone,
        email: sample.email,
        city: sample.city,
        licenseNumber: sample.licenseNumber,
        licenseClass: sample.licenseClass,
        licenseExpiry: now + sample.licenseOffset * DAY,
        medicalExpiry: now + sample.medicalOffset * DAY,
        hireDate: now + sample.hireOffset * DAY,
        status: sample.status as Infer<typeof driverStatusValidator>,
        compensationModel: sample.compensationModel as Infer<
          typeof compensationValidator
        >,
        rate: sample.rate,
        depot: undefined,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      if (vehicleId) {
        await ctx.db.patch(vehicleId, { assignedDriverId: undefined });
      }
    }

    // Second pass: assign drivers to units now that both sides exist.
    const insertedDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(100);
    for (const sample of DEMO_DRIVERS) {
      const vehicleId = sample.unit ? vehicleIds.get(sample.unit) : undefined;
      if (!vehicleId) continue;
      const driver = insertedDrivers.find(
        (row) => row.licenseNumber === sample.licenseNumber,
      );
      if (!driver) continue;
      await ctx.db.patch(vehicleId, {
        assignedDriverId: driver._id,
        updatedAt: now,
      });
    }

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "seed",
      entity: "workspace",
      entityLabel: "Frota de exemplo",
      summary: `Carregou dados de exemplo: ${DEMO_VEHICLES.length} veículos e ${DEMO_DRIVERS.length} motoristas (fictícios).`,
      // Dados de demonstração são fictícios: nenhuma pessoa real ou placa real é cadastrada no sistema.
    });

    return { vehicles: DEMO_VEHICLES.length, drivers: DEMO_DRIVERS.length };
  },
});

export const clearFleetData = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireOrg(ctx);
    requireRole(
      context.role,
      COMPANY_ROLES,
      "Somente proprietário ou administrador pode limpar os dados da frota.",
    );
    // Operação destrutiva e pesada: cota baixa para não virar script de teste massivo.
    await limit(ctx, context.orgId, "bulk");

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .collect();
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .collect();
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .collect();
    // Registros filhos costumavam sobreviver a esta limpeza: histórico de serviços, peças, custos,
    // fornecedores e valores de impostos ficavam no banco depois que o usuário pediu
    // para limpar tudo — o que tornava a copia na tela de dados falsa.
    const maintenance = await ctx.db
      .query("maintenanceRecords")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .collect();
    const documents = await ctx.db
      .query("vehicleDocuments")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .collect();

    for (const vehicle of vehicles) await ctx.db.delete(vehicle._id);
    for (const driver of drivers) await ctx.db.delete(driver._id);
    for (const row of activity) await ctx.db.delete(row._id);
    for (const row of maintenance) await ctx.db.delete(row._id);
    for (const row of documents) await ctx.db.delete(row._id);

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "workspace",
      entityLabel: "Cadastro da frota",
      summary: `Limpou o cadastro — removeu ${vehicles.length} veículo(s), ${drivers.length} motorista(s), ${maintenance.length} manutenção(ões) e ${documents.length} documento(s).`,
    });

    return {
      vehicles: vehicles.length,
      drivers: drivers.length,
      maintenance: maintenance.length,
      documents: documents.length,
    };
  },
});

/** Used by the setup wizard to report progress. */
export const setupProgress = query({
  args: {},
  handler: async (ctx) => {
    const context = await orgContext(ctx);
    if (!context) return null;
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(1);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(1);
    return {
      hasVehicle: vehicles.length > 0,
      hasDriver: drivers.length > 0,
      completedAt: context.org.setupCompletedAt ?? null,
      roleName: context.role,
      orgName: context.org.name,
      orgRoles: ORG_ROLES,
    };
  },
});
