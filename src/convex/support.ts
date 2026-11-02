import {
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { validatePassword } from "../lib/password";

/** Administrative access only. The operator must first verify the person through a known channel. */
export const recoveryAccount = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const user = await ctx.db.get(args.userId);
    const email = args.email.trim().toLowerCase();
    if (!user || user.isAnonymous || user.email !== email)
      throw new ConvexError("Conta e e-mail não correspondem.");
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account || account.userId !== args.userId)
      throw new ConvexError("Conta de senha não encontrada.");
    return email;
  },
});

/** No public password-reset endpoint or email-based account takeover. */
export const resetPassword = internalAction({
  args: { userId: v.id("users"), email: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    validatePassword(args.newPassword);
    const email = await ctx.runQuery(internal.support.recoveryAccount, {
      userId: args.userId,
      email: args.email,
    });
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId: args.userId });
    return { ok: true };
  },
});
