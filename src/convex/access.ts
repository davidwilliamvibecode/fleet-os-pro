import type { OrgRole } from "./constants";

/** Self access uses an account explicitly linked by the company, never an unverified email. */
export function canSeeDriverPersonalData(
  role: OrgRole,
  linkedUserId: string | undefined,
  callerUserId: string,
) {
  if (role !== "driver") return true;
  return Boolean(linkedUserId && callerUserId && linkedUserId === callerUserId);
}

/** The audit log must obey the same privacy rules as the current record. */
export function visibleActivity<
  T extends {
    entity: string;
    summary: string;
    changes?: { field: string; from?: string; to?: string }[];
  },
>(role: OrgRole, row: T): T {
  if (role === "driver" && row.entity === "driver")
    return {
      ...row,
      summary: "Atualizou um cadastro de motorista.",
      changes: [],
    };
  if (!["owner", "admin", "fleet_manager", "finance"].includes(role)) {
    return {
      ...row,
      changes: row.changes?.filter((change) => change.field !== "Remuneração"),
    };
  }
  return row;
}
