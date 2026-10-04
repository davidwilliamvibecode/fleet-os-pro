import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  distanceUnitValidator,
  orgRoleValidator,
  volumeUnitValidator,
} from "./schema";
import { COMPANY_ROLES, OWNER_ROLES, TEAM_ROLES } from "./constants";
import { logActivity, requireOrg, requireRole, signedInUser } from "./fleet";
import { limit } from "./limits";

/* -------------------------------------------------------------------------- */
/*  Company + team                                                            */
/*                                                                            */
/*  Two rules keep this module safe:                                          */
/*  1. Membership is an ownership function, so TEAM_ROLES is `owner` only —   */
/*     an admin must not be able to mint another owner.                       */
/*  2. One account belongs to exactly one company. `orgContext` resolves the  */
/*     membership with `.first()`, so a second row would silently change which */
/*     tenant the account sees (and hand it someone else's data).             */
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
    if (name.length > 80) throw new ConvexError("O nome da empresa deve ter menos de 80 caracteres.");
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
      plan: "trial",
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
      summary: `Criou o espaço de trabalho da empresa ${name}.`,
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
    requireRole(context.role, COMPANY_ROLES, "Somente proprietário ou administrador pode alterar as configurações da empresa.");

    const name = args.name.trim();
    if (!name) throw new ConvexError("O nome da empresa é obrigatório.");
    if (name.length > 80) throw new ConvexError("O nome da empresa deve ter menos de 80 caracteres.");
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
      entityLabel: "Configuração",
      summary: "Concluiu a lista de configuração do Fleet Command.",
    });
    return { ok: true };
  },
});

export const addMember = mutation({
  args: { email: v.string(), role: orgRoleValidator },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Somente o proprietário pode convidar integrantes.");
    // Convite é a operação mais sensível: cada um adiciona uma pessoa com
    // acesso aos dados da empresa, e o login por e-mail não tem cota de envio.
    await limit(ctx, context.orgId, "invite");
    // Handing out owner access is an owner-only action.
    if (args.role === "owner") {
      requireRole(context.role, OWNER_ROLES, "Somente o proprietário pode conceder acesso de proprietário.");
    }

    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError("Informe um e-mail válido.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    // Deliberately generic: the caller must not learn whether an address is
    // registered here (that would be an e-mail enumeration oracle).
    const cannotAdd = new ConvexError(
      "Não foi possível adicionar esse e-mail. A pessoa precisa ter entrado no Fleet Command pelo menos uma vez com esse endereço.",
    );
    if (!user) throw cannotAdd;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (membership?.orgId === context.orgId) {
      throw new ConvexError("Essa pessoa já está na sua equipe.");
    }
    if (membership) {
      throw new ConvexError(
        "Essa pessoa já pertence a uma empresa no Fleet Command. Cada conta acessa uma única empresa.",
      );
    }

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
      summary: `Adicionou ${email} como ${args.role.replace(/_/g, " ")}.`,
    });

    return { ok: true };
  },
});

export const updateMemberRole = mutation({
  args: { membershipId: v.id("memberships"), role: orgRoleValidator },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Somente o proprietário pode alterar papéis.");
    // Promoting somebody to owner is owner-only, exactly like inviting them.
    if (args.role === "owner") {
      requireRole(context.role, OWNER_ROLES, "Somente o proprietário pode promover alguém a proprietário.");
    }

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
    if (membership.role === "admin" && context.role !== "owner") {
      throw new ConvexError("Somente o proprietário pode alterar o papel de um administrador.");
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
      summary: `Alterou o papel de um integrante para ${args.role.replace(/_/g, " ")}.`,
    });
    return { ok: true };
  },
});

export const removeMember = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const context = await requireOrg(ctx);
    requireRole(context.role, TEAM_ROLES, "Somente o proprietário pode remover integrantes.");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.orgId !== context.orgId) {
      throw new ConvexError("Esse integrante não faz parte desta empresa.");
    }
    if (membership.role === "owner") throw new ConvexError("O proprietário da empresa não pode ser removido.");
    if (membership.role === "admin" && context.role !== "owner") {
      throw new ConvexError("Somente o proprietário pode remover um administrador.");
    }

    const user = await ctx.db.get(membership.userId);
    await ctx.db.delete(membership._id);
    await logActivity(ctx, {
      orgId: context.orgId,
      userId: context.userId,
      actorName: context.actorName,
      action: "member",
      entity: "member",
      entityId: membership.userId as string,
      entityLabel: user?.email ?? "Integrante",
      summary: `Removeu ${user?.name ?? user?.email ?? "um integrante"} do espaço de trabalho.`,
    });
    return { ok: true };
  },
});
