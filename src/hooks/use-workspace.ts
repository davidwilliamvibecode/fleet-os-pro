import { api } from "@/convex/_generated/api";
import type { OrgRole } from "@/convex/constants";
import { useQuery } from "convex/react";

export type WorkspaceOrg = {
  id: string;
  name: string;
  legalName: string;
  contactEmail: string;
  phone: string;
  addressLine: string;
  city: string;
  region: string;
  country: string;
  taxId: string;
  currency: string;
  distanceUnit: string;
  volumeUnit: string;
  timeZone: string;
  plan: string;
  setupCompletedAt: number | null;
  createdAt: number;
};

export type WorkspaceMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: number;
};

export type Workspace = {
  user: { id: string };
  org: WorkspaceOrg | null;
  role: OrgRole | null;
  members: WorkspaceMember[];
};

/** Company, role and team for the signed-in user. `undefined` while loading. */
export function useWorkspace() {
  const workspace = useQuery(api.fleet.workspace) as Workspace | null | undefined;

  return {
    workspace,
    isLoading: workspace === undefined,
    org: workspace?.org ?? null,
    role: workspace?.role ?? null,
    members: workspace?.members ?? [],
    currency: workspace?.org?.currency ?? "USD",
    distanceUnit: workspace?.org?.distanceUnit ?? "mi",
  };
}

/** Roles that may create or edit fleet records (mirrors the server rules). */
export function canEditFleet(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "fleet_manager";
}

/** Roles that may change company settings, team and destructive actions. */
export function canManageCompany(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin";
}
