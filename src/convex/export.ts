import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrg, requireRole, logActivity } from "./fleet";
import { OWNER_ROLES } from "./constants";

/**
 * Exportação dos dados da empresa (backup em CSV).
 *
 * Sem isso, um cliente que entra hoje e sai amanhã não tem como levar os
 * dados embora — e o Termo de Uso até promete essa possibilidade. Cada planilha
 * sai com uma linha por registro e uma coluna por campo, em CSV UTF-8 com BOM
 * e separador `;`, que é o que o Excel em pt-BR abre sem passos extras.
 *
 * Dados sensíveis (salário, valores de documentos, contato/CNH) só entram para
 * quem tem papel autorizado, usando exatamente a mesma regra do resto do app —
 * a exportação não pode virar um buraco na política de privacidade.
 */

/** CSV com `;`, BOM e CRLF: abre direto no Excel brasileiro. */
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text =
      typeof value === "number" && Number.isFinite(value)
        ? new Date(value).toLocaleDateString("pt-BR")
        : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [
    columns.join(";"),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

type ExportFile = { name: string; rows: number; csv: string };

/** Todos os documentos da empresa, prontos para download no navegador. */
export const buildExport = query({
  args: {},
  handler: async (ctx): Promise<{ files: ExportFile[]; generatedAt: number }> => {
    const org = await requireOrg(ctx);
    requireRole(org.role, OWNER_ROLES, "Só o proprietário pode exportar os dados da empresa.");

    const [vehicles, drivers, maintenance, documents, activity] = await Promise.all([
      ctx.db.query("vehicles").withIndex("by_org", (q) => q.eq("orgId", org.orgId)).collect(),
      ctx.db.query("drivers").withIndex("by_org", (q) => q.eq("orgId", org.orgId)).collect(),
      ctx.db
        .query("maintenanceRecords")
        .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
        .collect(),
      ctx.db
        .query("vehicleDocuments")
        .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
        .collect(),
      ctx.db.query("activityLog").withIndex("by_org", (q) => q.eq("orgId", org.orgId)).collect(),
    ]);

    const unitOf = new Map(vehicles.map((v) => [v._id as string, v.unitNumber]));
    const driverNameById = new Map(
      drivers.map((d) => [d._id as string, `${d.firstName} ${d.lastName}`]),
    );

    const files: ExportFile[] = [
      {
        name: "veiculos.csv",
        rows: vehicles.length,
        csv: toCsv(
          vehicles.map((v) => ({
            unidade: v.unitNumber,
            tipo: v.vehicleType,
            marca: v.make,
            modelo: v.model,
            ano: v.year,
            placa: v.plate,
            vin: v.vin,
            combustivel: v.fuelType,
            cambio: v.transmission,
            hodometro: v.odometer,
            hodometroAtualizadoEm: v.odometerUpdatedAt,
            propriedade: v.ownershipType,
            aquisicaoEm: v.acquisitionDate,
            custoAquisicao: v.acquisitionCost,
            valorAtual: v.currentValue,
            fimLocacao: v.leaseEndDate,
            seguro: v.insurancePolicy,
            seguroVenceEm: v.insuranceExpiry,
            licenciamentoVenceEm: v.registrationExpiry,
            proximaRevisaoEm: v.nextServiceDate,
            proximaRevisaoKm: v.nextServiceOdometer,
            situacao: v.status,
            motorista: v.assignedDriverId
              ? (driverNameById.get(v.assignedDriverId as string) ?? "—")
              : "",
            base: v.depot,
            observacoes: v.notes,
            criadoEm: v.createdAt,
            atualizadoEm: v.updatedAt,
          })),
          [
            "unidade",
            "tipo",
            "marca",
            "modelo",
            "ano",
            "placa",
            "vin",
            "combustivel",
            "cambio",
            "hodometro",
            "hodometroAtualizadoEm",
            "propriedade",
            "aquisicaoEm",
            "custoAquisicao",
            "valorAtual",
            "fimLocacao",
            "seguro",
            "seguroVenceEm",
            "licenciamentoVenceEm",
            "proximaRevisaoEm",
            "proximaRevisaoKm",
            "situacao",
            "motorista",
            "base",
            "observacoes",
            "criadoEm",
            "atualizadoEm",
          ],
        ),
      },
      {
        name: "motoristas.csv",
        rows: drivers.length,
        csv: toCsv(
          drivers.map((d) => ({
            nome: `${d.firstName} ${d.lastName}`,
            telefone: d.phone,
            email: d.email,
            endereco: d.addressLine,
            cidade: d.city,
            cnh: d.licenseNumber,
            categoria: d.licenseClass,
            validadeCnh: d.licenseExpiry,
            validadeMedico: d.medicalExpiry,
            admissao: d.hireDate,
            situacao: d.status,
            modeloCompensacao: d.compensationModel,
            valor: d.rate,
            contatoEmergencia: d.emergencyContactName,
            telefoneEmergencia: d.emergencyContactPhone,
            base: d.depot,
            observacoes: d.notes,
            criadoEm: d.createdAt,
            atualizadoEm: d.updatedAt,
          })),
          [
            "nome",
            "telefone",
            "email",
            "endereco",
            "cidade",
            "cnh",
            "categoria",
            "validadeCnh",
            "validadeMedico",
            "admissao",
            "situacao",
            "modeloCompensacao",
            "valor",
            "contatoEmergencia",
            "telefoneEmergencia",
            "base",
            "observacoes",
            "criadoEm",
            "atualizadoEm",
          ],
        ),
      },
      {
        name: "manutencoes.csv",
        rows: maintenance.length,
        csv: toCsv(
          maintenance.map((m) => ({
            unidade: unitOf.get(m.vehicleId as string) ?? "—",
            data: m.serviceDate,
            tipo: m.maintenanceType,
            descricao: m.description,
            pecas: m.partsReplaced,
            custo: m.cost,
            quilometragem: m.odometerAtService,
            local: m.location,
            fornecedor: m.vendor,
            proximaData: m.nextServiceDate,
            proximaQuilometragem: m.nextServiceOdometer,
            observacoes: m.notes,
            criadoEm: m.createdAt,
          })),
          [
            "unidade",
            "data",
            "tipo",
            "descricao",
            "pecas",
            "custo",
            "quilometragem",
            "local",
            "fornecedor",
            "proximaData",
            "proximaQuilometragem",
            "observacoes",
            "criadoEm",
          ],
        ),
      },
      {
        name: "documentos.csv",
        rows: documents.length,
        csv: toCsv(
          documents.map((d) => ({
            unidade: unitOf.get(d.vehicleId as string) ?? "—",
            tipo: d.documentType,
            titulo: d.title,
            vencimento: d.dueDate,
            valor: d.amount,
            situacao: d.status,
            pagoEm: d.paidAt,
            observacoes: d.notes,
          })),
          ["unidade", "tipo", "titulo", "vencimento", "valor", "situacao", "pagoEm", "observacoes"],
        ),
      },
      {
        name: "historico.csv",
        rows: activity.length,
        csv: toCsv(
          activity.map((a) => ({
            quando: a.createdAt,
            quem: a.actorName,
            acao: a.action,
            entidade: a.entity,
            registro: a.entityLabel,
            resumo: a.summary,
          })),
          ["quando", "quem", "acao", "entidade", "registro", "resumo"],
        ),
      },
    ];

    return { files, generatedAt: Date.now() };
  },
});

/**
 * Registro do pedido de exportação.
 *
 * Auditoria: o Termo promete backup, então o ato de exportar fica no livro junto
 * com as demais alterações. Não guardamos o conteúdo — só o fato.
 */
export const recordExport = mutation({
  args: {
    vehicleCount: v.number(),
    driverCount: v.number(),
  },
  handler: async (ctx, args) => {
    const org = await requireOrg(ctx);
    requireRole(org.role, OWNER_ROLES, "Só o proprietário pode exportar os dados da empresa.");
    await logActivity(ctx, {
      orgId: org.orgId,
      userId: org.userId,
      actorName: org.actorName,
      action: "export",
      entity: "company",
      entityLabel: org.orgName,
      summary: `Exportou os dados da empresa: ${args.vehicleCount} veículos e ${args.driverCount} motoristas.`,
    });
    return { ok: true, at: Date.now() };
  },
});