import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Remove contas convidadas abandonadas.
 *
 * O provedor `Anonymous` (login "Continuar como convidado") não tem limite de
 * cadastros: qualquer visitante pode chamar `signIn` em laço e inflar a base de
 * usuários. Como o Convex Auth só limita *tentativas de código errado*, a
 * contenção fica aqui: convidados que nunca criaram um espaço de trabalho e já
 * passaram do prazo de validade são descartados, junto com sessões, contas e
 * códigos de verificação pendentes.
 *
 * Convidado que criou empresa é preservado — esse virou usuário de verdade.
 * Rode com `dryRun: true` para conferir quantos seriam removidos.
 */
export const pruneAbandonedGuests = internalMutation({
  args: {
    olderThanDays: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanDays ?? 7) * DAY;
    const users = await ctx.db.query("users").take(2000);

    let removed = 0;
    const candidates: string[] = [];

    for (const user of users) {
      if (!user.isAnonymous) continue;
      if (user._creationTime > cutoff) continue;

      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (membership) continue;

      candidates.push(user._id as string);
      if (args.dryRun) continue;

      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .take(50);
      for (const session of sessions) {
        const tokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .take(100);
        for (const token of tokens) await ctx.db.delete(token._id);
        await ctx.db.delete(session._id);
      }

      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .take(20);
      for (const account of accounts) {
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .take(50);
        for (const code of codes) await ctx.db.delete(code._id);
        await ctx.db.delete(account._id);
      }

      await ctx.db.delete(user._id);
      removed += 1;
    }

    return { candidates: candidates.length, removed };
  },
});
