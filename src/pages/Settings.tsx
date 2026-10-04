import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { LogbookPanel } from "@/components/logbook-panel";
import { DiagnosticsPanel, ExportPanel } from "@/components/data-tools";
import {
  EmptyNote,
  LoadingNote,
  PageHeader,
  PaperPanel,
  SectionHeading,
  Stamp,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DISTANCE_UNITS, VOLUME_UNITS } from "@/convex/constants";
import {
  canManageCompany,
  canManageTeam,
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
  BookText,
  Building2,
  Loader2,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

const ROLE_OPTIONS = Object.entries(ORG_ROLE_LABELS).filter(([value]) => value !== "owner");
const TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
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

const TAB_VALUES = ["empresa", "equipe", "logbook", "dados"] as const;

export default function SettingsPage() {
  const { workspace, org, role, members } = useWorkspace();
  const updateOrg = useMutation(api.team.updateOrganization);
  const addMember = useMutation(api.team.addMember);
  const updateRole = useMutation(api.team.updateMemberRole);
  const removeMemberM = useMutation(api.team.removeMember);
  const clearData = useMutation(api.fleet.clearFleetData);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "empresa";
  const tab = (TAB_VALUES as readonly string[]).includes(requestedTab) ? requestedTab : "empresa";

  const [values, setValues] = useState(() => (org ? toValues(org) : null));
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dispatcher");
  const [inviting, setInviting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const canManage = canManageCompany(role);
  // Equipe é função de propriedade: o servidor só aceita o proprietário.
  const canManageMembers = canManageTeam(role);

  // Mantém o formulário sincronizado se o espaço de trabalho carregar depois.
  if (org && values === null) {
    setValues(toValues(org));
  }

  if (!org || !values) {
    return (
      <AppShell>
        {workspace === undefined ? (
          <LoadingNote label="Abrindo as configurações da empresa…" />
        ) : (
          <EmptyNote
            icon={Building2}
            title="Nenhuma empresa ainda"
            description="Crie o perfil da empresa primeiro — depois a gestão de equipe e os controles de dados aparecem aqui."
            action={
              <Button asChild>
                <a href="/setup">Começar configuração</a>
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
      toast.success("Configurações da empresa salvas");
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
      toast.success(`Convite registrado para ${inviteEmail.trim()}`);
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
      toast.success(`${membership.name} agora é ${labelFrom(ORG_ROLE_LABELS, nextRole)}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeTeamMember(membership: WorkspaceMember) {
    try {
      await removeMemberM({ membershipId: membership.membershipId as never });
      toast.success(`${membership.name} removido do espaço de trabalho`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function clearRegister() {
    setClearing(true);
    try {
      const result = await clearData({});
      // O servidor agora apaga também manutenções e documentos (cascata), então
      // este resumo corresponde ao que realmente saiu do banco.
      const extras = result.maintenance + result.documents;
      toast.success(
        `${result.vehicles} veículos, ${result.drivers} motoristas e ${extras} registros de manutenção/documentos removidos`,
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
          eyebrow="Administração da empresa"
          title="Configurações"
          description="Identidade da empresa, unidades de medida, equipe e permissões, livro de registros e os controles de dados deste espaço de trabalho."
        />

        <Tabs
          value={tab}
          onValueChange={(next) => setSearchParams(next === "empresa" ? {} : { tab: next }, { replace: true })}
          className="gap-5"
        >
          <TabsList className="paper h-auto flex-wrap justify-start gap-1 rounded-lg border border-border p-1">
            <TabsTrigger value="empresa" className="gap-1.5">
              <Building2 className="size-3.5" aria-hidden="true" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="equipe" className="gap-1.5">
              <Users className="size-3.5" aria-hidden="true" /> Equipe e acessos
            </TabsTrigger>
            <TabsTrigger value="logbook" className="gap-1.5">
              <BookText className="size-3.5" aria-hidden="true" /> Livro de registros
            </TabsTrigger>
            <TabsTrigger value="dados" className="gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">
            <form onSubmit={saveOrg} className="contents">
              <PaperPanel className="p-5">
                <SectionHeading icon={Building2} hint="visível em todo o espaço de trabalho">
                  Perfil da empresa
                </SectionHeading>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="org-name">Nome da empresa</Label>
                    <Input
                      id="org-name"
                      value={values.name}
                      onChange={set("name")}
                      required
                      className="paper mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-legal">Razão social</Label>
                    <Input
                      id="org-legal"
                      value={values.legalName}
                      onChange={set("legalName")}
                      placeholder="Nome jurídico registrado"
                      className="paper mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-tax">CNPJ / documento fiscal</Label>
                    <Input
                      id="org-tax"
                      value={values.taxId}
                      onChange={set("taxId")}
                      className="paper mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-email">E-mail de contato</Label>
                    <Input
                      id="org-email"
                      type="email"
                      value={values.contactEmail}
                      onChange={set("contactEmail")}
                      className="paper mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-phone">Telefone</Label>
                    <Input
                      id="org-phone"
                      value={values.phone}
                      onChange={set("phone")}
                      className="paper mt-1.5 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="org-address">Endereço</Label>
                    <Input
                      id="org-address"
                      value={values.addressLine}
                      onChange={set("addressLine")}
                      className="paper mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-city">Cidade</Label>
                    <Input id="org-city" value={values.city} onChange={set("city")} className="paper mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="org-region">Estado / região</Label>
                    <Input
                      id="org-region"
                      value={values.region}
                      onChange={set("region")}
                      className="paper mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-country">País</Label>
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
                <SectionHeading icon={Settings2} hint="usados em todas as exibições e conversões">
                  Unidades &amp; localidade
                </SectionHeading>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="org-currency">Moeda</Label>
                    <Input
                      id="org-currency"
                      value={values.currency}
                      onChange={set("currency")}
                      maxLength={3}
                      className="paper mt-1.5 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <Label>Unidade de distância</Label>
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
                            {unit === "mi" ? "Milhas" : "Quilômetros"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Unidade de volume</Label>
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
                            {unit === "gal" ? "Galões" : "Litros"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fuso horário</Label>
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
                      Salvar configurações
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Somente proprietário e administradores podem alterar.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-dashed border-border/70 pt-4 text-xs text-muted-foreground">
                    Seu papel ({labelFrom(ORG_ROLE_LABELS, role ?? "viewer")}) é somente leitura para
                    configurações da empresa.
                  </p>
                )}
              </PaperPanel>
            </form>
          </TabsContent>

          <TabsContent value="equipe">
            <PaperPanel className="p-5">
              <SectionHeading icon={Users} hint={`${members.length} integrantes`}>
                Equipe &amp; permissões
              </SectionHeading>
              {canManageMembers ? (
                <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-56 flex-1">
                    <Label htmlFor="invite-email">Adicionar integrante</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="colega@suaempresa.com.br"
                      required
                      className="paper mt-1.5"
                    />
                  </div>
                  <div className="w-52">
                    <Label>Papel</Label>
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
                    Adicionar ao espaço
                  </Button>
                  <p className="w-full text-xs text-muted-foreground">
                    A pessoa precisa ter entrado no Fleet Command pelo menos uma vez com este e-mail.
                    Os papéis definem quem edita cadastros, gerencia a equipe e vê dados financeiros.
                  </p>
                </form>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Somente o proprietário da empresa adiciona integrantes ou altera papéis — assim
                  nenhum administrador pode conceder acesso de proprietário por conta própria.
                </p>
              )}

              <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableHead>Integrante</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Entrou em</TableHead>
                      {canManageMembers ? <TableHead className="w-16" /> : null}
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
                              {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(você)</span> : null}
                            </span>
                            <span className="block text-xs text-muted-foreground">{member.email}</span>
                          </TableCell>
                          <TableCell>
                            {isOwner || isSelf || !canManageMembers ? (
                              <Stamp tone={isOwner ? "info" : "neutral"} rotate={false}>
                                {labelFrom(ORG_ROLE_LABELS, member.role)}
                              </Stamp>
                            ) : (
                              <Select
                                value={member.role}
                                onValueChange={(value) => changeRole(member, value)}
                              >
                                <SelectTrigger className="h-8 w-44 text-xs" aria-label="Alterar papel">
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
                          {canManageMembers ? (
                            <TableCell>
                              {!isOwner && !isSelf ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-stamp-bad"
                                      aria-label={`Remover ${member.name}`}
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="paper">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover {member.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        A pessoa perde o acesso a este espaço de trabalho imediatamente.
                                        Os registros da frota permanecem intactos.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => removeTeamMember(member)}>
                                        Remover integrante
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
          </TabsContent>

          <TabsContent value="logbook">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Livro de registros</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Todo cadastro, edição, vinculação, mudança de status e atualização de equipe fica
                  escrito aqui — quem fez, o que mudou e quando.
                </p>
              </div>
              <LogbookPanel />
            </div>
          </TabsContent>

          <TabsContent value="dados">
            {canManage ? (
              <PaperPanel className="p-5">
                <SectionHeading icon={ShieldCheck} hint="somente proprietário e administrador">
                  Controles de dados
                </SectionHeading>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl text-sm text-muted-foreground">
                    <p>
                      Limpar remove todos os veículos, motoristas, manutenções, documentos e registros
                      do livro deste espaço de trabalho. As configurações da empresa e os integrantes
                      são mantidos. Use para zerar o cadastro antes de uma implantação real ou depois
                      de testar com dados de exemplo.
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
                        Limpar dados da frota
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="paper">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Limpar todo o cadastro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todos os veículos, motoristas, manutenções, documentos e registros do livro
                          de {org.name} serão excluídos. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter meus dados</AlertDialogCancel>
                        <AlertDialogAction onClick={clearRegister}>
                          Sim, limpar tudo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="mt-5 border-t border-dashed border-border/70 pt-4 text-sm leading-6 text-muted-foreground">
                  <p className="font-medium text-ink">Isolamento entre empresas</p>
                  <p className="mt-1">
                    Todo registro deste espaço de trabalho é vinculado a {org.name} no servidor.
                    Usuários de outras empresas não conseguem consultar, listar ou adivinhar os seus
                    dados — cada consulta e alteração revalida a associação antes de retornar algo.
                  </p>
                </div>
                <div className="mt-6 space-y-6 border-t border-dashed border-border/70 pt-6">
                  <ExportPanel />
                  <div className="border-t border-dashed border-border/70 pt-6">
                    <DiagnosticsPanel />
                  </div>
                </div>
              </PaperPanel>
            ) : (
              <EmptyNote
                icon={ShieldCheck}
                title="Acesso restrito"
                description="Somente proprietário e administradores podem gerenciar os controles de dados deste espaço de trabalho."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
