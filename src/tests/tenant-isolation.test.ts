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

  const { orgId } = await asUser.mutation(
    api.team.createOrganization,
    companyArgs(`Transportes ${suffix.toUpperCase()}`),
  );
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

  return { asUser, driverId, vehicleId, orgId };
}

/** Conta quantos relatórios de erro existem no banco em memória. */
async function countErrors(t: Harness) {
  return t.run(
    async (ctx) => (await ctx.db.query("errorReports").collect()).length,
  );
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

    expect(
      await B.asUser.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId }),
    ).toBeNull();
    expect(
      await B.asUser.query(api.drivers.driverDetail, { driverId: A.driverId }),
    ).toBeNull();
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
    const intacto = await A.asUser.query(api.fleet.vehicleDetail, {
      vehicleId: A.vehicleId,
    });
    expect(intacto?.vehicle.unitNumber).toBe("101");
  });

  it("busca global não mistura empresas", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");

    // "Carlos" existe nas duas: a busca de B só pode devolver o cadastro de B.
    const buscaA = await A.asUser.query(api.logbook.search, { term: "Carlos" });
    const buscaB = await B.asUser.query(api.logbook.search, { term: "Carlos" });

    expect(buscaA.drivers.map((d) => String(d.id))).toEqual([
      String(A.driverId),
    ]);
    expect(buscaB.drivers.map((d) => String(d.id))).toEqual([
      String(B.driverId),
    ]);
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

    expect((await B.asUser.query(api.fleet.listVehicles, {})).rows.length).toBe(
      0,
    );
    const veicA = await A.asUser.query(api.fleet.vehicleDetail, {
      vehicleId: A.vehicleId,
    });
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
    expect(
      await anonimo.query(api.fleet.vehicleDetail, { vehicleId: A.vehicleId }),
    ).toBeNull();
  });

  it("administrador da empresa consegue exportar e ver o diagnóstico", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");

    // Promove um segundo usuário a admin dentro da mesma empresa.
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ana Admin",
        email: "admin@empresa-a.com",
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("memberships", {
        orgId: A.orgId,
        userId: adminId,
        role: "admin",
        createdAt: Date.now(),
      }),
    );
    const admin = t.withIdentity({ subject: adminId });

    // Antes desta correção, `buildExport` exigia owner: a query lançava no
    // render e derrubava a tela do admin. Agora resolve normalmente.
    const dados = await admin.query(api.export.buildExport, {});
    expect(
      dados.files.some((f) => f.name === "veiculos.csv" && f.rows === 1),
    ).toBe(true);
    expect(await admin.query(api.errors.listErrors, {})).toEqual([]);
    await expect(admin.mutation(api.errors.clearErrors, {})).resolves.toEqual({
      removed: 0,
    });
  });

  it("relatório de erro sem empresa é descartado (não infla a tabela)", async () => {
    const t = makeHarness();
    await seedCompany(t, "a");

    // Visitante da landing sem sessão: descartado sem gravar nada.
    const result = await t.mutation(api.errors.reportError, {
      source: "window.onerror",
      message: "algo quebrou numa página pública",
    });
    expect(result).toEqual({ ok: false, reason: "no-org" });
    expect(await countErrors(t)).toBe(0);
  });

  it("relatório de erro logado fica no diagnóstico da própria empresa", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");

    const result = await A.asUser.mutation(api.errors.reportError, {
      source: "window.onerror",
      message: "falha ao abrir o painel",
      stack: "Error: falha\n  at Painel",
    });
    expect(result).toEqual({ ok: true });

    const vistos = await A.asUser.query(api.errors.listErrors, {});
    expect(vistos.length).toBe(1);
    expect(vistos[0].message).toBe("falha ao abrir o painel");

    // E só a própria empresa vê esse relatório.
    const B = await seedCompany(t, "b");
    expect((await B.asUser.query(api.errors.listErrors, {})).length).toBe(0);
  });
});
describe("MVP comercial: operações e permissões", () => {
  it("demonstração carrega, mantém isolamento e não duplica a carga", async () => {
    const t = makeHarness();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "demo@example.test" }),
    );
    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(
      api.team.createOrganization,
      companyArgs("Demonstração"),
    );
    const result = await asUser.mutation(api.fleet.seedDemoFleet, {});
    expect(result.vehicles).toBe(8);
    expect(result.drivers).toBe(6);
    expect((await asUser.query(api.drivers.listDrivers, {})).rows).toHaveLength(
      6,
    );
    await expect(
      asUser.mutation(api.fleet.seedDemoFleet, {}),
    ).rejects.toThrow();
  });

  it("documentos e manutenções de outra empresa não podem ser criados, lidos ou apagados", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const B = await seedCompany(t, "b");
    const maintenance = {
      vehicleId: A.vehicleId,
      serviceDate: Date.now(),
      maintenanceType: "preventive" as const,
      description: "Revisão",
      cost: 200,
      odometerAtService: 120000,
    };
    const document = {
      vehicleId: A.vehicleId,
      documentType: "seguro" as const,
      title: "Seguro",
      status: "pendente" as const,
      amount: 500,
    };
    await expect(
      B.asUser.mutation(api.maintenance.createMaintenance, maintenance),
    ).rejects.toThrow();
    await expect(
      B.asUser.mutation(api.maintenance.createVehicleDocument, document),
    ).rejects.toThrow();
    await A.asUser.mutation(api.maintenance.createMaintenance, maintenance);
    await A.asUser.mutation(api.maintenance.createVehicleDocument, document);
    expect(
      await B.asUser.query(api.maintenance.listMaintenance, {
        vehicleId: A.vehicleId,
      }),
    ).toEqual([]);
    expect(
      await B.asUser.query(api.maintenance.listVehicleDocuments, {
        vehicleId: A.vehicleId,
      }),
    ).toEqual([]);
  });

  it("somente proprietário libera acesso e o identificador precisa corresponder ao e-mail", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "colega@example.test" }),
    );
    await expect(
      A.asUser.mutation(api.team.addMember, {
        email: "outra@example.test",
        accountId: userId,
        role: "admin",
      }),
    ).rejects.toThrow();
    await A.asUser.mutation(api.team.addMember, {
      email: "colega@example.test",
      accountId: userId,
      role: "admin",
    });
    const admin = t.withIdentity({ subject: userId });
    const outsiderId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "outro@example.test" }),
    );
    await expect(
      admin.mutation(api.team.addMember, {
        email: "outro@example.test",
        accountId: outsiderId,
        role: "owner",
      }),
    ).rejects.toThrow();
  });

  it("motorista não acessa prontuário por apenas declarar o mesmo e-mail", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const spoofId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        email: "carlos@empresa-a.com",
      });
      await ctx.db.insert("memberships", {
        userId: id,
        orgId: A.orgId,
        role: "driver",
        createdAt: Date.now(),
      });
      return id;
    });
    const spoof = t.withIdentity({ subject: spoofId });
    expect(
      await spoof.query(api.drivers.driverDetail, { driverId: A.driverId }),
    ).toBeNull();
    const rows = await spoof.query(api.drivers.listDrivers, {});
    expect(rows.rows[0].licenseNumber).toBe("");
    expect(rows.rows[0].phone).toBeNull();
  });

  it("motorista vinculado pelo proprietário vê o próprio prontuário", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "carlos@empresa-a.com" }),
    );
    await A.asUser.mutation(api.team.addMember, {
      email: "carlos@empresa-a.com",
      accountId: userId,
      role: "driver",
    });
    const driver = t.withIdentity({ subject: userId });
    expect(
      (await driver.query(api.drivers.driverDetail, { driverId: A.driverId }))
        ?.driver.phone,
    ).toBe("11999998888");
    await expect(driver.mutation(api.team.completeSetup, {})).rejects.toThrow();
    await expect(driver.query(api.export.buildExport, {})).rejects.toThrow();
    await expect(
      driver.mutation(api.fleet.deleteVehicle, { vehicleId: A.vehicleId }),
    ).rejects.toThrow();
  });

  it("histórico não revela remuneração a despachante nem dados pessoais a motorista", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    await A.asUser.mutation(api.drivers.updateDriver, {
      driverId: A.driverId,
      firstName: "Carlos",
      lastName: "Souza",
      licenseNumber: "CNHa0001",
      status: "active",
      compensationModel: "salary",
      rate: 12345,
      phone: "11987654321",
    });
    const dispatcherId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "dispatcher@example.test",
      });
      await ctx.db.insert("memberships", {
        userId,
        orgId: A.orgId,
        role: "dispatcher",
        createdAt: Date.now(),
      });
      return userId;
    });
    const dispatcher = t.withIdentity({ subject: dispatcherId });
    expect(
      JSON.stringify(await dispatcher.query(api.logbook.activityFeed, {})),
    ).not.toContain("12345");
    expect(
      JSON.stringify(
        await dispatcher.query(api.drivers.driverDetail, {
          driverId: A.driverId,
        }),
      ),
    ).not.toContain("12345");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", dispatcherId))
        .unique();
      await ctx.db.patch(row!._id, { role: "driver" });
    });
    expect(
      JSON.stringify(await dispatcher.query(api.logbook.activityFeed, {})),
    ).not.toContain("11987654321");
  });
});

describe("exclusão completa de registros associados", () => {
  it("excluir veículo não deixa documentos órfãos quando há mais de 500 registros", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "a");
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "pessoaa@empresa-a.com"))
        .first();
      for (let i = 0; i < 501; i++)
        await ctx.db.insert("vehicleDocuments", {
          orgId: A.orgId,
          vehicleId: A.vehicleId,
          documentType: "outro",
          title: `Registro ${i}`,
          status: "pendente",
          createdBy: user!._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    });
    await A.asUser.mutation(api.fleet.deleteVehicle, {
      vehicleId: A.vehicleId,
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("vehicleDocuments")
          .withIndex("by_org_vehicle", (q) =>
            q.eq("orgId", A.orgId).eq("vehicleId", A.vehicleId),
          )
          .collect(),
      ),
    ).toHaveLength(0);
  });
});
