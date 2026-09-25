import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import {
  EmptyNote,
  LoadingNote,
  PageHeader,
  PaperPanel,
  SectionHeading,
  Stamp,
  StickyNote,
} from "@/components/notebook";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DISTANCE_UNITS, VOLUME_UNITS } from "@/convex/constants";
import {
  canManageCompany,
  useWorkspace,
  type WorkspaceMember,
} from "@/hooks/use-workspace";
import { errorMessage } from "@/lib/errors";
import {
  ORG_ROLE_LABELS,
  formatDate,
  labelFrom,
} from "@/lib/format";
import { useMutation } from "convex/react";
import {
  Building2,
  Loader2,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_OPTIONS = Object.entries(ORG_ROLE_LABELS).filter(([value]) => value !== "owner");
const TIME_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Australia/Sydney",
  "UTC",
];

function toValues(org: {
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
}) {
  return {
    name: org.name,
    legalName: org.legalName,
    contactEmail: org.contactEmail,
    phone: org.phone,
    addressLine: org.addressLine,
    city: org.city,
    region: org.region,
    country: org.country,
    taxId: org.taxId,
    currency: org.currency,
    distanceUnit: org.distanceUnit,
    volumeUnit: org.volumeUnit,
    timeZone: org.timeZone,
  };
}

export default function SettingsPage() {
  const { workspace, org, role, members } = useWorkspace();
  const updateOrg = useMutation(api.fleet.updateOrganization);
  const addMember = useMutation(api.fleet.addMember);
  const updateRole = useMutation(api.fleet.updateMemberRole);
  const removeMemberM = useMutation(api.fleet.removeMember);
  const clearData = useMutation(api.fleet.clearFleetData);

  const [values, setValues] = useState(() => (org ? toValues(org) : null));
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dispatcher");
  const [inviting, setInviting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const canManage = canManageCompany(role);

  // Keep the form in step if the workspace loads after mount.
  if (org && values === null) {
    setValues(toValues(org));
  }

  if (!org || !values) {
    return (
      <AppShell>
        {workspace === undefined ? (
          <LoadingNote label="Opening company settings…" />
        ) : (
          <EmptyNote
            icon={Building2}
            title="No company yet"
            description="Create your company profile first — then team management and data controls appear here."
            action={
              <Button asChild>
                <a href="/setup">Start setup</a>
              </Button>
            }
          />
        )}
      </AppShell>
    );
  }

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) =>
      current ? { ...current, [key]: event.target.value } : current,
    );

  async function saveOrg(event: React.FormEvent) {
    event.preventDefault();
    setSavingOrg(true);
    try {
      await updateOrg({
        name: values!.name,
        legalName: values!.legalName || undefined,
        contactEmail: values!.contactEmail || undefined,
        phone: values!.phone || undefined,
        addressLine: values!.addressLine || undefined,
        city: values!.city || undefined,
        region: values!.region || undefined,
        country: values!.country || undefined,
        taxId: values!.taxId || undefined,
        currency: values!.currency,
        distanceUnit: values!.distanceUnit as "mi" | "km",
        volumeUnit: values!.volumeUnit as "gal" | "l",
        timeZone: values!.timeZone,
      });
      toast.success("Company settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingOrg(false);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    try {
      await addMember({ email: inviteEmail.trim(), role: inviteRole as never });
      toast.success(`Invitation recorded for ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(membership: WorkspaceMember, nextRole: string) {
    try {
      await updateRole({
        membershipId: membership.membershipId as never,
        role: nextRole as never,
      });
      toast.success(`${membership.name} is now ${labelFrom(ORG_ROLE_LABELS, nextRole)}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeTeamMember(membership: WorkspaceMember) {
    try {
      await removeMemberM({ membershipId: membership.membershipId as never });
      toast.success(`${membership.name} removed from the workspace`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function clearRegister() {
    setClearing(true);
    try {
      const result = await clearData({});
      toast.success(
        `Cleared ${result.vehicles} vehicles and ${result.drivers} drivers`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Company administration"
          title="Settings"
          description="Company identity, measurement units, your team and their roles, and the data controls for this workspace."
        />

        <form onSubmit={saveOrg} className="contents">
          <PaperPanel className="p-5">
            <SectionHeading icon={Building2} hint="visible across the workspace">
              Company profile
            </SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="org-name">Company name</Label>
                <Input
                  id="org-name"
                  value={values.name}
                  onChange={set("name")}
                  required
                  className="paper mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-legal">Legal name</Label>
                <Input
                  id="org-legal"
                  value={values.legalName}
                  onChange={set("legalName")}
                  placeholder="Registered entity name"
                  className="paper mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-tax">Tax ID / EIN</Label>
                <Input
                  id="org-tax"
                  value={values.taxId}
                  onChange={set("taxId")}
                  className="paper mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="org-email">Contact email</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={values.contactEmail}
                  onChange={set("contactEmail")}
                  className="paper mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  value={values.phone}
                  onChange={set("phone")}
                  className="paper mt-1.5 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="org-address">Address</Label>
                <Input
                  id="org-address"
                  value={values.addressLine}
                  onChange={set("addressLine")}
                  className="paper mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-city">City</Label>
                <Input id="org-city" value={values.city} onChange={set("city")} className="paper mt-1.5" />
              </div>
              <div>
                <Label htmlFor="org-region">State / region</Label>
                <Input
                  id="org-region"
                  value={values.region}
                  onChange={set("region")}
                  className="paper mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-country">Country</Label>
                <Input
                  id="org-country"
                  value={values.country}
                  onChange={set("country")}
                  className="paper mt-1.5"
                />
              </div>
            </div>
          </PaperPanel>

          <PaperPanel className="mt-5 p-5">
            <SectionHeading icon={Settings2} hint="used for every display and conversion">
              Units &amp; locale
            </SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="org-currency">Currency</Label>
                <Input
                  id="org-currency"
                  value={values.currency}
                  onChange={set("currency")}
                  maxLength={3}
                  className="paper mt-1.5 font-mono uppercase"
                />
              </div>
              <div>
                <Label>Distance unit</Label>
                <Select
                  value={values.distanceUnit}
                  onValueChange={(v) =>
                    setValues((current) => (current ? { ...current, distanceUnit: v } : current))
                  }
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper">
                    {DISTANCE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "mi" ? "Miles" : "Kilometres"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Volume unit</Label>
                <Select
                  value={values.volumeUnit}
                  onValueChange={(v) =>
                    setValues((current) => (current ? { ...current, volumeUnit: v } : current))
                  }
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper">
                    {VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit === "gal" ? "Gallons" : "Litres"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time zone</Label>
                <Select
                  value={values.timeZone}
                  onValueChange={(v) =>
                    setValues((current) => (current ? { ...current, timeZone: v } : current))
                  }
                >
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper max-h-72">
                    {TIME_ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {canManage ? (
              <div className="mt-5 flex items-center gap-3 border-t border-dashed border-border/70 pt-4">
                <Button type="submit" disabled={savingOrg} className="gap-2">
                  {savingOrg ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Save company settings
                </Button>
                <p className="text-xs text-muted-foreground">
                  Only the owner and administrators can change these.
                </p>
              </div>
            ) : (
              <p className="mt-4 border-t border-dashed border-border/70 pt-4 text-xs text-muted-foreground">
                Your role ({labelFrom(ORG_ROLE_LABELS, role ?? "viewer")}) is read-only for company
                settings.
              </p>
            )}
          </PaperPanel>
        </form>

        <PaperPanel className="p-5">
          <SectionHeading icon={Users} hint={`${members.length} members`}>
            Team &amp; roles
          </SectionHeading>
          {canManage ? (
            <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="invite-email">Add a team member</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="colleague@yourcompany.com"
                  required
                  className="paper mt-1.5"
                />
              </div>
              <div className="w-52">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="paper mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="paper">
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={inviting} className="gap-2">
                {inviting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="size-4" aria-hidden="true" />
                )}
                Add to workspace
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                The person must have signed in to Fleet Command at least once with this email
                address. Roles decide who can edit registers, manage the team and see finance data.
              </p>
            </form>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage ? <TableHead className="w-16" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isSelf = member.userId === workspace?.user.id;
                  const isOwner = member.role === "owner";
                  return (
                    <TableRow key={member.membershipId}>
                      <TableCell>
                        <span className="block text-sm font-medium text-ink">
                          {member.name}
                          {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">{member.email}</span>
                      </TableCell>
                      <TableCell>
                        {isOwner || isSelf || !canManage ? (
                          <Stamp tone={isOwner ? "info" : "neutral"} rotate={false}>
                            {labelFrom(ORG_ROLE_LABELS, member.role)}
                          </Stamp>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(value) => changeRole(member, value)}
                          >
                            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Change role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="paper">
                              {ROLE_OPTIONS.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(member.joinedAt)}
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          {!isOwner && !isSelf ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-stamp-bad"
                                  aria-label={`Remove ${member.name}`}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="paper">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They lose access to this workspace immediately. Their fleet
                                    records stay in place.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeTeamMember(member)}>
                                    Remove member
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </PaperPanel>

        {canManage ? (
          <PaperPanel className="p-5">
            <SectionHeading icon={ShieldCheck} hint="owner and admin only">
              Data controls
            </SectionHeading>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl text-sm text-muted-foreground">
                <p>
                  Clearing removes every vehicle, driver and log book entry from this workspace.
                  Company settings and team memberships are kept. Use it to reset the register
                  before a real deployment or after demoing with sample data.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-stamp-bad" disabled={clearing}>
                    {clearing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                    Clear fleet data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="paper">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear the entire register?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every vehicle, driver and log book entry in {org.name} will be deleted. This
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my data</AlertDialogCancel>
                    <AlertDialogAction onClick={clearRegister}>
                      Yes, clear everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </PaperPanel>
        ) : null}

        <StickyNote rotate="0.6deg">
          <p className="font-hand text-xl">Tenant isolation</p>
          <p className="mt-1 text-sm leading-6">
            Every record in this workspace is bound to {org.name} on the server. Users from other
            companies cannot query, list or even guess their way into your data — every query and
            mutation re-checks membership before returning anything.
          </p>
        </StickyNote>
      </div>
    </AppShell>
  );
}
