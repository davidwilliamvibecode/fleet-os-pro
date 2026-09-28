import type { OrgRole } from "./constants";

/**
 * Quem pode ver os dados pessoais de um motorista.
 *
 * Um integrante com papel `driver` enxerga o próprio prontuário em detalhe —
 * reconhecido pelo e-mail que ele usa para entrar — e, dos colegas, apenas o
 * que é operacional (nome, unidade e situação). Telefone, endereço, contato de
 * emergência, CNH e remuneração de terceiros são dados pessoais e ficam fora
 * (LGPD): o papel de motorista no Fleet Command não é um RH.
 *
 * Sem e-mail cadastrado no prontuário, ninguém é reconhecido como "eu" — o
 * padrão é negar.
 *
 * Fica neste módulo (e não em `fleet.ts`) para `fleet`, `drivers` e `logbook`
 * compartilharem a mesma regra sem criar import circular entre eles.
 */
export function canSeeDriverPersonalData(
  role: OrgRole,
  driverEmail: string | undefined,
  callerEmail: string,
) {
  if (role !== "driver") return true;
  // Sem e-mail nos dois lados não há como reconhecer "eu": negar. Isso também
  // evita que um convidado sem e-mail (string vazia) case com um prontuário
  // que também esteja sem e-mail.
  const driver = driverEmail?.trim().toLowerCase();
  const caller = callerEmail?.trim().toLowerCase();
  if (!driver || !caller) return false;
  return driver === caller;
}
