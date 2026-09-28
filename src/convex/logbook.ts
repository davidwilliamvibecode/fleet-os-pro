import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  activityEntityValidator,
  type ActivityAction,
  type ActivityEntity,
} from "./schema";
import { orgContext } from "./fleet";
import { canSeeDriverPersonalData } from "./access";

/* -------------------------------------------------------------------------- */
/*  Log book + global search                                                  */
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
    const allDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_org", (q) => q.eq("orgId", context.orgId))
      .take(400);
    // Busca não é porta de saída para dado pessoal: um integrante com papel
    // `driver` só encontra o próprio prontuário (os colegas ficam de fora, já
    // que aqui a resposta inclui CNH no subtítulo).
    const drivers = allDrivers.filter((driver) =>
      canSeeDriverPersonalData(context.role, driver.email, context.email),
    );

    const match = (values: (string | null | undefined)[]) =>
      values.filter(Boolean).some((value) => String(value).toLowerCase().includes(term));

    return {
      vehicles: vehicles
        .filter((vehicle) => match([vehicle.unitNumber, vehicle.plate, vehicle.vin, vehicle.make, vehicle.model]))
        .slice(0, 6)
        .map((vehicle) => ({
          id: vehicle._id,
          title: `Unidade ${vehicle.unitNumber}`,
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
