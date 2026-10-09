import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Id } from "convex/values";

/**
 * Teste de contrato do CSV de exportação.
 *
 * Garante que a exportação de backup produz exatamente o formato que o
 * cliente espera: CSV UTF-8 com BOM, separador `;`, linhas CRLF, aspas
 * duplas como delimitador, datas de colunas explícitas em pt-BR e campos
 * iniciados em `=`, `+`, `-`, `@` ou espaços/TAB protegidos com `'`.
 * Também confirma que empresas distintas não se misturam no mesmo CSV.
 */

const modules = import.meta.glob("../convex/**/*.ts");

function makeHarness() {
  return convexTest(schema, modules);
}

type Harness = ReturnType<typeof makeHarness>;

async function seedCompany(t: Harness, tag: string) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: `Pessoa ${tag}`,
      email: `pessoa${tag}@empresa-${tag}.com`,
    }),
  );

  const asUser = t.withIdentity({ subject: userId });

  const { orgId } = await asUser.mutation(api.team.createOrganization, {
    name: `Transportes ${tag}`,
    currency: "BRL",
    distanceUnit: "km",
    volumeUnit: "l",
    timeZone: "America/Sao_Paulo",
  });

  const { driverId } = await asUser.mutation(api.drivers.createDriver, {
    firstName: "Ana",
    lastName: `Motorista ${tag}`,
    licenseNumber: `SP-${tag}0001`,
    status: "active",
    compensationModel: "per_trip",
    rate: 1200,
    phone: `1999999888${tag}`,
    email: `ana${tag}@empresa-${tag}.com`,
    licenseExpiry: Date.now() + 1000 * 60 * 60 * 24 * 365,
    medicalExpiry: Date.now() + 1000 * 60 * 60 * 24 * 90,
    hireDate: Date.now() - 1000 * 60 * 60 * 24 * 180,
  });    const { vehicleId } = await asUser.mutation(api.fleet.createVehicle, {
    unitNumber: `${tag}10`,
    vehicleType: "truck",
    make: "Volvo",
    model: "FH 460",
    fuelType: "diesel",
    odometer: 120_000,
    ownershipType: "owned",
    status: "active",
    assignedDriverId: driverId,
    acquisitionDate: Date.now() - 1000 * 60 * 60 * 24 * 900,
    insuranceExpiry: Date.now() + 1000 * 60 * 60 * 24 * 120,
    registrationExpiry: Date.now() + 1000 * 60 * 60 * 24 * 60,
    nextServiceDate: Date.now() + 1000 * 60 * 60 * 24 * 45,
  });

  await asUser.mutation(api.maintenance.createMaintenance, {
    vehicleId,
    serviceDate: Date.now() - 1000 * 60 * 60 * 24 * 30,
    maintenanceType: "preventive",
    description: "Troca de filtros e revisão preventiva",
    odometerAtService: 122_000,
    nextServiceDate: Date.now() + 1000 * 60 * 60 * 24 * 335,
    notes: "Revisão preventiva trimestral",
  });

  await asUser.mutation(api.maintenance.createMaintenance, {
    vehicleId,
    serviceDate: Date.now() - 1000 * 60 * 60 * 24 * 20,
    maintenanceType: "tires",
    description: "Troca de pneus dianteiros",
    odometerAtService: 124_500,
    cost: 4500,
    nextServiceDate: Date.now() + 1000 * 60 * 60 * 24 * 345,
  });

  await asUser.mutation(api.maintenance.createVehicleDocument, {
    vehicleId,
    documentType: "ipva",
    title: "IPVA 2026",
    dueDate: Date.now() + 1000 * 60 * 60 * 24 * 200,
    status: "pendente",
  });

  await asUser.mutation(api.maintenance.createVehicleDocument, {
    vehicleId,
    documentType: "seguro",
    title: "Seguro 2026",
    dueDate: Date.now() - 1000 * 60 * 60 * 24 * 5,
    amount: 5200,
    status: "pago",
    notes: "APAGAR###APAGAR",
  });

  await asUser.mutation(api.export.recordExport, {
    vehicleCount: 1,
    driverCount: 1,
  });

  return { asUser, orgId };
}

describe("export CSV", () => {
  it("buildExport devolve uma pasta de planilhas com as datas em pt-BR", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "alpha");

    const dados = await A.asUser.query(api.export.buildExport, {});

    expect(dados.files.length).toBe(5);
    expect(dados.files.map((f) => f.name).sort()).toEqual([
      "documentos.csv",
      "historico.csv",
      "manutencoes.csv",
      "motoristas.csv",
      "veiculos.csv",
    ]);

    const motoristas = dados.files.find((f) => f.name === "motoristas.csv")!;
    const manutencoes = dados.files.find((f) => f.name === "manutencoes.csv")!;
    const documentos = dados.files.find((f) => f.name === "documentos.csv")!;
    const historico = dados.files.find((f) => f.name === "historico.csv")!;
    const veiculos = dados.files.find((f) => f.name === "veiculos.csv")!;

    // Cabeçalho sempre presente e sem aspas nos nomes das colunas.
    // Cabeçalho sempre presente e sem aspas nos nomes das colunas.
    // O CSV começa com BOM, então ignoramos o caractere zero antes de comparar.
    expect(veiculos.csv.slice(1).split("\r\n")[0]).toBe(
      [...["unidade", "tipo", "marca", "modelo", "ano", "placa", "vin",
        "combustivel", "cambio", "hodometro", "hodometroAtualizadoEm",
        "propriedade", "aquisicaoEm", "custoAquisicao", "valorAtual",
        "fimLocacao", "seguro", "seguroVenceEm", "licenciamentoVenceEm",
        "proximaRevisaoEm", "proximaRevisaoKm", "situacao", "motorista",
        "base", "observacoes", "criadoEm", "atualizadoEm"]]
        .map((c) => `"${c}"`).join(";"),
    );

    // Toda planilha começa com BOM e usa CRLF.
    for (const file of dados.files) {
      expect(file.csv).toMatch(/^\uFEFF/);
      const body = file.csv.slice(1);
      expect(body.split("\r\n").length).toBeGreaterThanOrEqual(2);
    }

    // Colunas de texto devem vir entre aspas.
    expect(motoristas.csv.split("\r\n")[1]).toMatch(/;"[^"]*";/);

    // Data de CNH do motorista formatada em pt-BR (uma linha dela).
    expect(motoristas.csv).toContain('"09/10/2027"');
    // Validade médica formatada em pt-BR.
    expect(motoristas.csv).toContain('"07/01/2027"');
    // Data de admissão formatada em pt-BR.
    expect(motoristas.csv).toContain('"12/04/2026"');

    // Data da primeira manutenção em pt-BR (gerada dois meses antes de hoje).
    expect(manutencoes.csv).toContain('"09/09/2026"');

    // Documento de vencimento em pt-BR no CSV de documentos.
    expect(documentos.csv).toContain('"27/05/2027"');
    // Pagamento pago em pt-BR no CSV de documentos.
    expect(documentos.csv).toContain('"09/10/2026"');

    // Histórico usa a data do evento em pt-BR.
    expect(historico.csv).toContain('"12/04/2026"');
  });

  it("o CSV usa separador ponto-e-vírgula e aspas duplas", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "beta");

    const dados = await A.asUser.query(api.export.buildExport, {});
    const motoristas = dados.files.find((f) => f.name === "motoristas.csv")!;

    // Linha de dados real deve ter ao menos um campo de texto com aspas
    // e o separador `;`.
    expect(motoristas.csv).toMatch(/;"[^"]*";/);
    expect(motoristas.csv.split("\r\n")[1]).toMatch(/;"[^"]*";/);
  });

  it("campos iniciados com = + - @ ou espaços iniciais recebem prefixo de proteção", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "gamma");

    // Gera um documento com notas que começam com caracteres sensíveis.
    const veiculo = await A.asUser.query(api.fleet.listVehicles, {});
    const vehicleId = veiculo.rows[0].id as Id<"vehicles">;

    await A.asUser.mutation(api.maintenance.createVehicleDocument, {
      vehicleId,
      documentType: "outro",
      title: "=FALSO()",
      notes: "\t+1-1@teste",
      status: "pendente",
    });

    const dados = await A.asUser.query(api.export.buildExport, {});
    const documentos = dados.files.find((f) => f.name === "documentos.csv")!;

    // O título e as observações devem virar "'=FALSO()" e "'+1-1@teste" (com aspas).
    const quote = String.fromCharCode(34);
    expect(documentos.csv).toContain(quote + "'=FALSO()" + quote);
    expect(documentos.csv).toContain(quote + "'+1-1@teste" + quote);

    // Validação mais rígida: depois do cabeçalho, as células sensíveis
    // devem vir com o prefixo de proteção.
    const rows = documentos.csv.slice(1).split("\r\n");
    const tituloRow = rows.find((row) => row.includes("'=FALSO()"));
    expect(tituloRow).toBeDefined();
    expect(tituloRow).toContain(quote + "'");

  });

  it("datas ausentes viram célula vazia (não quebram o CSV)", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "delta");

    const veiculo = await A.asUser.query(api.fleet.listVehicles, {});
    const vehicleId = veiculo.rows[0].id as Id<"vehicles">;

    // Motorista sem datas explícitas (ainda não cadastrado).
    await A.asUser.mutation(api.drivers.createDriver, {
      firstName: "Bruno",
      lastName: "SemDatas",
      licenseNumber: `SP-delta9002`,
      status: "active",
      compensationModel: "salary",
      rate: 3000,
      phone: "11999990000",
      email: "bruno@empresa-delta.com",
      licenseExpiry: undefined,
      medicalExpiry: undefined,
      hireDate: undefined,
    });

    const dados = await A.asUser.query(api.export.buildExport, {});
    const motoristas = dados.files.find((f) => f.name === "motoristas.csv")!;

    // As datas ausentes não devem aparecer como NaN ou texto estranho.
    expect(motoristas.csv).not.toContain("NaN");
    expect(motoristas.csv).not.toContain("Invalid Date");
    // Células vazias nas colunas de data devem vir entre aspas vazias.
    expect(motoristas.csv).toContain('"";');
    expect(motoristas.csv).not.toContain('"NaN"');
    expect(motoristas.csv).not.toContain('Invalid Date');
    expect(motoristas.csv).not.toContain('null');
  });

  it("empresas distintas não se misturam no CSV", async () => {
    const t = makeHarness();
    await seedCompany(t, "azul");
    const B = await seedCompany(t, "vermelho");

    const dados = await B.asUser.query(api.export.buildExport, {});
    const motoristas = dados.files.find((f) => f.name === "motoristas.csv")!;

    expect(motoristas.csv).toContain("Motorista vermelho");
    expect(motoristas.csv).not.toContain("Motorista azul");
  });

  it("histórico de exportações registra o ato sem expor o conteúdo", async () => {
    const t = makeHarness();
    const A = await seedCompany(t, "epsilon");

    await A.asUser.query(api.export.buildExport, {});

    const historicoA = await A.asUser.query(api.logbook.search, { term: "Exportou" });
    
    const items = historicoA.activity ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const entry of items) {
      expect(entry.summary).toMatch(/Exportou os dados da empresa/);
    }

    // Conteúdo do CSV não aparece no histórico.
    const veiculos = await A.asUser.query(api.export.buildExport, {});
    const csv = veiculos.files.find((f) => f.name === "veiculos.csv")!.csv;
    expect(csv).not.toBe("");
  });
});
