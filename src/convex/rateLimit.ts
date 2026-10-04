import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Contenção de taxa por empresa.
 *
 * O Convex não limita escrita por.function, e o login por e-mail tem limite só
 * de tentativas de código — então convidar alguém ou cadastrar veículo em
 * laço é possível. Aqui cada ação sensível ganha uma janela deslizante: N
 * execuções por período, contadas a partir das execuções recentes.
 *
 * Por que janela deslizante e não contador fixo: um contador "10 por hora"
 * que zera no topo da hora deixa passar o dobro na virada. Guardamos só as
 * marcas de tempo dentro da janela e descartamos as antigas — o custo é uma
 * leitura indexada e barata.
 *
 * A chave é `orgId + ação`, então uma empresa travada não bloqueia as outras,
 * e um usuário travado não tranca o resto da equipe dele (a cota é do espaço
 * de trabalho, não da pessoa).
 */

const MINUTE = 60 * 1000;

export type RateLimitRule = {
  /** Máximo de execuções dentro da janela. */
  limit: number;
  /** Tamanho da janela em minutos. */
  windowMinutes: number;
};

/**
 * Limites por ação. Calibrados para uso humano normal com folga — a ideia é
 * barrar laço automático, não atrapalhar quem cadastra 15 veículos seguido.
 */
export const RATE_LIMITS = {
  /** Convidar equipe: poucos por hora, porque cada convite é uma pessoa real. */
  invite: { limit: 20, windowMinutes: 60 },
  /** Cadastro em lote: generoso, mas infinite loop ainda esbarra. */
  createVehicle: { limit: 120, windowMinutes: 10 },
  createDriver: { limit: 120, windowMinutes: 10 },
  createMaintenance: { limit: 120, windowMinutes: 10 },
  createDocument: { limit: 120, windowMinutes: 10 },
  /** Carga de demonstração: baixa por ser operação destrutiva em massa. */
  seed: { limit: 3, windowMinutes: 60 },
  /** Exportação/limpeza geram histórico e carga; não devem ser automatizadas. */
  bulk: { limit: 10, windowMinutes: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Registra a tentativa e recusa se estourou a cota.
 *
 * Incrementa mesmo quando recusa (senão o abusive continua "usando" a cota sem
 * custo e o registro mente). O `await` do patch é o ponto de serialização: só
 * uma escrita por doc por vez, o que evita que requisições simultâneas leiam o
 * mesmo estado e passem as duas.
 */
export const enforceRateLimit = internalMutation({
  args: {
    orgId: v.id("organizations"),
    key: v.string(),
    rule: v.object({ limit: v.number(), windowMinutes: v.number() }),
  },
  handler: async (ctx, args) => {
    const windowMs = Math.max(1, args.rule.windowMinutes) * MINUTE;
    const now = Date.now();
    const cutoff = now - windowMs;

    const doc = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", `${args.orgId}:${args.key}`))
      .unique();

    const recent = (doc?.hits ?? []).filter((at) => at > cutoff);

    if (recent.length >= args.rule.limit) {
      const oldest = recent[0];
      const waitSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      if (doc) {
        await ctx.db.patch(doc._id, { hits: recent });
      }
      throw new ConvexError(
        `Muitas tentativas em pouco tempo. Tente novamente em ${Math.ceil(waitSeconds / 60)} minuto(s).`,
      );
    }

    if (doc) {
      await ctx.db.patch(doc._id, { hits: [...recent, now] });
    } else {
      await ctx.db.insert("rateLimits", {
        key: `${args.orgId}:${args.key}`,
        orgId: args.orgId,
        hits: [...recent, now],
      });
    }

    return { ok: true };
  },
});

/** Zera a cota de uma ação (usado quando a empresa termina a carga em lote). */
export const resetRateLimit = internalMutation({
  args: { orgId: v.id("organizations"), key: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", `${args.orgId}:${args.key}`))
      .unique();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});