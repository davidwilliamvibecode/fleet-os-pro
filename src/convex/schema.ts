import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/* -------------------------------------------------------------------------- */
/*  Fleet OS Pro validators                                                  */
/*  Kept explicit (not derived) so `Doc<>` types stay narrow in the frontend.  */
/* -------------------------------------------------------------------------- */

export const orgRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("fleet_manager"),
  v.literal("dispatcher"),
  v.literal("maintenance"),
  v.literal("finance"),
  v.literal("driver"),
  v.literal("viewer"),
);
export type OrgRole = Infer<typeof orgRoleValidator>;

export const vehicleStatusValidator = v.union(
  v.literal("active"),
  v.literal("available"),
  v.literal("assigned"),
  v.literal("maintenance"),
  v.literal("out_of_service"),
  v.literal("sold"),
  v.literal("retired"),
);
export type VehicleStatus = Infer<typeof vehicleStatusValidator>;

export const vehicleTypeValidator = v.union(
  v.literal("truck"),
  v.literal("van"),
  v.literal("pickup"),
  v.literal("suv"),
  v.literal("trailer"),
  v.literal("bus"),
  v.literal("car"),
  v.literal("equipment"),
  v.literal("other"),
);
export type VehicleType = Infer<typeof vehicleTypeValidator>;

export const fuelTypeValidator = v.union(
  v.literal("diesel"),
  v.literal("gasoline"),
  v.literal("electric"),
  v.literal("hybrid"),
  v.literal("cng"),
  v.literal("lpg"),
  v.literal("other"),
);

export const transmissionValidator = v.union(
  v.literal("automatic"),
  v.literal("manual"),
  v.literal("automated_manual"),
);

export const ownershipValidator = v.union(
  v.literal("owned"),
  v.literal("financed"),
  v.literal("leased"),
  v.literal("rented"),
);

export const driverStatusValidator = v.union(
  v.literal("active"),
  v.literal("on_leave"),
  v.literal("suspended"),
  v.literal("inactive"),
);
export type DriverStatus = Infer<typeof driverStatusValidator>;

export const compensationValidator = v.union(
  v.literal("salary"),
  v.literal("hourly"),
  v.literal("per_mile"),
  v.literal("per_trip"),
  v.literal("owner_operator"),
);

export const distanceUnitValidator = v.union(v.literal("mi"), v.literal("km"));
export const volumeUnitValidator = v.union(v.literal("gal"), v.literal("l"));

export const activityActionValidator = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("delete"),
  v.literal("assign"),
  v.literal("status_change"),
  v.literal("seed"),
  v.literal("member"),
  // O Termo de Uso promete backup, então a saída de dados fica auditada.
  v.literal("export"),
);
export type ActivityAction = Infer<typeof activityActionValidator>;

export const activityEntityValidator = v.union(
  v.literal("vehicle"),
  v.literal("driver"),
  v.literal("company"),
  v.literal("member"),
  v.literal("workspace"),
  v.literal("maintenance"),
  v.literal("document"),
);
export type ActivityEntity = Infer<typeof activityEntityValidator>;

export const maintenanceTypeValidator = v.union(
  v.literal("preventive"),
  v.literal("corrective"),
  v.literal("inspection"),
  v.literal("tires"),
  v.literal("oil_change"),
  v.literal("brakes"),
  v.literal("suspension"),
  v.literal("electrical"),
  v.literal("bodywork"),
  v.literal("other"),
);
export type MaintenanceType = Infer<typeof maintenanceTypeValidator>;

export const documentTypeValidator = v.union(
  v.literal("ipva"),
  v.literal("licenciamento"),
  v.literal("seguro"),
  v.literal("dpvat"),
  v.literal("inspecao"),
  v.literal("taf"),
  v.literal("antt"),
  v.literal("outro"),
);
export type DocumentType = Infer<typeof documentTypeValidator>;

export const documentStatusValidator = v.union(
  v.literal("pago"),
  v.literal("pendente"),
  v.literal("atrasado"),
);
export type DocumentStatus = Infer<typeof documentStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      // phone + phoneVerificationTime are part of @convex-dev/auth's own users
      // table. Sem eles, qualquer provedor por telefone (ou um `profile` que
      // traga `phone`) quebraria a criação de conta.
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      termsAcceptedAt: v.optional(v.number()),
      legalVersion: v.optional(v.string()),
      role: v.optional(roleValidator), // role of the user. do not remove
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("phone", ["phone"]),

    /**
     * One row per fleet company (tenant). Every operational record points back
     * here, and every query is scoped by the signed-in user's membership, which
     * is what keeps tenants isolated.
     */
    organizations: defineTable({
      name: v.string(),
      legalName: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      phone: v.optional(v.string()),
      addressLine: v.optional(v.string()),
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      country: v.optional(v.string()),
      taxId: v.optional(v.string()),
      currency: v.string(),
      distanceUnit: distanceUnitValidator,
      volumeUnit: volumeUnitValidator,
      timeZone: v.string(),
      plan: v.string(),
      setupCompletedAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_createdBy", ["createdBy"]),

    /** Links a user to a company with a role. Drives all authorization checks. */
    memberships: defineTable({
      orgId: v.id("organizations"),
      userId: v.id("users"),
      role: orgRoleValidator,
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_org", ["orgId"])
      .index("by_org_user", ["orgId", "userId"]),

    /** The fleet register: every unit the company operates. */
    vehicles: defineTable({
      orgId: v.id("organizations"),
      unitNumber: v.string(),
      vehicleType: vehicleTypeValidator,
      make: v.string(),
      model: v.string(),
      year: v.optional(v.number()),
      vin: v.optional(v.string()),
      plate: v.optional(v.string()),
      fuelType: fuelTypeValidator,
      transmission: v.optional(transmissionValidator),
      odometer: v.number(),
      odometerUpdatedAt: v.optional(v.number()),
      ownershipType: ownershipValidator,
      acquisitionDate: v.optional(v.number()),
      acquisitionCost: v.optional(v.number()),
      currentValue: v.optional(v.number()),
      leaseEndDate: v.optional(v.number()),
      insurancePolicy: v.optional(v.string()),
      insuranceExpiry: v.optional(v.number()),
      registrationExpiry: v.optional(v.number()),
      nextServiceDate: v.optional(v.number()),
      nextServiceOdometer: v.optional(v.number()),
      status: vehicleStatusValidator,
      assignedDriverId: v.optional(v.id("drivers")),
      depot: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_unit", ["orgId", "unitNumber"])
      .index("by_org_plate", ["orgId", "plate"])
      .index("by_org_vin", ["orgId", "vin"])
      .index("by_org_driver", ["orgId", "assignedDriverId"]),

    /** The driver roster. Vehicle assignment lives on the vehicle record. */
    drivers: defineTable({
      orgId: v.id("organizations"),
      accountUserId: v.optional(v.id("users")),
      firstName: v.string(),
      lastName: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      addressLine: v.optional(v.string()),
      city: v.optional(v.string()),
      licenseNumber: v.string(),
      licenseClass: v.optional(v.string()),
      licenseExpiry: v.optional(v.number()),
      medicalExpiry: v.optional(v.number()),
      hireDate: v.optional(v.number()),
      status: driverStatusValidator,
      compensationModel: compensationValidator,
      rate: v.optional(v.number()),
      emergencyContactName: v.optional(v.string()),
      emergencyContactPhone: v.optional(v.string()),
      depot: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_status", ["orgId", "status"])
      .index("by_org_license", ["orgId", "licenseNumber"]),

    /** System-wide audit trail: what changed, who changed it, and when. */
    activityLog: defineTable({
      orgId: v.id("organizations"),
      userId: v.optional(v.id("users")),
      actorName: v.string(),
      action: activityActionValidator,
      entity: activityEntityValidator,
      entityId: v.optional(v.string()),
      entityLabel: v.string(),
      summary: v.string(),
      changes: v.optional(
        v.array(
          v.object({
            field: v.string(),
            from: v.optional(v.string()),
            to: v.optional(v.string()),
          }),
        ),
      ),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_entity", ["orgId", "entity"])
      .index("by_record", ["orgId", "entity", "entityId"]),

    /**
     * Maintenance service records: what was done, which parts were swapped,
     * what it cost, at which mileage, and where the work happened.
     */
    maintenanceRecords: defineTable({
      orgId: v.id("organizations"),
      vehicleId: v.id("vehicles"),
      serviceDate: v.number(),
      maintenanceType: maintenanceTypeValidator,
      description: v.string(),
      partsReplaced: v.optional(v.string()),
      cost: v.optional(v.number()),
      odometerAtService: v.number(),
      location: v.optional(v.string()),
      vendor: v.optional(v.string()),
      nextServiceDate: v.optional(v.number()),
      nextServiceOdometer: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_vehicle", ["orgId", "vehicleId"])
      .index("by_org_date", ["orgId", "serviceDate"]),

    /**
      * Per-vehicle government documents, renewals and taxes to be paid
      * (IPVA, licenciamento, seguro, DPVAT, inspeção, TAF, ANTT…).
      */
    vehicleDocuments: defineTable({
      orgId: v.id("organizations"),
      vehicleId: v.id("vehicles"),
      documentType: documentTypeValidator,
      title: v.string(),
      dueDate: v.optional(v.number()),
      amount: v.optional(v.number()),
      status: documentStatusValidator,
      paidAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_org_vehicle", ["orgId", "vehicleId"])
      .index("by_org_status", ["orgId", "status"]),

    /**
     * Erros de runtime reportados pelo app (error tracking interno).
     *
     * Sem isso, uma falha em produção só aparece quando o cliente reclama.
     * Guardamos o essencial — sem dados pessoais dos titulares — e os papéis
     * autorizados da empresa conseguem ver a lista em Configurações.
     */
    errorReports: defineTable({
      orgId: v.optional(v.id("organizations")),
      source: v.string(),
      message: v.string(),
      stack: v.optional(v.string()),
      context: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_org", ["orgId"])
      .index("by_created", ["createdAt"]),

    /**
     * Cotas de uso por empresa (`orgId:ação`). Só guarda as marcas de tempo
     * dentro da janela — o que deixa a própria expiração fazer a limpeza.
     */
    rateLimits: defineTable({
      orgId: v.id("organizations"),
      key: v.string(),
      hits: v.array(v.number()),
    })
      .index("by_key", ["key"])
      .index("by_org", ["orgId"]),
  },
  {
    // Validação ligada: toda escrita passa a ser conferida contra este schema,
    // então um bug que gravasse um campo errado falha alto e cedo, em vez de
    // deixar lixo no banco. O schema abaixo cobre tudo o que o app e o
    // @convex-dev/auth escrevem (verificado campo por campo).
    schemaValidation: true,
  },
);

export default schema;
