import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  COMPANY_ROLES,
  COMPENSATION_ROLES,
  DRIVER_STATUSES,
  EXPIRY_WARNING_DAYS,
  FLEET_WRITE_ROLES,
  FUEL_TYPES,
  ORG_ROLES,
  OWNER_ROLES,
  TEAM_ROLES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type OrgRole,
} from "./constants";
import {
  activityActionValidator,
  activityEntityValidator,
  compensationValidator,
  distanceUnitValidator,
  driverStatusValidator,
  fuelTypeValidator,
  orgRoleValidator,
  ownershipValidator,
  transmissionValidator,
  vehicleStatusValidator,
  vehicleTypeValidator,
  volumeUnitValidator,
  type ActivityAction,
  type ActivityEntity,
} from "./schema";

const DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Shared input validators                                                   */
/* -------------------------------------------------------------------------- */

const vehicleInput = {    unitNumber: v.string(),
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

const driverInput = {
  firstName: v.string(),
  lastName: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  addressLine: v.optional(v.string()),
  city: v.optional(v.string()),
  licenseNumber: v.string(),
  licenseClass: v.optional(v.string()),
  licenseExpiry: v.optional(v.number()),
  medicalExpiry: v.optional(v.number()),
  hireDate: v.optional(v.number()),
  status: driverStatusValidator,
  compensationModel: compensationValidator,
  rate: v.optional(v.number()),
  emergencyContactName: v.optional(v.string()),
  emergencyContactPhone: v.optional(v.string()),
  depot: v.optional(v.string()),
  notes: v.optional(v.string()),
  /** Setting this moves the driver onto that vehicle (single source of truth). */
  assignedVehicleId: v.optional(v.id("vehicles")),
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

type CleanDriver = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  licenseNumber: string;
  licenseClass?: string;
  licenseExpiry?: number;
  medicalExpiry?: number;
  hireDate?: number;
  status: Infer<typeof driverStatusValidator>;
  compensationModel: Infer<typeof compensationValidator>;
  rate?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
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
  role: OrgRole;
};

async function signedInUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return {
    userId,
    name: user?.name ?? user?.email ?? "Team member",
    email: user?.email ?? "",
  };
}

/** Resolves the signed-in user's company. Null when there is no company yet. */
async function orgContext(ctx: QueryCtx | MutationCtx) {
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

async function requireOrg(ctx: QueryCtx | MutationCtx): Promise<OrgContext> {
  const user = await signedInUser(ctx);
  if (!user) throw new ConvexError("Sua sessão expirou. Entre novamente.");
  const context = await orgContext(ctx);
  if (!context) {
    throw new ConvexError("Crie o perfil da empresa antes de registrar dados da frota.");
  }
  return {
    userId: context.userId,
    actorName: context.actorName,
    orgId: context.orgId,
    role: context.role,
  };
}

function requireRole(role: OrgRole, allowed: OrgRole[], message: string) {
  if (!allowed.includes(role)) throw new ConvexError(message);
}

/**
 * Compensation is payroll data. Only the roles that actually run the numbers
 * get to read it — a driver or a dispatcher must not see what a colleague
 * earns (LGPD: dado pessoal sensível no contexto trabalhista).
 */
function canSeeCompensation(role: OrgRole) {
  return COMPENSATION_ROLES.includes(role);
}

/* -------------------------------------------------------------------------- */
/*  Field parsing / validation                                                */
/* -------------------------------------------------------------------------- */

function readText(input: Record<string, unknown>, key: string, label: string, max = 120) {
  const raw = input[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new ConvexError(`${label} é obrigatório.`);
  if (value.length > max) throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

function readOptionalText(
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
  if (value.length > max) throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

function readEnum<T extends string>(
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

function readOptionalEnum<T extends string>(
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

function readOptionalNumber(
  input: Record<string, unknown>,
  key: string,
  label: string,
  opts: { min?: number; max?: number } = {},
) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return readNumber(input, key, label, opts);
}

function readOptionalDate(input: Record<string, unknown>, key: string, label: string) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value =
    typeof raw === "number" ? raw : typeof raw === "string" ? Date.parse(`${raw}T00:00:00`) : NaN;
  if (!Number.isFinite(value)) throw new ConvexError(`${label} não é uma data válida.`);
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
  const odometer = readNumber(input, "odometer", "Odometer", { min: 0, max: 5_000_000 });
  const unitNumber = readText(input, "unitNumber", "Número da unidade", 40);
  const year = readOptionalNumber(input, "year", "Ano", { min: 1900, max: new Date().getFullYear() + 2 });

  const draft: CleanVehicle = {
    unitNumber,
    vehicleType: readEnum(input, "vehicleType", VEHICLE_TYPES, "Tipo de veículo"),
    make: readText(input, "make", "Marca", 60),
    model: readText(input, "model", "Modelo", 60),
    fuelType: readEnum(input, "fuelType", FUEL_TYPES, "Combustível"),
    ownershipType: readEnum(
      input,
      "ownershipType",
      ["owned", "financed", "leased", "rented"] as const,
      "Ownership type",
    ),
    status: readEnum(input, "status", VEHICLE_STATUSES, "Situação"),
    odometer,
    odometerUpdatedAt: Date.now(),
    notes: readOptionalText(input, "notes", "Observações", 2000),
  };

  if (year !== undefined) draft.year = Math.round(year);
  const vin = normalizeVin(readOptionalText(input, "vin", "Chassi (VIN)", 40), "Chassi (VIN)");
  if (vin) draft.vin = vin;
  const plate = readOptionalText(input, "plate", "Placa", 20);
  if (plate) draft.plate = plate.toUpperCase();

  const transmission = readOptionalEnum(
    input,
    "transmission",
    ["automatic", "manual", "automated_manual"] as const,
    "Transmission",
  );
  if (transmission) draft.transmission = transmission;

  const acquisitionDate = readOptionalDate(input, "acquisitionDate", "Data de aquisição");
  if (acquisitionDate) draft.acquisitionDate = acquisitionDate;
  const leaseEndDate = readOptionalDate(input, "leaseEndDate", "Fim do contrato de locação");
  if (leaseEndDate) draft.leaseEndDate = leaseEndDate;
  const insuranceExpiry = readOptionalDate(input, "insuranceExpiry", "Vencimento do seguro");
  if (insuranceExpiry) draft.insuranceExpiry = insuranceExpiry;
  const registrationExpiry = readOptionalDate(input, "registrationExpiry", "Vencimento do licenciamento");
  if (registrationExpiry) draft.registrationExpiry = registrationExpiry;
  const nextServiceDate = readOptionalDate(input, "nextServiceDate", "Próxima revisão");
  if (nextServiceDate) draft.nextServiceDate = nextServiceDate;

  const acquisitionCost = readOptionalNumber(input, "acquisitionCost", "Custo de aquisição", {
    min: 0,
    max: 100_000_000,
  });
  if (acquisitionCost !== undefined) draft.acquisitionCost = acquisitionCost;
  const currentValue = readOptionalNumber(input, "currentValue", "Valor atual", {
    min: 0,
    max: 100_000_000,
  });
  if (currentValue !== undefined) draft.currentValue = currentValue;
  const nextServiceOdometer = readOptionalNumber(input, "nextServiceOdometer", "Hodômetro da próxima revisão", {
    min: 0,
    max: 5_000_000,
  });
  if (nextServiceOdometer !== undefined) draft.nextServiceOdometer = nextServiceOdometer;

  const insurancePolicy = readOptionalText(input, "insurancePolicy", "Apólice do seguro", 80);
  if (insurancePolicy) draft.insurancePolicy = insurancePolicy;
  const depot = readOptionalText(input, "depot", "Base / pátio", 80);
  if (depot) draft.depot = depot;

  const assignedDriverId = input.assignedDriverId;
  if (assignedDriverId) draft.assignedDriverId = assignedDriverId as Id<"drivers">;

  if (current?.odometer !== undefined && odometer < current.odometer) {
    throw new ConvexError(
      `O odômetro não pode ser menor que a última leitura (${current.odometer.toLocaleString("pt-BR")}).`,
    );
  }

  return draft;
}

function driverFromInput(input: Record<string, unknown>): CleanDriver {
  const draft: CleanDriver = {
    firstName: readText(input, "firstName", "Nome", 60),
    lastName: readText(input, "lastName", "Sobrenome", 60),
    licenseNumber: readText(input, "licenseNumber", "CNH", 40),
    status: readEnum(input, "status", DRIVER_STATUSES, "Situação do vínculo"),
    compensationModel: readEnum(
      input,
      "compensationModel",
      ["salary", "hourly", "per_mile", "per_trip", "owner_operator"] as const,
      "Modelo de remuneração",
    ),
    notes: readOptionalText(input, "notes", "Observações", 2000),
  };

  const phone = readOptionalText(input, "phone", "Telefone", 40);
  if (phone) draft.phone = phone;
  const email = readOptionalText(input, "email", "E-mail", 120);
  if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError("Informe um e-mail válido.");
    }
    draft.email = email;
  }
  const addressLine = readOptionalText(input, "addressLine", "Endereço", 200);
  if (addressLine) draft.addressLine = addressLine;
  const city = readOptionalText(input, "city", "Cidade", 80);
  if (city) draft.city = city;
  const licenseClass = readOptionalText(input, "licenseClass", "Categoria da CNH", 20);
  if (licenseClass) draft.licenseClass = licenseClass;
  const depot = readOptionalText(input, "depot", "Base / pátio", 80);
  if (depot) draft.depot = depot;

  const licenseExpiry = readOptionalDate(input, "licenseExpiry", "Validade da CNH");
  if (licenseExpiry) draft.licenseExpiry = licenseExpiry;
  const medicalExpiry = readOptionalDate(input, "medicalExpiry", "Validade do exame toxicológico");
  if (medicalExpiry) draft.medicalExpiry = medicalExpiry;
  const hireDate = readOptionalDate(input, "hireDate", "Data de admissão");
  if (hireDate) draft.hireDate = hireDate;

  const rate = readOptionalNumber(input, "rate", "Valor da remuneração", { min: 0, max: 10_000_000 });
  if (rate !== undefined) draft.rate = rate;
  const emergencyContactName = readOptionalText(input, "emergencyContactName", "Contato de emergência", 120);
  if (emergencyContactName) draft.emergencyContactName = emergencyContactName;
  const emergencyContactPhone = readOptionalText(
    input,
    "emergencyContactPhone",
    "Telefone do contato de emergência",
    40,
  );
  if (emergencyContactPhone) draft.emergencyContactPhone = emergencyContactPhone;

  return draft;
}

/* -------------------------------------------------------------------------- */
/*  Audit trail                                                               */
/* -------------------------------------------------------------------------- */

async function logActivity(
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
) {
  const changes: { field: string; from?: string; to?: string }[] = [];
  for (const { key, label } of VEHICLE_TRACKED_FIELDS) {
    const from = before[key as string];
    const to = after[key];
    if (key === "assignedDriverId") {
      const fromName = from ? await driverName(ctx, from as Id<"drivers">) : undefined;
      const toName = to ? await driverName(ctx, to as Id<"drivers">) : undefined;
      if (fromName !== toName) changes.push({ field: label, from: fromName, to: toName });
      continue;
    }
    if (formatChangeValue(from) !== formatChangeValue(to)) {
      changes.push({ field: label, from: formatChangeValue(from), to: formatChangeValue(to) });
    }
  }
  return changes;
}

const DRIVER_TRACKED_FIELDS: { key: keyof CleanDriver; label: string }[] = [
  { key: "firstName", label: "Nome" },
  { key: "lastName", label: "Sobrenome" },
  { key: "status", label: "Situação" },
  { key: "licenseNumber", label: "Número da CNH" },
  { key: "licenseExpiry", label: "Validade da CNH" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "rate", label: "Remuneração" },
];

function diffFields<T>(
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

async function driverName(ctx: MutationCtx | QueryCtx, driverId: Id<"drivers">) {
  const driver = await ctx.db.get(driverId);
  if (!driver) return "Unassigned";
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
        organizations: organizations.map((org) => ({ id: org._id, name: org.name })),
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
        return {
          membershipId: row._id,
          userId: row.userId,
          name: memberUser?.name ?? memberUser?.email ?? "Team member",
          email: memberUser?.email ?? "",
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

    const vehicles = await ctx.db.query("vehicles").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(500);
    const drivers = await ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(500);
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(10);

    const vehicleByDriver = new Map<string, (typeof vehicles)[number]>();
    for (const vehicle of vehicles) {
      if (vehicle.assignedDriverId) vehicleByDriver.set(vehicle.assignedDriverId as string, vehicle);
    }

    const inService = vehicles.filter((v) => v.status !== "retired" && v.status !== "sold");
    const assignedVehicles = inService.filter((v) => Boolean(v.assignedDriverId));
    const statusCounts = VEHICLE_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = vehicles.filter((v) => v.status === status).length;
      return acc;
    }, {});
    const typeCounts = VEHICLE_TYPES.map((type) => ({
      label: type,
      count: vehicles.filter((v) => v.vehicleType === type).length,
    })).filter((row) => row.count > 0);

    const activeDrivers = drivers.filter((d) => d.status === "active");
    const unassignedDrivers = activeDrivers.filter((d) => !vehicleByDriver.has(d._id as string));

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
            title: days < 0 ? `Seguro da ${label} vencido` : `Seguro da ${label} vence em breve`,
            detail: days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : `Vence em ${days} dia(s)`,
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
            title: days < 0 ? `Licenciamento da ${label} vencido` : `Licenciamento da ${label} vence em breve`,
            detail: days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : `Vence em ${days} dia(s)`,
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
        } else if (vehicle.nextServiceOdometer && vehicle.odometer >= vehicle.nextServiceOdometer) {
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
          detail: vehicle.notes ? vehicle.notes.slice(0, 90) : "Nenhum motivo registrado ainda",
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
      const name = `${driver.firstName} ${driver.lastName}`;
      if (driver.licenseExpiry) {
        const severity = expirySeverity(driver.licenseExpiry);
        if (severity) {
          const days = daysUntil(driver.licenseExpiry);
          attention.push({
            id: `${driver._id}-license`,
            kind: "compliance",
            severity,
            title: days < 0 ? `CNH de ${name} vencida` : `CNH de ${name} vence em breve`,
            detail: days < 0 ? `Vencida há ${Math.abs(days)} dia(s)` : `Vence em ${days} dia(s)`,
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
            detail: days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : `Vence em ${days} dia(s)`,
            href: `/drivers/${driver._id}`,
          });
        }
      }
    }

    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    attention.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

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
    const unitLabel = new Map(vehicles.map((v) => [v._id as string, v.unitNumber]));

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
      } else if (
        record.nextServiceOdometer &&
        record.nextServiceOdometer > 0
      ) {
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

    const acquisitionTotal = vehicles.reduce((sum, v) => sum + (v.acquisitionCost ?? 0), 0);
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
        average: vehicles.length ? Math.round(odometerTotal / vehicles.length) : 0,
        highest: vehicles.reduce(
          (top, v) => (v.odometer > top.odometer ? { unit: v.unitNumber, odometer: v.odometer } : top),
          { unit: "—", odometer: 0 },
        ),
      },
      utilization: inService.length
        ? Math.round((assignedVehicles.length / inService.length) * 100)
        : 0,
      attention,
      attentionCounts: {
        critical: attention.filter((item) => item.severity === "critical").length,
        warning: attention.filter((item) => item.severity === "warning").length,
        total: attention.length,
      },
      recentActivity: activity.map((row) => ({
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
        vehicleUnit: vehicleByDriver.get(driver._id as string)?.unitNumber ?? null,
      })),
      unassignedVehicles: inService
        .filter((v) => !v.assignedDriverId && v.status !== "maintenance")
        .slice(0, 6)
        .map((v) => ({ id: v._id, unitNumber: v.unitNumber, make: v.make, model: v.model, status: v.status })),
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
      new Set(vehicles.map((v) => v.assignedDriverId).filter((id): id is Id<"drivers"> => Boolean(id))),
    );
    const drivers = await Promise.all(driverIds.map((id) => ctx.db.get(id)));
    const driverMap = new Map(
      drivers
        .filter((driver): driver is NonNullable<typeof driver> => Boolean(driver))
        .map((driver) => [
          driver._id as string,
          { id: driver._id, name: `${driver.firstName} ${driver.lastName}` },
        ]),
    );

    const term = (args.search ?? "").trim().toLowerCase();
    let rows = vehicles.map((vehicle) =>
      toVehicleRow(
        vehicle,
        vehicle.assignedDriverId ? driverMap.get(vehicle.assignedDriverId as string) ?? null : null,
      ),
    );

    if (args.status && args.status !== "all") rows = rows.filter((row) => row.status === args.status);
    if (args.driverId) {
      rows = rows.filter((row) => row.assignedDriver?.id === args.driverId);
    }
    if (term) {
      rows = rows.filter((row) =>
        [row.unitNumber, row.plate, row.vin, row.make, row.model, row.assignedDriver?.name, row.depot]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    }

    rows.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
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

    const driver = vehicle.assignedDriverId ? await ctx.db.get(vehicle.assignedDriverId) : null;
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_record", (q) =>
        q.eq("orgId", context.orgId).eq("entity", "vehicle").eq("entityId", args.vehicleId as string),
      )
      .order("desc")
      .take(40);

    // Peers shown in the assignment picker so a driver can be moved in one step.
    const otherVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const activeDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);

    return {
      vehicle: {
        ...toVehicleRow(
          vehicle,
          driver ? { id: driver._id, name: `${driver.firstName} ${driver.lastName}` } : null,
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
            phone: driver.phone ?? null,
            email: driver.email ?? null,
            status: driver.status,
            licenseNumber: driver.licenseNumber,
            licenseExpiry: driver.licenseExpiry ?? null,
          }
        : null,
      activity: activity.map((row) => ({
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
          otherVehicles.find((v) => v.assignedDriverId === row._id)?.unitNumber ?? null,
      })),
    };
  },
});

export const createVehicle = mutation({
  args: { ...vehicleInput },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Your role does not allow adding vehicles.");

    const clean = vehicleFromInput(args as unknown as Record<string, unknown>);

    const duplicateUnit = await ctx.db
      .query("vehicles")
      .withIndex("by_org_unit", (q) => q.eq("orgId", context.orgId).eq("unitNumber", clean.unitNumber))
      .first();
    if (duplicateUnit) {
      throw new ConvexError(`A unidade ${clean.unitNumber} já existe no seu registro.`);
    }
    if (clean.vin) {
      const duplicateVin = await ctx.db
        .query("vehicles")
        .withIndex("by_org_vin", (q) => q.eq("orgId", context.orgId).eq("vin", clean.vin!))
        .first();
      if (duplicateVin) throw new ConvexError("Esse chassi (VIN) já está cadastrado em outra unidade.");
    }
    if (clean.plate) {
      const duplicatePlate = await ctx.db
        .query("vehicles")
        .withIndex("by_org_plate", (q) => q.eq("orgId", context.orgId).eq("plate", clean.plate!))
        .first();
      if (duplicatePlate) {
        throw new ConvexError(`A placa ${clean.plate} já é usada pela unidade ${duplicatePlate.unitNumber}.`);
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
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite editar veículos.");

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
      .withIndex("by_org_unit", (q) => q.eq("orgId", context.orgId).eq("unitNumber", clean.unitNumber))
      .first();
    if (duplicateUnit && duplicateUnit._id !== existing._id) {
      throw new ConvexError(`A unidade ${clean.unitNumber} já existe no seu registro.`);
    }
    if (clean.vin && clean.vin !== existing.vin) {
      const duplicateVin = await ctx.db
        .query("vehicles")
        .withIndex("by_org_vin", (q) => q.eq("orgId", context.orgId).eq("vin", clean.vin!))
        .first();
      if (duplicateVin && duplicateVin._id !== existing._id) {
        throw new ConvexError("Esse chassi (VIN) já está cadastrado em outra unidade.");
      }
    }
    if (clean.plate && clean.plate !== existing.plate) {
      const duplicatePlate = await ctx.db
        .query("vehicles")
        .withIndex("by_org_plate", (q) => q.eq("orgId", context.orgId).eq("plate", clean.plate!))
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
    if (clean.assignedDriverId && clean.assignedDriverId !== existing.assignedDriverId) {
      const previousHolders = await ctx.db
        .query("vehicles")
        .withIndex("by_org_driver", (q) =>
          q.eq("orgId", context.orgId).eq("assignedDriverId", clean.assignedDriverId!),
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
    } else if (!clean.assignedDriverId && existing.assignedDriverId && clean.status === "assigned") {
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
      if ((clean as Record<string, unknown>)[key] === undefined) patch[key] = undefined;
    }

    const changes = await vehicleChanges(ctx, existing as unknown as Record<string, unknown>, clean);
    await ctx.db.patch(existing._id, patch);

    const statusChanged = existing.status !== clean.status;
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: statusChanged ? "status_change" : changes.some((c) => c.field === "Motorista vinculado") ? "assign" : "update",
      entity: "vehicle",
      entityId: existing._id as string,
      entityLabel: `Unidade ${clean.unitNumber}`,
      summary: statusChanged
        ? `Situação alterada de ${existing.status.replace(/_/g, " ")} para ${clean.status.replace(/_/g, " ")}.`
        : "Registro do veículo atualizado.",
      changes,
    });

    return { vehicleId: existing._id };
  },
});

export const deleteVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, COMPANY_ROLES, "Somente proprietário ou administrador pode excluir veículos.");

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
      .take(500);
    const documentRows = await ctx.db
      .query("vehicleDocuments")
      .withIndex("by_org_vehicle", (q) =>
        q.eq("orgId", context.orgId).eq("vehicleId", vehicle._id),
      )
      .take(500);

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
/*  Drivers                                                                   */
/* -------------------------------------------------------------------------- */

export const listDrivers = query({
  args: { search: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return { rows: [], total: 0 };

    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const assignmentByDriver = new Map(
      vehicles
        .filter((vehicle) => vehicle.assignedDriverId)
        .map((vehicle) => [
          vehicle.assignedDriverId as string,
          { vehicleId: vehicle._id, unitNumber: vehicle.unitNumber },
        ]),
    );

    const term = (args.search ?? "").trim().toLowerCase();
    let rows = drivers.map((driver) => {
      const assignment = assignmentByDriver.get(driver._id as string) ?? null;
      return {
        id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        name: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone ?? null,
        email: driver.email ?? null,
        licenseNumber: driver.licenseNumber,
        licenseClass: driver.licenseClass ?? null,
        licenseExpiry: driver.licenseExpiry ?? null,
        medicalExpiry: driver.medicalExpiry ?? null,
        hireDate: driver.hireDate ?? null,
        status: driver.status,
        compensationModel: driver.compensationModel,
        // Payroll data: only the roles that run the numbers get the figure.
        rate: canSeeCompensation(context.role) ? (driver.rate ?? null) : null,
        depot: driver.depot ?? null,
        notes: driver.notes ?? null,
        vehicleUnit: assignment?.unitNumber ?? null,
        vehicleId: assignment?.vehicleId ?? null,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      };
    });

    if (args.status && args.status !== "all") rows = rows.filter((row) => row.status === args.status);
    if (term) {
      rows = rows.filter((row) =>
        [row.name, row.phone, row.email, row.licenseNumber, row.vehicleUnit]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    }

    rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    return { rows, total: rows.length };
  },
});

export const driverDetail = query({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return null;
    const driver = await ctx.db.get(args.driverId);
    if (!driver || driver.orgId !== context.orgId) return null;

    const assignment = await ctx.db
      .query("vehicles")
      .withIndex("by_org_driver", (q) =>
        q.eq("orgId", context.orgId).eq("assignedDriverId", args.driverId),
      )
      .first();

    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_record", (q) =>
        q.eq("orgId", context.orgId).eq("entity", "driver").eq("entityId", args.driverId as string),
      )
      .order("desc")
      .take(40);

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);

    return {
      driver: {
        id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        name: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone ?? null,
        email: driver.email ?? null,
        addressLine: driver.addressLine ?? null,
        city: driver.city ?? null,
        licenseNumber: driver.licenseNumber,
        licenseClass: driver.licenseClass ?? null,
        licenseExpiry: driver.licenseExpiry ?? null,
        medicalExpiry: driver.medicalExpiry ?? null,
        hireDate: driver.hireDate ?? null,
        status: driver.status,
        compensationModel: driver.compensationModel,
        rate: canSeeCompensation(context.role) ? (driver.rate ?? null) : null,
        emergencyContactName: driver.emergencyContactName ?? null,
        emergencyContactPhone: driver.emergencyContactPhone ?? null,
        depot: driver.depot ?? null,
        notes: driver.notes ?? null,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      assignedVehicle: assignment
        ? {
            id: assignment._id,
            unitNumber: assignment.unitNumber,
            make: assignment.make,
            model: assignment.model,
            status: assignment.status,
            odometer: assignment.odometer,
          }
        : null,
      activity: activity.map((row) => ({
        id: row._id,
        action: row.action as ActivityAction,
        summary: row.summary,
        actorName: row.actorName,
        changes: row.changes ?? [],
        createdAt: row.createdAt,
      })),
      vehicleOptions: vehicles.map((vehicle) => ({
        id: vehicle._id,
        unitNumber: vehicle.unitNumber,
        label: `${vehicle.unitNumber} · ${vehicle.make} ${vehicle.model}`,
        taken: Boolean(vehicle.assignedDriverId) && vehicle.assignedDriverId !== args.driverId,
      })),
    };
  },
});

export const createDriver = mutation({
  args: { ...driverInput },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite cadastrar motoristas.");

    const clean = driverFromInput(args as unknown as Record<string, unknown>);
    const duplicate = await ctx.db
      .query("drivers")
      .withIndex("by_org_license", (q) =>
        q.eq("orgId", context.orgId).eq("licenseNumber", clean.licenseNumber),
      )
      .first();
    if (duplicate) {
      throw new ConvexError(
        `A CNH ${clean.licenseNumber} já está cadastrada para ${duplicate.firstName} ${duplicate.lastName}.`,
      );
    }

    const now = Date.now();
    const driverId = await ctx.db.insert("drivers", {
      ...clean,
      orgId: context.orgId,
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.assignedVehicleId) {
      const vehicle = await ctx.db.get(args.assignedVehicleId);
      if (!vehicle || vehicle.orgId !== context.orgId) {
        throw new ConvexError("Esse veículo não está no seu registro.");
      }
      // Silently stealing a unit that another driver is running would make the
      // register disagree with the yard. Fail loudly instead.
      if (vehicle.assignedDriverId) {
        throw new ConvexError(
          `A unidade ${vehicle.unitNumber} já está vinculada a outro motorista. Libere-a antes de vinculá-la a ${clean.firstName} ${clean.lastName}.`,
        );
      }
      await ctx.db.patch(vehicle._id, {
        assignedDriverId: driverId,
        status: vehicle.status === "available" ? "assigned" : vehicle.status,
        updatedAt: now,
      });
      await logActivity(ctx, {
        orgId: context.orgId,
        userId: context.userId,
        actorName: context.actorName,
        action: "assign",
        entity: "vehicle",
        entityId: vehicle._id as string,
        entityLabel: `Unidade ${vehicle.unitNumber}`,
        summary: `${clean.firstName} ${clean.lastName} vinculado à unidade ${vehicle.unitNumber}.`,
      });
    }

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "create",
      entity: "driver",
      entityId: driverId as string,
      entityLabel: `${clean.firstName} ${clean.lastName}`,
      summary: `Cadastrou o motorista ${clean.firstName} ${clean.lastName} (CNH ${clean.licenseNumber}).`,
    });

    return { driverId };
  },
});

export const updateDriver = mutation({
  args: { driverId: v.id("drivers"), ...driverInput },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite editar motoristas.");

    const existing = await ctx.db.get(args.driverId);
    if (!existing || existing.orgId !== context.orgId) {
      throw new ConvexError("Esse motorista não está na sua equipe.");
    }

    const clean = driverFromInput(args as unknown as Record<string, unknown>);
    if (clean.licenseNumber !== existing.licenseNumber) {
      const duplicate = await ctx.db
        .query("drivers")
        .withIndex("by_org_license", (q) =>
          q.eq("orgId", context.orgId).eq("licenseNumber", clean.licenseNumber),
        )
        .first();
      if (duplicate && duplicate._id !== existing._id) {
        throw new ConvexError(
          `A CNH ${clean.licenseNumber} já está cadastrada para ${duplicate.firstName} ${duplicate.lastName}.`,
        );
      }
    }

    const patch: Record<string, unknown> = { ...clean, updatedAt: Date.now() };
    for (const key of [
      "phone",
      "email",
      "addressLine",
      "city",
      "licenseClass",
      "licenseExpiry",
      "medicalExpiry",
      "hireDate",
      "rate",
      "emergencyContactName",
      "emergencyContactPhone",
      "depot",
      "notes",
    ]) {
      if ((clean as Record<string, unknown>)[key] === undefined) patch[key] = undefined;
    }

    const changes = diffFields(existing as unknown as Record<string, unknown>, clean, DRIVER_TRACKED_FIELDS);
    await ctx.db.patch(existing._id, patch);

    // Keep the vehicle assignment in sync with the form (one source of truth).
    const currentVehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_org_driver", (q) =>
        q.eq("orgId", context.orgId).eq("assignedDriverId", args.driverId),
      )
      .first();
    const nextVehicleId = args.assignedVehicleId;

    if (nextVehicleId && nextVehicleId !== currentVehicle?._id) {
      if (currentVehicle) {
        await ctx.db.patch(currentVehicle._id, {
          assignedDriverId: undefined,
          status: currentVehicle.status === "assigned" ? "available" : currentVehicle.status,
          updatedAt: Date.now(),
        });
      }
      const nextVehicle = await ctx.db.get(nextVehicleId);
      if (!nextVehicle || nextVehicle.orgId !== context.orgId) {
        throw new ConvexError("Esse veículo não está no seu registro.");
      }
      await ctx.db.patch(nextVehicle._id, {
        assignedDriverId: existing._id,
        status: nextVehicle.status === "available" ? "assigned" : nextVehicle.status,
        updatedAt: Date.now(),
      });
      changes.push({
        field: "Veículo vinculado",
        from: currentVehicle ? `Unidade ${currentVehicle.unitNumber}` : "—",
        to: `Unidade ${nextVehicle.unitNumber}`,
      });
    } else if (!nextVehicleId && currentVehicle) {
      await ctx.db.patch(currentVehicle._id, {
        assignedDriverId: undefined,
        status: currentVehicle.status === "assigned" ? "available" : currentVehicle.status,
        updatedAt: Date.now(),
      });
      changes.push({ field: "Veículo vinculado", from: `Unidade ${currentVehicle.unitNumber}`, to: "—" });
    }

    const statusChanged = existing.status !== clean.status;
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: statusChanged ? "status_change" : "update",
      entity: "driver",
      entityId: existing._id as string,
      entityLabel: `${clean.firstName} ${clean.lastName}`,
      summary: statusChanged
        ? `Situação alterada de ${existing.status.replace(/_/g, " ")} para ${clean.status.replace(/_/g, " ")}.`
        : "Registro do motorista atualizado.",
      changes,
    });

    return { driverId: existing._id };
  },
});

export const deleteDriver = mutation({
  args: { driverId: v.id("drivers") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, COMPANY_ROLES, "Somente proprietário ou administrador pode remover motoristas.");

    const driver = await ctx.db.get(args.driverId);
    if (!driver || driver.orgId !== context.orgId) {
      throw new ConvexError("Esse motorista não está na sua equipe.");
    }

    // Keep referential integrity: release any vehicle this driver was holding.
    const assignedVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org_driver", (q) =>
        q.eq("orgId", context.orgId).eq("assignedDriverId", args.driverId),
      )
      .take(20);
    for (const vehicle of assignedVehicles) {
      await ctx.db.patch(vehicle._id, {
        assignedDriverId: undefined,
        status: vehicle.status === "assigned" ? "available" : vehicle.status,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(driver._id);
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "driver",
      entityId: driver._id as string,
      entityLabel: `${driver.firstName} ${driver.lastName}`,
      summary: `Removeu o motorista ${driver.firstName} ${driver.lastName}${
        assignedVehicles.length
          ? ` e liberou a(s) unidade(s) ${assignedVehicles.map((v) => v.unitNumber).join(", ")}`
          : ""
      }.`,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/*  Company + team                                                            */
/* -------------------------------------------------------------------------- */

export const createOrganization = mutation({
  args: {
    name: v.string(),
    currency: v.string(),
    distanceUnit: distanceUnitValidator,
    volumeUnit: volumeUnitValidator,
    timeZone: v.string(),
    legalName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    if (!user) throw new ConvexError("Sua sessão expirou. Entre novamente.");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user.userId))
      .first();
    if (existing) throw new ConvexError("Você já pertence a uma empresa no Fleet Command.");

    const name = args.name.trim();
    if (!name) throw new ConvexError("O nome da empresa é obrigatório.");
    if (!/^[A-Z]{3}$/.test(args.currency.toUpperCase())) {
      throw new ConvexError("Use um código de moeda com 3 letras, como BRL ou USD.");
    }

    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name,
      legalName: args.legalName?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || user.email || undefined,
      phone: args.phone?.trim() || undefined,
      addressLine: args.addressLine?.trim() || undefined,
      city: args.city?.trim() || undefined,
      region: args.region?.trim() || undefined,
      country: args.country?.trim() || undefined,
      taxId: args.taxId?.trim() || undefined,
      currency: args.currency.toUpperCase(),
      distanceUnit: args.distanceUnit,
      volumeUnit: args.volumeUnit,
      timeZone: args.timeZone,
      plan: "owner",
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId: user.userId,
      role: "owner",
      createdAt: now,
    });

    await logActivity(ctx, {
      orgId,
      userId: user.userId,
      actorName: user.name,
      action: "create",
      entity: "company",
      entityId: orgId as string,
      entityLabel: name,
      summary: `Created the company workspace for ${name}.`,
    });

    return { orgId };
  },
});

export const updateOrganization = mutation({
  args: {
    name: v.string(),
    legalName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    taxId: v.optional(v.string()),
    currency: v.string(),
    distanceUnit: distanceUnitValidator,
    volumeUnit: volumeUnitValidator,
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, COMPANY_ROLES, "Only an owner or admin can change company settings.");

    const name = args.name.trim();
    if (!name) throw new ConvexError("O nome da empresa é obrigatório.");
    if (!/^[A-Z]{3}$/.test(args.currency.toUpperCase())) {
      throw new ConvexError("Use um código de moeda com 3 letras, como BRL ou USD.");
    }

    await ctx.db.patch(context.orgId, {
      name,
      legalName: args.legalName?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      addressLine: args.addressLine?.trim() || undefined,
      city: args.city?.trim() || undefined,
      region: args.region?.trim() || undefined,
      country: args.country?.trim() || undefined,
      taxId: args.taxId?.trim() || undefined,
      currency: args.currency.toUpperCase(),
      distanceUnit: args.distanceUnit,
      volumeUnit: args.volumeUnit,
      timeZone: args.timeZone,
      updatedAt: Date.now(),
    });

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "update",
      entity: "company",
      entityId: context.orgId as string,
      entityLabel: name,
      summary: "Atualizou o perfil da empresa e as configurações de medição.",
    });

    return { ok: true };
  },
});

export const completeSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireOrg(ctx);
    await ctx.db.patch(context.orgId, { setupCompletedAt: Date.now(), updatedAt: Date.now() });
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "update",
      entity: "workspace",
      entityLabel: "Setup",
      summary: "Concluiu a lista de configuração do Fleet Command.",
    });
    return { ok: true };
  },
});

export const addMember = mutation({
  args: { email: v.string(), role: orgRoleValidator },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Only an owner or admin can invite team members.");

    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError("Informe um e-mail válido.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new ConvexError(
        "No Fleet Command account uses that email yet. Ask them to sign in once, then add them.",
      );
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", context.orgId).eq("userId", user._id))
      .first();
    if (existing) throw new ConvexError("Essa pessoa já está na sua equipe.");

    await ctx.db.insert("memberships", {
      orgId: context.orgId,
      userId: user._id,
      role: args.role,
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "member",
      entity: "member",
      entityId: user._id as string,
      entityLabel: email,
      summary: `Added ${email} as ${args.role.replace(/_/g, " ")}.`,
    });

    return { ok: true };
  },
});

export const updateMemberRole = mutation({
  args: { membershipId: v.id("memberships"), role: orgRoleValidator },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Only an owner or admin can change roles.");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.orgId !== context.orgId) {
      throw new ConvexError("Esse integrante não faz parte desta empresa.");
    }
    if (membership.userId === context.userId) {
      throw new ConvexError("Você não pode alterar seu próprio papel.");
    }
    if (membership.role === "owner") {
      throw new ConvexError("O papel do proprietário da empresa não pode ser alterado.");
    }

    await ctx.db.patch(membership._id, { role: args.role });
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "member",
      entity: "member",
      entityId: membership.userId as string,
      entityLabel: args.role.replace(/_/g, " "),
      summary: `Changed a team member's role to ${args.role.replace(/_/g, " ")}.`,
    });
    return { ok: true };
  },
});

export const removeMember = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Only an owner or admin can remove team members.");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.orgId !== context.orgId) {
      throw new ConvexError("Esse integrante não faz parte desta empresa.");
    }
    if (membership.role === "owner") throw new ConvexError("O proprietário da empresa não pode ser removido.");

    const user = await ctx.db.get(membership.userId);
    await ctx.db.delete(membership._id);
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "member",
      entity: "member",
      entityId: membership.userId as string,
      entityLabel: user?.email ?? "Team member",
      summary: `Removed ${user?.name ?? user?.email ?? "a team member"} from the workspace.`,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/*  Log book + search                                                         */
/* -------------------------------------------------------------------------- */

export const activityFeed = query({
  args: {
    limit: v.optional(v.number()),
    entity: v.optional(activityEntityValidator),
  },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return [];

    const rows = args.entity
      ? await ctx.db
          .query("activityLog")
          .withIndex("by_org_entity", (q) =>
            q.eq("orgId", context.orgId).eq("entity", args.entity!),
          )
          .order("desc")
          .take(Math.min(args.limit ?? 60, 200))
      : await ctx.db
          .query("activityLog")
          .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
          .order("desc")
          .take(Math.min(args.limit ?? 60, 200));

    return rows.map((row) => ({
      id: row._id,
      action: row.action as ActivityAction,
      entity: row.entity as ActivityEntity,
      entityId: row.entityId ?? null,
      entityLabel: row.entityLabel,
      summary: row.summary,
      actorName: row.actorName,
      changes: row.changes ?? [],
      createdAt: row.createdAt,
    }));
  },
});

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return { vehicles: [], drivers: [] };
    const term = args.term.trim().toLowerCase();
    if (term.length < 2) return { vehicles: [], drivers: [] };

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(400);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(400);

    const match = (values: (string | null | undefined)[]) =>
      values.filter(Boolean).some((value) => String(value).toLowerCase().includes(term));

    return {
      vehicles: vehicles
        .filter((vehicle) => match([vehicle.unitNumber, vehicle.plate, vehicle.vin, vehicle.make, vehicle.model]))
        .slice(0, 6)
        .map((vehicle) => ({
          id: vehicle._id,
          title: `Unit ${vehicle.unitNumber}`,
          subtitle: `${vehicle.make} ${vehicle.model}`,
          status: vehicle.status as string,
        })),
      drivers: drivers
        .filter((driver) =>
          match([
            `${driver.firstName} ${driver.lastName}`,
            driver.phone,
            driver.email,
            driver.licenseNumber,
          ]),
        )
        .slice(0, 6)
        .map((driver) => ({
          id: driver._id,
          title: `${driver.firstName} ${driver.lastName}`,
          subtitle: driver.licenseNumber,
          status: driver.status as string,
        })),
    };
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
  { unitNumber: "101", vehicleType: "truck", make: "Freightliner", model: "Cascadia 126", year: 2021, vin: "1FUJHHDR1MLM12345", plate: "NW-4821", fuelType: "diesel", odometer: 412500, acquisitionCost: 148000, currentValue: 112000, status: "assigned", depot: "Harbour Yard", insuranceOffset: 210, registrationOffset: 96, serviceOffset: 18 },
  { unitNumber: "102", vehicleType: "truck", make: "Volvo", model: "VNL 860", year: 2022, vin: "4V4NC9EH2NN654321", plate: "NW-5117", fuelType: "diesel", odometer: 288900, acquisitionCost: 162500, currentValue: 138000, status: "assigned", depot: "Harbour Yard", insuranceOffset: 12, registrationOffset: 240, serviceOffset: 40 },
  { unitNumber: "103", vehicleType: "truck", make: "Kenworth", model: "T680", year: 2020, vin: "1XKYDP9X4LJ998877", plate: "NW-3390", fuelType: "diesel", odometer: 521300, acquisitionCost: 139000, currentValue: 89000, status: "maintenance", depot: "North Depot", insuranceOffset: 150, registrationOffset: 20, serviceOffset: -6 },
  { unitNumber: "104", vehicleType: "van", make: "Ford", model: "Transit 350", year: 2023, vin: "1FTBW2CM5PKA11223", plate: "NW-7745", fuelType: "gasoline", odometer: 62400, acquisitionCost: 54000, currentValue: 47000, status: "assigned", depot: "Metro Hub", insuranceOffset: 320, registrationOffset: 300, serviceOffset: 55 },
  { unitNumber: "105", vehicleType: "pickup", make: "Toyota", model: "Hilux", year: 2022, vin: "8AJBA3CD1N1234567", plate: "NW-2210", fuelType: "diesel", odometer: 98700, acquisitionCost: 42000, currentValue: 36000, status: "available", depot: "Metro Hub", insuranceOffset: 88, registrationOffset: 150, serviceOffset: 30 },
  { unitNumber: "106", vehicleType: "truck", make: "International", model: "LT625", year: 2019, vin: "3HSDJAPR5KN778899", plate: "NW-1044", fuelType: "diesel", odometer: 688400, acquisitionCost: 121000, currentValue: 62000, status: "out_of_service", depot: "North Depot", insuranceOffset: -9, registrationOffset: 60, serviceOffset: -21 },
  { unitNumber: "107", vehicleType: "van", make: "Mercedes-Benz", model: "Sprinter 2500", year: 2024, vin: "W1Y40CHYXPT334455", plate: "NW-8892", fuelType: "diesel", odometer: 21850, acquisitionCost: 61500, currentValue: 58000, status: "assigned", depot: "Metro Hub", insuranceOffset: 400, registrationOffset: 380, serviceOffset: 80 },
  { unitNumber: "108", vehicleType: "trailer", make: "Great Dane", model: "Everest 53", year: 2020, vin: "1GRAA0621LB556677", plate: "TRL-4088", fuelType: "diesel", odometer: 0, acquisitionCost: 38000, currentValue: 27000, status: "available", depot: "Harbour Yard", insuranceOffset: 200, registrationOffset: 44, serviceOffset: 120 },
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
  { firstName: "Marcus", lastName: "Delgado", phone: "(415) 555-0117", email: "marcus.delgado@example.com", city: "Oakland", licenseNumber: "CA-D8841207", licenseClass: "A", licenseOffset: 420, medicalOffset: 190, hireOffset: -1450, status: "active", compensationModel: "per_mile", rate: 0.62, unit: "101" },
  { firstName: "Priya", lastName: "Raman", phone: "(415) 555-0193", email: "priya.raman@example.com", city: "San Jose", licenseNumber: "CA-D9023311", licenseClass: "A", licenseOffset: 18, medicalOffset: 42, hireOffset: -980, status: "active", compensationModel: "per_mile", rate: 0.64, unit: "102" },
  { firstName: "Dwayne", lastName: "Okafor", phone: "(510) 555-0142", email: "dwayne.okafor@example.com", city: "Richmond", licenseNumber: "CA-D7710988", licenseClass: "A", licenseOffset: -12, medicalOffset: 25, hireOffset: -2200, status: "active", compensationModel: "hourly", rate: 34, unit: "104" },
  { firstName: "Sofia", lastName: "Marchetti", phone: "(650) 555-0166", email: "sofia.marchetti@example.com", city: "Redwood City", licenseNumber: "CA-D6552210", licenseClass: "B", licenseOffset: 260, medicalOffset: 150, hireOffset: -640, status: "active", compensationModel: "salary", rate: 78000, unit: "107" },
  { firstName: "Grant", lastName: "Whitfield", phone: "(408) 555-0178", email: "grant.whitfield@example.com", city: "Fremont", licenseNumber: "CA-D4409923", licenseClass: "A", licenseOffset: 132, medicalOffset: 38, hireOffset: -3100, status: "on_leave", compensationModel: "per_trip", rate: 210 },
  { firstName: "Elena", lastName: "Vargas", phone: "(707) 555-0121", email: "elena.vargas@example.com", city: "Vallejo", licenseNumber: "CA-C9987123", licenseClass: "C", licenseOffset: 96, medicalOffset: 88, hireOffset: -320, status: "active", compensationModel: "hourly", rate: 29 },
];

export const seedDemoFleet = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Your role does not allow adding fleet records.");

    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(1);
    if (existingVehicles.length) {
      throw new ConvexError("Seu cadastro já possui veículos. Limpe-os antes de carregar exemplos.");
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
        depot: sample.depot,
        notes:
          sample.status === "out_of_service"
            ? "Turbo failure — awaiting parts from vendor."
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
        compensationModel: sample.compensationModel as Infer<typeof compensationValidator>,
        rate: sample.rate,
        depot: "Harbour Yard",
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
      await ctx.db.patch(vehicleId, { assignedDriverId: driver._id, updatedAt: now });
    }

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "seed",
      entity: "workspace",
      entityLabel: "Sample fleet",
      summary: `Loaded sample data: ${DEMO_VEHICLES.length} vehicles and ${DEMO_DRIVERS.length} drivers (fictional).`,
    });

    return { vehicles: DEMO_VEHICLES.length, drivers: DEMO_DRIVERS.length };
  },
});

export const clearFleetData = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, COMPANY_ROLES, "Only an owner or admin can clear fleet data.");

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);
    const activity = await ctx.db
      .query("activityLog")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(500);

    for (const vehicle of vehicles) await ctx.db.delete(vehicle._id);
    for (const driver of drivers) await ctx.db.delete(driver._id);
    for (const row of activity) await ctx.db.delete(row._id);

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "workspace",
      entityLabel: "Fleet register",
      summary: `Cleared the register — removed ${vehicles.length} vehicles and ${drivers.length} drivers.`,
    });

    return { vehicles: vehicles.length, drivers: drivers.length };
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
