import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query } from "./_generated/server";
import { limit } from "./limits";
import {
  canSeeCompensation,
  diffFields,
  logActivity,
  orgContext,
  readEnum,
  readOptionalDate,
  readOptionalNumber,
  readOptionalText,
  readText,
  requireOrg,
  requireRole,
} from "./fleet";
import { COMPANY_ROLES, DRIVER_STATUSES, FLEET_WRITE_ROLES } from "./constants";
import { canSeeDriverPersonalData } from "./access";
import {
  compensationValidator,
  driverStatusValidator,
  type ActivityAction,
} from "./schema";

/* -------------------------------------------------------------------------- */
/*  Driver roster                                                             */
/*  Vehicle assignment lives on the vehicle record, so both sides always      */
/*  agree on who is running which unit.                                       */
/* -------------------------------------------------------------------------- */



export const driverInput = {
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
      const personal = canSeeDriverPersonalData(context.role, driver.email, context.email);
      return {
        id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        name: `${driver.firstName} ${driver.lastName}`,
        phone: personal ? (driver.phone ?? null) : null,
        email: personal ? (driver.email ?? null) : null,
        // Vazio (e não null) para manter o tipo do frontend estável.
        licenseNumber: personal ? driver.licenseNumber : "",
        licenseClass: personal ? (driver.licenseClass ?? null) : null,
        licenseExpiry: personal ? (driver.licenseExpiry ?? null) : null,
        medicalExpiry: personal ? (driver.medicalExpiry ?? null) : null,
        hireDate: personal ? (driver.hireDate ?? null) : null,
        status: driver.status,
        compensationModel: driver.compensationModel,
        // Payroll data: only the roles that run the numbers get the figure, and
        // um motorista só vê o próprio valor.
        rate:
          personal && canSeeCompensation(context.role) ? (driver.rate ?? null) : null,
        depot: personal ? (driver.depot ?? null) : null,
        notes: personal ? (driver.notes ?? null) : null,
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
    // O prontuário completo é dado pessoal: um motorista não abre o do colega.
    if (!canSeeDriverPersonalData(context.role, driver.email, context.email)) return null;

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
    await limit(ctx, context.orgId, "createDriver");

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
      // Moving a driver onto a unit somebody else is running used to override the
      // assignment without a word, leaving the register disagreeing with the yard.
      const nextVehicle = await ctx.db.get(nextVehicleId);
      if (!nextVehicle || nextVehicle.orgId !== context.orgId) {
        throw new ConvexError("Esse veículo não está no seu registro.");
      }
      if (nextVehicle.assignedDriverId && nextVehicle.assignedDriverId !== existing._id) {
        throw new ConvexError(
          `A unidade ${nextVehicle.unitNumber} já está vinculada a outro motorista. Libere-a antes de mover ${clean.firstName} ${clean.lastName}.`,
        );
      }
      if (currentVehicle) {
        await ctx.db.patch(currentVehicle._id, {
          assignedDriverId: undefined,
          status: currentVehicle.status === "assigned" ? "available" : currentVehicle.status,
          updatedAt: Date.now(),
        });
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
