import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

/**
 * Teste de integração do isolamento entre empresas.
 *
 * Até aqui o isolamento era provado por leitura de código e por typecheck. Aqui
 * ele é **executado**: subimos as functions reais contra um backend em memória
 * (`convex-test`), criamos duas empresas com dados distintos e tentamos, de
 * dentro da empresa B, alcançar tudo da empresa A.
 *
 * É o teste que fecha a lacuna da auditoria: se alguém refatorar e esquecer um
 * `orgId`, este arquivo quebra — coisa que o typecheck não pegaria, já que a
 * checagem de empresa acontece em runtime.
 *
 * Fica em `src/tests/` de propósito: o push do Convex compila tudo que está em
 * `src/convex/`, e este arquivo não é uma função do backend.
 */

// `import.meta.glob` é o que dá acesso a TODOS os módulos, inclusive o
// `_generated` — sem ele o convex-test não encontra o diretório gerado.
const modules = import.meta.glob("../convex/**/*.ts") as unknown as Record<
  string,
  () => Promise<unknown>
>;

function companyArgs(name: string) {
  return {
    name,
    currency: "BRL",
    distanceUnit: "km" as const,
    volumeUnit: "l" as const,
    timeZone: "America/Sao_Paulo",
  };
}

// Tipo inferido da própria chamada — evita reescrever o genérico do schema.
function makeHarness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof makeHarness>;

/** Cria uma empresa completa (veículo + motorista) e devolve quem entrou. */
async function seedCompany(t: Harness, suffix: "a" | "b") {
  // A identidade precisa apontar para um usuário que existe de verdade: o
  // `createOrganization` grava `createdBy`, que é uma referência ao documento.
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: `Pessoa ${suffix.toUpperCase()}`,
      email: `pessoa${suffix}@empresa-${suffix}.com`,
    }),
  );
  const asUser = t.withIdentity({ subject: userId });

  await asUser.mutation(api.team.createOrganization, companyArgs(`Transportes ${suffix.toUpperCase()}`));

  const { driverId } = await asUser.mutation(api.drivers.createDriver, {
    firstName: "Carlos",
    lastName: "Souza",
    licenseNumber: `CNH${suffix}0001`,
    status: "active",
    compensationModel: "per_trip",
    rate: 950,
    phone: suffix === "a" ? "11999998888" : "11888887777",
    email: `carlos@empresa-${suffix}.com`,
  });

  const { vehicleId } = await asUser.mutation(api.fleet.createVehicle, {
    unitNumber: suffix === "a" ? "101" : "202",
    vehicleType: "truck",
    make: "Volvo",
    model: "FH 460",
    fuelType: "diesel",
    odometer: 120_000,
    ownershipType: "owned",
    status: "active",
    assignedDriverId: driverId,
  });

  return { asUser, driverId, vehicleId };
}

describe("isolamento entre empresas", () => {
  it("cada empresa enxerga só os próprios registros", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    const veicA = await A.asUser.query(api.fleet.listVehicles, {});
    const veicB = await B.asUser.query(api.fleet.listVehicles, {});
    expect(veicA.rows.length).toBe(1);
    expect(veicB.rows.length).toBe(1);

    // O id do veículo da A não aparece na lista da B.
    const idsB = veicB.rows.map((row) => String(row.id));
    expect(idsB).not.toContain(String(A.vehicleId));
    expect(idsB).toContain(String(B.vehicleId));
  });

  it("conhecer o id exato não abre o registro de outra empresa", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    expect(await B.asUser.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId })).toBeNull();
    expect(await B.asUser.query(api.drivers.driverDetail, { driverId: A.driverId })).toBeNull();
  });

  it("não dá para alterar ou apagar registro de outra empresa", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    // `updateVehicle`/`updateDriver` recebem o cadastro inteiro (não são patch),
    // então a tentativa traz todos os campos válidos — só o id é da outra
    // empresa, que é exatamente o que precisa ser barrado.
    await expect(
      B.asUser.mutation(api.fleet.updateVehicle, {
        vehicleId: A.vehicleId,
        unitNumber: "999",
        vehicleType: "truck",
        make: "Volvo",
        model: "FH 460",
        fuelType: "diesel",
        odometer: 120_000,
        ownershipType: "owned",
        status: "active",
      }),
    ).rejects.toThrow();

    await expect(
      B.asUser.mutation(api.fleet.deleteVehicle, { vehicleId: A.vehicleId }),
    ).rejects.toThrow();

    await expect(
      B.asUser.mutation(api.drivers.updateDriver, {
        driverId: A.driverId,
        firstName: "Carlos",
        lastName: "Souza",
        licenseNumber: "CNHa0001",
        status: "active",
        compensationModel: "per_trip",
        rate: 1,
      }),
    ).rejects.toThrow();

    await expect(
      B.asUser.mutation(api.drivers.deleteDriver, { driverId: A.driverId }),
    ).rejects.toThrow();

    // O registro da A continua intacto depois das quatro tentativas.
    const intacto = await A.asUser.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId });
    expect(intacto?.vehicle.unitNumber).toBe("101");
  });

  it("busca global não mistura empresas", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    // "Carlos" existe nas duas: a busca de B só pode devolver o cadastro de B.
    const buscaA = await A.asUser.query(api.logbook.search, { term: "Carlos" });
    const buscaB = await B.asUser.query(api.logbook.search, { term: "Carlos" });

    expect(buscaA.drivers.map((d) => String(d.id))).toEqual([String(A.driverId)]);
    expect(buscaB.drivers.map((d) => String(d.id))).toEqual([String(B.driverId)]);
  });

  it("exportação da empresa B não inclui dados da empresa A", async () => {
    const t = makeHarness();
    await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    const dados = await B.asUser.query(api.export.buildExport, {});
    const veiculos = dados.files.find((f) => f.name === "veiculos.csv");
    const motoristas = dados.files.find((f) => f.name === "motoristas.csv");

    expect(veiculos?.rows).toBe(1);
    expect(motoristas?.rows).toBe(1);
    // Dado exclusivo da A não pode aparecer no CSV da B.
    expect(motoristas?.csv).not.toContain("carlos@empresa-a.com");
    expect(motoristas?.csv).toContain("carlos@empresa-b.com");
    expect(veiculos?.csv).not.toContain("101");
  });

  it("limpar a empresa B não apaga o cadastro da empresa A", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    await B.asUser.mutation(api.fleet.clearFleetData, {});

    expect((await B.asUser.query(api.fleet.listVehicles, {})).rows.length).toBe(0);
    const veicA = await A.asUser.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId });
    expect(veicA).not.toBeNull();
    expect(veicA?.vehicle.unitNumber).toBe("101");
  });

  it("sem sessão, tudo vem vazio — inclusive com o id correto em mãos", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");

    // Sem `withIdentity` o harness é anônimo — é o mesmo estado de um visitante
    // que abriu a landing page.
    const anonimo = t;
    expect((await anonimo.query(api.fleet.listVehicles, {})).rows).toEqual([]);
    expect(await anonimo.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId })).toBeNull();
  });
});