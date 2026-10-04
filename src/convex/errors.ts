import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireOrg, requireRole } from "./fleet";
import { OWNER_ROLES } from "./constants";

/**
 * Error tracking interno.
 *
 * Antes, uma falha em produção só aparecia quando o cliente reclamava — o
 * frontend só fazia `console.error`, que ninguém lê. Agora o erro é gravado no
 * banco e aparece em Configurações › Diagnóstico, para o proprietário da
 * empresa ver o que quebrou sem precisar de serviço externo.
 *
 * Guardamos o essencial e nada mais: sem dados pessoais dos titulares, sem
 * conteúdo de documentos, com a mensagem e a origem cortadas em tamanho para
 * que um erro malicioso não infle o banco.
 */

const MAX_MESSAGE = 500;
const MAX_STACK = 2000;
const MAX_CONTEXT = 500;

/** Ultima resistência do relatório: mesmo que algo exploda, não engasga o app. */
export const reportError = mutation({
  args: {
    source: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmedContext = args.context?.slice(0, MAX_CONTEXT);
    await ctx.db.insert("errorReports", {
      orgId: await currentOrgId(ctx),
      source: args.source.slice(0, 120),
      message: args.message.slice(0, MAX_MESSAGE),
      stack: args.stack?.slice(0, MAX_STACK),
      context: trimmedContext,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Erros da empresa. Só o dono e o administrador veem — a lista pode conter
 * trecho de tela com dados de operação.
 */
export const listErrors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const org = await requireOrg(ctx);
    requireRole(org.role, OWNER_ROLES, "Só o proprietário e o administrador veem o diagnóstico.");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    const errors = await ctx.db
      .query("errorReports")
      .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
      .order("desc")
      .take(limit);

    return errors.map((e) => ({
      id: e._id,
      source: e.source,
      message: e.message,
      stack: e.stack,
      context: e.context,
      createdAt: e.createdAt,
    }));
  },
});

/** Remove os erros já vistos (a lista é uma caixa de entrada, não arquivo). */
export const clearErrors = mutation({
  args: {},
  handler: async (ctx) => {
    const org = await requireOrg(ctx);
    requireRole(org.role, OWNER_ROLES, "Só o proprietário e o administrador limpam o diagnóstico.");
    const errors = await ctx.db
      .query("errorReports")
      .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
      .collect();
    for (const error of errors) await ctx.db.delete(error._id);
    return { removed: errors.length };
  },
});

/**
 * O erro pode acontecer antes do login ou fora de uma empresa (visitante na
 * landing), então a organização é opcional. Quando há sessão, associamos o
 * erro à empresa para aparecer no diagnóstico certo.
 */
async function currentOrgId(ctx: MutationCtx) {
  try {
    const org = await requireOrg(ctx);
    return org.orgId;
  } catch {
    return undefined;
  }
}