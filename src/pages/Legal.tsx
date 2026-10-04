import { motion } from "framer-motion";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

type Section = { title: string; body: string[] };

const UPDATED = "Última atualização: 28 de setembro de 2026";

const INTRO_TERMS =
  "Este Termo regula o uso do Fleet Command, plataforma de gestão de frota (veículos, motoristas, manutenções e documentos) oferecida a empresas. Ao criar uma conta ou convidar integrantes, você concorda com o que está descrito aqui.";

const SECTIONS_TERMS: Section[] = [
  {
    title: "Sobre o serviço",
    body: [
      "O Fleet Command é um sistema de registro e acompanhamento de frota: cadastro de veículos e motoristas, controle de manutenções, vencimento de documentos, indicadores e histórico de atividades.",
      "O serviço é prestado a empresas (pessoas jurídicas), que são responsáveis pelas contas, integrantes e dados cadastrados em seu espaço de trabalho.",
      "► O Fleet Command é uma ferramenta de organização interna e não substitui obrigações legais, fiscais ou regulatórias do contratante (por exemplo, licenciamento, seguro ou exigências trabalhistas).",
    ],
  },
  {
    title: "Contas e papéis",
    body: [
      "Cada empresa possui um espaço de trabalho próprio e isolado. Os registros de uma empresa nunca ficam visíveis para outra.",
      "A empresa é representada por uma conta de proprietário (owner), única detentora da administração plena: convidar e remover integrantes, alterar papéis e excluir dados.",
      "O proprietário é responsável por manter um administrador de confiança e pela guarda das credenciais de acesso da sua equipe.",
      "► O acesso é pessoal e intransferível. Compartilhar credenciais entre pessoas não autorizadas pode resultar na suspensão da conta.",
    ],
  },
  {
    title: "Responsabilidades do contratante",
    body: [
      "Fornecer informações verdadeiras sobre veículos, motoristas e documentos.",
      "Obter consentimento dos motoristas antes de cadastrar dados pessoais deles no sistema (nome, contato, CNH, entre outros), conforme a LGPD.",
      "Manter a confidencialidade das informações registradas e o uso restrito a finalidades legítimas da operação.",
      "► Você declara ser responsável legal pelos dados que insere no sistema e confirma que os titulares (por exemplo, motoristas) foram informados sobre esse tratamento.",
    ],
  },
  {
    title: "Uso aceitável",
    body: [
      "É proibido usar o serviço para atividades ilícitas, cadastrar dados falsos, tentar acessar espaços de outras empresas, interferir na infraestrutura ou realizar engenharia reversa com o objetivo de replicar o serviço.",
      "► Medidas técnicas de isolamento por empresa e auditoria de acessos estão em vigor; tentativas de acesso indevido podem ser bloqueadas e registradas.",
    ],
  },
  {
    title: "Disponibilidade e suporte",
    body: [
      "Buscamos manter o serviço disponível de forma contínua, mas interrupções para manutenção ou fatores fora do nosso controle podem ocorrer.",
      "Recomendamos exportar ou manter cópias dos documentos críticos fora do sistema (o Fleet Command não é repositório oficial de documentos veiculares).",
    ],
  },
  {
    title: "Propriedade e dados",
    body: [
      "Os dados inseridos pertencem à empresa contratante. A plataforma fornece as ferramentas de registro, exibição e exclusão desses dados.",
      "A exclusão de um veículo ou motorista remove seus registros associados de forma definitiva; a ação de limpeza completa do espaço apaga todos os dados da empresa e não pode ser desfeita.",
    ],
  },
  {
    title: "Encerramento",
    body: [
      "A empresa pode encerrar o uso a qualquer momento, solicitando a exclusão definitiva do seu espaço e dos dados associados.",
      "Podemos suspender contas em caso de violação destes termos, uso abusivo ou risco a outros clientes, mediante aviso prévio quando possível.",
    ],
  },
  {
    title: "Alterações e foro",
    body: [
      "Estes termos podem ser atualizados; mudanças relevantes serão comunicadas dentro do próprio sistema.",
      "Aplica-se a legislação brasileira e, para questões que exijam foro, o foro do domicílio do contratante.",
    ],
  },
];

const INTRO_PRIVACY =
  "Esta política explica, em linguagem direta, como o Fleet Command trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Para fins de LGPD, a empresa contratante (seu espaço de trabalho) atua como controladora dos dados de seus motoristas e integrantes; o Fleet Command atua como operador, tratando dados apenas conforme instruções do serviço.";

const SECTIONS_PRIVACY: Section[] = [
  {
    title: "Quais dados tratamos",
    body: [
      "Conta de acesso: nome, e-mail (usado para o código de login) e telefone, quando informado.",
      "Dados cadastrais da empresa: nome, moeda, unidade de distância e preferências do espaço.",
      "Dados de motoristas inseridos pela empresa: nome, contato, e-mail, CNH (número, categoria e validade) e situação.",
      "Dados de operação: veículos, manutenções, documentos e histórico de atividades (quem criou ou alterou registros).",
    ],
  },
  {
    title: "Para que usamos (finalidades)",
    body: [
      "Autenticar o acesso e proteger contas, incluindo envio do código de verificação por e-mail.",
      "Operar as funcionalidades do sistema: painel, alertas de vencimento, prontuários e histórico.",
      "Auditar ações dentro do espaço de trabalho (livro de registros) para rastreabilidade interna.",
      "► Não usamos seus dados para publicidade e não vendemos dados pessoais a terceiros.",
    ],
  },
  {
    title: "Base legal",
    body: [
      "O tratamento se apoia na execução de contrato (art. 7º, V — prestar o serviço contratado), no legítimo interesse para segurança da plataforma (art. 7º, IX) e na obrigação de cumprir a lei quando aplicável.",
      "Quando a empresa cadastra dados de motoristas, ela deve ter base legal para isso — em regra, o consentimento do titular ou a execução de políticas internas próprias.",
    ],
  },
  {
    title: "Quem pode ver os dados",
    body: [
      "O isolamento é por empresa: integrantes só acessam o espaço da própria organização.",
      "Dados sensíveis de remuneração (valor por dia) são visíveis apenas a papéis autorizados pela empresa (proprietário, administrador, gestor de frota e financeiro).",
      "Integrantes com papel de motorista veem apenas o próprio prontuário completo; dados de contato e CNH de colegas ficam ocultos.",
      "Nenhum acesso indevido entre empresas é possível por construção: todas as consultas verificam a organização do usuário autenticado.",
    ],
  },
  {
    title: "Compartilhamento e segurança",
    body: [
      "Compartilhamos o mínimo necessário com provedores de infraestrutura (banco de dados na nuvem Convex e serviço de envio de e-mail para códigos de login), sempre protegidos por contrato e chaves de acesso.",
      "Medidas de segurança: transporte criptografado (HTTPS), segredos gerenciados em ambiente, rate limit no fluxo de login, isolamento por organização e auditoria de alterações.",
      "► Nenhum sistema é infalível; mantemos práticas de mitigação e resposta a incidentes proporcional ao risco.",
    ],
  },
  {
    title: "Retenção e exclusão",
    body: [
      "Os dados permanecem enquanto a empresa usar o serviço. A exclusão de veículos, motoristas e documentos remove os registros associados de forma definitiva.",
      "Contas de convidados criadas há mais de 7 dias que nunca se vinculam a uma empresa são removidas automaticamente, junto com suas sessões.",
      "A empresa pode solicitar a exclusão completa do seu espaço a qualquer momento; a operação apaga todos os dados e é irreversível.",
    ],
  },
  {
    title: "Direitos dos titulares",
    body: [
      "Titulares de dados (por exemplo, motoristas) podem solicitar à empresa contratante: confirmação de tratamento, acesso, correção, portabilidade, anonimização ou eliminação de dados desnecessários e informação sobre compartilhamentos.",
      "► O canal para exercer direitos é a empresa que registrou os dados (controladora). O Fleet Command apoia o atendimento oferecendo exportação e exclusão dos registros.",
    ],
  },
  {
    title: "Controladora e encarregado",
    body: [
      "► Preencha os dados abaixo antes de usar esta política comercialmente. O art. 41 da LGPD exige um encarregado (DPO) nomeado, com canal de contato publicado.",
      "Controladora: [RAZÃO SOCIAL DA EMPRESA], inscrita no CNPJ sob nº [CNPJ], com sede na [ENDEREÇO COMPLETO]. É a empresa que contrata o Fleet Command e decide sobre os dados dos seus motoristas.",
      "Encarregado pelo tratamento de dados (DPO): [NOME DO ENCARREGADO] — [E-MAIL DO DPO] — [TELEFONE/ENDEREÇO].",
      "Operador: o Fleet Command, que trata os dados estritamente conforme as instruções da controladora e para executar o serviço contratado.",
    ],
  },
  {
    title: "Contato",
    body: [
      "Dúvidas sobre esta política, solicitações de exclusão ou relatos de incidentes podem ser feitos pelo e-mail de contato informado no rodapé do sistema ou pelo canal de suporte da plataforma.",
    ],
  },
];

function DocShell({
  eyebrow,
  title,
  intro,
  sections,
  icon,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen px-4 py-10 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao início
        </Link>

        <header className="note-edge mt-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              {icon}
            </span>
            <span className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {eyebrow}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{intro}</p>
          <p className="mt-4 font-mono text-xs text-muted-foreground">{UPDATED}</p>
        </header>

        <div className="mt-6 space-y-4">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="paper note-edge rounded-xl border border-border p-5 sm:p-6"
            >
              <h2 className="flex items-baseline gap-2.5 text-base font-semibold text-ink">
                <span className="font-mono text-sm text-pen">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-2.5">
                {section.body.map((paragraph, pIndex) => (
                  <p
                    key={pIndex}
                    className={cn(
                      "text-sm leading-6",
                      paragraph.startsWith("►")
                        ? "sticky-note rounded-md px-3 py-2 font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Precisa do outro documento? Veja também:
          </p>
          <div className="flex gap-3 text-sm">
            <Link to="/termos" className="font-medium text-pen hover:underline">
              Termo de Uso
            </Link>
            <Link to="/privacidade" className="font-medium text-pen hover:underline">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TermsPage() {
  return (
    <DocShell
      eyebrow="Instrumento contratual"
      title="Termo de Uso"
      intro={INTRO_TERMS}
      sections={SECTIONS_TERMS}
      icon={<FileText className="size-5" aria-hidden="true" />}
    />
  );
}

export function PrivacyPage() {
  return (
    <DocShell
      eyebrow="Privacidade · LGPD"
      title="Política de Privacidade"
      intro={INTRO_PRIVACY}
      sections={SECTIONS_PRIVACY}
      icon={<ShieldCheck className="size-5" aria-hidden="true" />}
    />
  );
}
