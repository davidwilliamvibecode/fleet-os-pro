import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "../convex/rateLimit";

/**
 * O rate limit é a defesa contra laço automático (convite em massa, cadastro
 * em loop). Testamos o *contrato* das regras aqui — a contagem em si depende
 * do banco e é exercitada em produção pelo contador visível no erro.
 */

describe("RATE_LIMITS", () => {
  it("convite é a ação mais contenida entre as de criação", () => {
    // Convidar cria acesso de pessoa real: cota bem mais baixa que cadastro.
    expect(RATE_LIMITS.invite.limit).toBeLessThan(RATE_LIMITS.createVehicle.limit);
    expect(RATE_LIMITS.invite.limit).toBeLessThan(RATE_LIMITS.createDriver.limit);
  });

  it("carga de demonstração e operações destrutivas têm cota baixa", () => {
    expect(RATE_LIMITS.seed.limit).toBeLessThanOrEqual(3);
    expect(RATE_LIMITS.bulk.limit).toBeLessThanOrEqual(10);
  });

  it("toda regra tem janela positiva e limite positivo", () => {
    for (const [action, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, `${action}.limit`).toBeGreaterThan(0);
      expect(rule.windowMinutes, `${action}.windowMinutes`).toBeGreaterThan(0);
      expect(Number.isFinite(rule.limit)).toBe(true);
      expect(Number.isFinite(rule.windowMinutes)).toBe(true);
    }
  });

  it("cadastros em lote deixam passar trabalho humano normal", () => {
    // 120 em 10 minutos = 12/min: cadastrar 15 veículos seguidos não esbarra.
    expect(RATE_LIMITS.createVehicle.limit).toBeGreaterThanOrEqual(100);
    expect(RATE_LIMITS.createDriver.limit).toBeGreaterThanOrEqual(100);
  });
});