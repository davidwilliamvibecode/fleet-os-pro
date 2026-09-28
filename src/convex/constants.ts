/**
 * Shared option lists for Fleet Command.
 *
 * Kept free of Convex imports so the browser bundle can import the same arrays
 * the database validators are built from (see ./schema.ts). Add new options
 * here first, then mirror them in the validators.
 */

export const VEHICLE_STATUSES = [
  "active",
  "available",
  "assigned",
  "maintenance",
  "out_of_service",
  "sold",
  "retired",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_TYPES = [
  "truck",
  "van",
  "pickup",
  "suv",
  "trailer",
  "bus",
  "car",
  "equipment",
  "other",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const FUEL_TYPES = [
  "diesel",
  "gasoline",
  "electric",
  "hybrid",
  "cng",
  "lpg",
  "other",
] as const;

export const TRANSMISSIONS = ["automatic", "manual", "automated_manual"] as const;

export const OWNERSHIP_TYPES = ["owned", "financed", "leased", "rented"] as const;

export const DRIVER_STATUSES = ["active", "on_leave", "suspended", "inactive"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const COMPENSATION_MODELS = [
  "salary",
  "hourly",
  "per_mile",
  "per_trip",
  "owner_operator",
] as const;

export const ORG_ROLES = [
  "owner",
  "admin",
  "fleet_manager",
  "dispatcher",
  "maintenance",
  "finance",
  "driver",
  "viewer",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const DISTANCE_UNITS = ["mi", "km"] as const;
export const VOLUME_UNITS = ["gal", "l"] as const;

/** Roles that may create/update fleet records. */
export const FLEET_WRITE_ROLES: OrgRole[] = ["owner", "admin", "fleet_manager"];
/** Roles that may edit company settings. */
export const COMPANY_ROLES: OrgRole[] = ["owner", "admin"];
/**
 * Roles that may manage team members (invite, change role, remove).
 *
 * Owner-only on purpose: an admin could otherwise promote an accomplice (or
 * themselves, through a peer) to `owner` and take the workspace over. Team
 * membership is an account-ownership function, which the product spec also
 * reserves to the owner.
 */
export const TEAM_ROLES: OrgRole[] = ["owner"];
/** Roles that may hand out owner access. Deliberately narrow: an admin cannot mint owners. */
export const OWNER_ROLES: OrgRole[] = ["owner"];
/** Roles allowed to read driver compensation (salary data). */
export const COMPENSATION_ROLES: OrgRole[] = ["owner", "admin", "fleet_manager", "finance"];

export const MAINTENANCE_TYPES = [
  "preventive",
  "corrective",
  "inspection",
  "tires",
  "oil_change",
  "brakes",
  "suspension",
  "electrical",
  "bodywork",
  "other",
] as const;

export const DOCUMENT_TYPES = [
  "ipva",
  "licenciamento",
  "seguro",
  "dpvat",
  "inspecao",
  "taf",
  "antt",
  "outro",
] as const;

/** Days before a compliance date where it starts showing as "expiring soon". */
export const EXPIRY_WARNING_DAYS = 45;
