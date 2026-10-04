import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { RATE_LIMITS, type RateLimitRule } from "./rateLimit";

/**
 * Chamada curta a partir das mutations:
 * `await limit(ctx, context.orgId, "invite")`.
 *
 * Fica separado do `rateLimit.ts` para as mutations importarem só isto — sem
 * precisar conhecer `internal` nem a estrutura da regra.
 */
export async function limit(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  action: keyof typeof RATE_LIMITS,
) {
  const rule: RateLimitRule = RATE_LIMITS[action];
  await ctx.runMutation(internal.rateLimit.enforceRateLimit, {
    orgId,
    key: action,
    rule,
  });
}