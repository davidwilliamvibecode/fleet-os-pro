import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  maintenanceTypeValidator,
  documentTypeValidator,
  documentStatusValidator,
  type MaintenanceType,
  type DocumentType,
  type DocumentStatus,
} from "./schema";
import { FLEET_WRITE_ROLES, type OrgRole } from "./constants";

const DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Authorization helpers (same rules as fleet.ts)                            */
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
  return { userId, name: user?.name ?? user?.email ?? "Team member" };
}

async function orgContext(ctx: QueryCtx | MutationCtx): Promise<OrgContext | null> {
  const user = await signedInUser(ctx);
  if (!user) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", user.userId))
    .first();
  if (!membership) return null;
  const org = await ctx.db.get(membership.orgId);
  if (!org) return null;
  return { userId: user.userId, actorName: user.name, orgId: org._id, role: membership.role as OrgRole };
}

async function requireOrg(ctx: QueryCtx | MutationCtx): Promise<OrgContext> {
  const context = await orgContext(ctx);
  if (!context) throw new ConvexError("Crie o perfil da empresa antes de registrar manutenções.");
  return context;
}

function requireRole(role: OrgRole, allowed: OrgRole[], message: string) {
  if (!allowed.includes(role)) throw new ConvexError(message);
}

/* -------------------------------------------------------------------------- */
/*  Field parsing                                                             */
/* -------------------------------------------------------------------------- */

function readText(input: Record<string, unknown>, key: string, label: string, max = 120) {
  const raw = input[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new ConvexError(`${label} é obrigatório.`);
  if (value.length > max) throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

function readOptionalText(input: Record<string, unknown>, key: string, label: string, max = 400) {
  const raw = input[key];
  if (raw === undefined || raw === null) return undefined;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return undefined;
  if (value.length > max) throw new ConvexError(`${label} deve ter menos de ${max} caracteres.`);
  return value;
}

function readNumber(input: Record<string, unknown>, key: string, label: string, opts: { min?: number; max?: number } = {}) {
  const raw = input[key];
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${label} deve ser um número.`);
  }
  if (opts.min !== undefined && value < opts.min) throw new ConvexError(`${label} não pode ser negativo.`);
  if (opts.max !== undefined && value > opts.max) throw new ConvexError(`${label} parece alto demais — confira o valor.`);
  return value;
}

function readOptionalNumber(input: Record<string, unknown>, key: string, label: string, opts: { min?: number; max?: number } = {}) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return readNumber(input, key, label, opts);
}

function readOptionalDate(input: Record<string, unknown>, key: string, label: string) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Date.parse(`${raw}T00:00:00`) : NaN;
  if (!Number.isFinite(value)) throw new ConvexError(`${label} não é uma data válida.`);
  if (value < Date.parse("1900-01-01") || value > Date.now() + 40 * 365 * DAY) {
    throw new ConvexError(`${label} está fora do intervalo suportado.`);
  }
  return value;
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
    action: "create" | "update" | "delete" | "status_change";
    entity: "maintenance" | "document";
    entityId?: string;
    entityLabel: string;
    summary: string;
  },
) {
  await ctx.db.insert("activityLog", { ...entry, createdAt: Date.now() });
}

/* -------------------------------------------------------------------------- */
/*  Maintenance records (registros de manutenção)                             */
/* -------------------------------------------------------------------------- */

export const listMaintenance = query({
  args: {
    vehicleId: v.optional(v.id("vehicles")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return [];

    const rows = args.vehicleId
      ? await ctx.db
          .query("maintenanceRecords")
          .withIndex("by_org_vehicle", (q) =>
            q.eq("orgId", context.orgId).eq("vehicleId", args.vehicleId!),
          )
          .take(Math.min(args.limit ?? 200, 500))
      : await ctx.db
          .query("maintenanceRecords")
          .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
          .take(Math.min(args.limit ?? 200, 500));

    const sorted = [...rows].sort((a, b) => b.serviceDate - a.serviceDate);
    return sorted.map((row) => ({
      id: row._id,
      vehicleId: row.vehicleId,
      serviceDate: row.serviceDate,
      maintenanceType: row.maintenanceType as MaintenanceType,
      description: row.description,
      partsReplaced: row.partsReplaced ?? null,
      cost: row.cost ?? null,
      odometerAtService: row.odometerAtService,
      location: row.location ?? null,
      vendor: row.vendor ?? null,
      nextServiceDate: row.nextServiceDate ?? null,
      nextServiceOdometer: row.nextServiceOdometer ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
    }));
  },
});

export const createMaintenance = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    serviceDate: v.number(),
    maintenanceType: maintenanceTypeValidator,
    description: v.string(),
    partsReplaced: v.optional(v.string()),
    cost: v.optional(v.number()),
    odometerAtService: v.number(),
    location: v.optional(v.string()),
    vendor: v.optional(v.string()),
    nextServiceDate: v.optional(v.number()),
    nextServiceOdometer: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite registrar manutenções.");

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.orgId !== context.orgId) {
      throw new ConvexError("Veículo não encontrado no seu registro.");
    }

    const raw = args as unknown as Record<string, unknown>;
    const description = readText(raw, "description", "Descrição do serviço", 400);
    const odometerAtService = readNumber(raw, "odometerAtService", "Quilometragem", {
      min: 0,
      max: 5_000_000,
    });
    // Odometer cannot go backwards — service happens at or after the last reading.
    if (odometerAtService < vehicle.odometer) {
      throw new ConvexError(
        `A quilometragem não pode ser menor que a última leitura (${vehicle.odometer.toLocaleString("pt-BR")}).`,
      );
    }

    const now = Date.now();
    const recordId = await ctx.db.insert("maintenanceRecords", {
      orgId: context.orgId,
      vehicleId: args.vehicleId,
      serviceDate: args.serviceDate,
      maintenanceType: args.maintenanceType,
      description,
      partsReplaced: readOptionalText(raw, "partsReplaced", "Peças trocadas", 600),
      cost: readOptionalNumber(raw, "cost", "Valor", { min: 0, max: 100_000_000 }),
      odometerAtService,
      location: readOptionalText(raw, "location", "Local", 120),
      vendor: readOptionalText(raw, "vendor", "Oficina / fornecedor", 120),
      nextServiceDate: readOptionalDate(raw, "nextServiceDate", "Próxima revisão (data)"),
      nextServiceOdometer: readOptionalNumber(raw, "nextServiceOdometer", "Próxima revisão (km)", {
        min: 0,
        max: 5_000_000,
      }),
      notes: readOptionalText(raw, "notes", "Observações", 2000),
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });

    // The service reading becomes the vehicle's current odometer, and any
    // scheduled next service moves onto the vehicle record automatically.
    const vehiclePatch: Record<string, unknown> = {
      odometer: odometerAtService,
      odometerUpdatedAt: now,
      updatedAt: now,
    };
    if (args.nextServiceDate) vehiclePatch.nextServiceDate = args.nextServiceDate;
    if (args.nextServiceOdometer) vehiclePatch.nextServiceOdometer = args.nextServiceOdometer;
    await ctx.db.patch(vehicle._id, vehiclePatch);

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "create",
      entity: "maintenance",
      entityId: recordId as string,
      entityLabel: `Unidade ${vehicle.unitNumber}`,
      summary: `Manutenção registrada na unidade ${vehicle.unitNumber}: ${description.slice(0, 80)}.`,
    });

    return { recordId };
  },
});

export const deleteMaintenance = mutation({
  args: { recordId: v.id("maintenanceRecords") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite remover manutenções.");

    const record = await ctx.db.get(args.recordId);
    if (!record || record.orgId !== context.orgId) {
      throw new ConvexError("Registro não encontrado.");
    }
    const vehicle = await ctx.db.get(record.vehicleId);
    await ctx.db.delete(record._id);
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "maintenance",
      entityId: record._id as string,
      entityLabel: vehicle ? `Unidade ${vehicle.unitNumber}` : "Manutenção",
      summary: "Registro de manutenção removido.",
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/*  Vehicle documents / taxes (documentos, renovações e impostos)             */
/* -------------------------------------------------------------------------- */

export const listVehicleDocuments = query({
  args: {
    vehicleId: v.optional(v.id("vehicles")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await orgContext(ctx);
    if (!context) return [];

    const rows = args.vehicleId
      ? await ctx.db
          .query("vehicleDocuments")
          .withIndex("by_org_vehicle", (q) =>
            q.eq("orgId", context.orgId).eq("vehicleId", args.vehicleId!),
          )
          .take(Math.min(args.limit ?? 300, 500))
      : await ctx.db
          .query("vehicleDocuments")
          .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
          .take(Math.min(args.limit ?? 300, 500));

    const rank = (s: DocumentStatus) => (s === "atrasado" ? 0 : s === "pendente" ? 1 : 2);
    return rows
      .map((row) => ({
        id: row._id,
        vehicleId: row.vehicleId,
        documentType: row.documentType as DocumentType,
        title: row.title,
        dueDate: row.dueDate ?? null,
        amount: row.amount ?? null,
        status: row.status as DocumentStatus,
        paidAt: row.paidAt ?? null,
        notes: row.notes ?? null,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => {
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
      });
  },
});

export const createVehicleDocument = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    documentType: documentTypeValidator,
    title: v.string(),
    dueDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    status: documentStatusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite cadastrar documentos.");

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle || vehicle.orgId !== context.orgId) {
      throw new ConvexError("Veículo não encontrado no seu registro.");
    }

    const raw = args as unknown as Record<string, unknown>;
    const title = readText(raw, "title", "Título do documento", 120);
    const now = Date.now();
    const docId = await ctx.db.insert("vehicleDocuments", {
      orgId: context.orgId,
      vehicleId: args.vehicleId,
      documentType: args.documentType,
      title,
      dueDate: readOptionalDate(raw, "dueDate", "Vencimento"),
      amount: readOptionalNumber(raw, "amount", "Valor", { min: 0, max: 100_000_000 }),
      status: args.status,
      paidAt: args.status === "pago" ? now : undefined,
      notes: readOptionalText(raw, "notes", "Observações", 1000),
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "create",
      entity: "document",
      entityId: docId as string,
      entityLabel: `Unidade ${vehicle.unitNumber}`,
      summary: `Documento "${title}" cadastrado para a unidade ${vehicle.unitNumber}.`,
    });

    return { docId };
  },
});

export const updateVehicleDocumentStatus = mutation({
  args: { docId: v.id("vehicleDocuments"), status: documentStatusValidator },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite atualizar documentos.");

    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.orgId !== context.orgId) {
      throw new ConvexError("Documento não encontrado.");
    }

    await ctx.db.patch(doc._id, {
      status: args.status,
      paidAt: args.status === "pago" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "status_change",
      entity: "document",
      entityId: doc._id as string,
      entityLabel: doc.title,
      summary: `Status do documento "${doc.title}" alterado para ${args.status}.`,
    });
    return { ok: true };
  },
});

export const deleteVehicleDocument = mutation({
  args: { docId: v.id("vehicleDocuments") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, FLEET_WRITE_ROLES, "Seu papel não permite remover documentos.");

    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.orgId !== context.orgId) {
      throw new ConvexError("Documento não encontrado.");
    }
    await ctx.db.delete(doc._id);
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "delete",
      entity: "document",
      entityId: doc._id as string,
      entityLabel: doc.title,
      summary: `Documento "${doc.title}" removido.`,
    });
    return { ok: true };
  },
});
