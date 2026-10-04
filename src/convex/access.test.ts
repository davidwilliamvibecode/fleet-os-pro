import { describe, expect, it } from "vitest";
import { canSeeDriverPersonalData } from "./access";
import { canSeeCompensation, requireRole } from "./fleet";
import { COMPENSATION_ROLES, OWNER_ROLES, TEAM_ROLES } from "./constants";

/**
 * Testes das regras de autorização.
 *
 * Estas são as funções que sustentam o isolamento entre empresas e a política
 * de privacidade — o tipo TypeScript garante a assinatura, mas não garante que
 * a decisão dentro da função continue correta depois de um refactor. Um teste
 * que falha aqui é o alarme mais barato que existe: sem servidor, sem banco e
 * em menos de um segundo.
 */

describe("canSeeDriverPersonalData", () => {
  it("dá acesso aos papéis que não são motorista", () => {
    for (const role of ["owner", "admin", "fleet_manager", "dispatcher", "finance", "viewer"] as const) {
      expect(canSeeDriverPersonalData(role, "colega@empresa.com", "outro@empresa.com")).toBe(true);
    }
  });

  it("motorista só vê os próprios dados, casando o e-mail do prontuário", () => {
    expect(canSeeDriverPersonalData("driver", "eu@empresa.com", "eu@empresa.com")).toBe(true);
    expect(canSeeDriverPersonalData("driver", "eu@empresa.com", "colega@empresa.com")).toBe(false);
  });

  it("ignora maiúsculas e espaços nos dois e-mails", () => {
    expect(canSeeDriverPersonalData("driver", "  EU@Empresa.COM ", "eu@empresa.com")).toBe(true);
  });

  it("nega quando falta e-mail dos dois lados — o padrão é negar", () => {
    // Sem e-mail no prontuário não há como provar que é o próprio cadastro.
    expect(canSeeDriverPersonalData("driver", undefined, "eu@empresa.com")).toBe(false);
    expect(canSeeDriverPersonalData("driver", "", "eu@empresa.com")).toBe(false);
    // Convidado sem e-mail não pode casar com prontuário sem e-mail.
    expect(canSeeDriverPersonalData("driver", "", "")).toBe(false);
    expect(canSeeDriverPersonalData("driver", undefined, undefined as unknown as string)).toBe(false);
  });
});

describe("canSeeCompensation", () => {
  it("só quem administra a folha enxerga a remuneração", () => {
    for (const role of COMPENSATION_ROLES) {
      expect(canSeeCompensation(role)).toBe(true);
    }
  });

  it("motorista e dispatch não veem salário de terceiros", () => {
    expect(canSeeCompensation("driver")).toBe(false);
    expect(canSeeCompensation("dispatcher")).toBe(false);
    expect(canSeeCompensation("viewer")).toBe(false);
  });
});

describe("requireRole", () => {
  it("passa quando o papel está na lista", () => {
    expect(() => requireRole("owner", OWNER_ROLES, "só o dono")).not.toThrow();
  });

  it("recusa com a mensagem informada quando o papel não está na lista", () => {
    expect(() => requireRole("dispatcher", OWNER_ROLES, "só o dono")).toThrow("só o dono");
    expect(() => requireRole("admin", TEAM_ROLES, "apenas o dono")).toThrow("apenas o dono");
  });
});

describe("listas de papéis", () => {
  it("o dono é o único que gerencia a equipe", () => {
    expect(OWNER_ROLES).toEqual(["owner"]);
    expect(TEAM_ROLES).toEqual(["owner"]);
  });

  it("compensação não inclui papéis de operação", () => {
    expect(COMPENSATION_ROLES).not.toContain("dispatcher");
    expect(COMPENSATION_ROLES).not.toContain("driver");
    expect(COMPENSATION_ROLES).not.toContain("viewer");
  });
});