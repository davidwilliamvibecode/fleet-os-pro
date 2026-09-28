import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookText,
  CheckCircle2,
  FileText,
  Gauge,
  IdCard,
  Route,
  ShieldCheck,
  Truck,
  Users,
  Waypoints,
  Wrench,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const MODULES = [
  {
    icon: Truck,
    title: "Cadastro da frota",
    body: "Cada unidade em uma só tela: identificação, quilometragem, propriedade, seguro e datas de licenciamento — acompanhadas para você.",
  },
  {
    icon: IdCard,
    title: "Motoristas e vínculos",
    body: "CNH, exames, modelo de remuneração e o veículo de cada motorista. Vincule uma vez e os dois cadastros ficam em sincronia.",
  },
  {
    icon: Wrench,
    title: "Manutenção por veículo",
    body: "Serviços realizados, peças trocadas, valores, quilometragem, oficina e local — com alerta de próxima revisão.",
  },
  {
    icon: FileText,
    title: "Documentos e impostos",
    body: "IPVA, licenciamento, seguro, DPVAT, inspeção e ANTT com valor, vencimento e situação. Nada vence sem aviso.",
  },
  {
    icon: AlertTriangle,
    title: "Central de alertas",
    body: "Vencimentos de documentos, manutenções e exames viram uma lista única de pendências com grau de urgência.",
  },
  {
    icon: BookText,
    title: "Livro de registros",
    body: "Trilha de auditoria permanente: quem criou, quem alterou, o que mudou e quando. Acessível nas Configurações.",
  },
  {
    icon: Users,
    title: "Papéis que cabem no pátio",
    body: "Proprietário, administrador, gestor, despachante, manutenção, financeiro, motorista e leitor — validado no servidor, não só escondido na tela.",
  },
  {
    icon: Gauge,
    title: "Painel de comando",
    body: "Utilização, valor da frota, depreciação e a lista de pendências prontas antes do primeiro café.",
  },
  {
    icon: Route,
    title: "Uma base só",
    body: "Sem planilhas paralelas, sem digitação duplicada e sem versões conflitantes dos mesmos dados.",
  },
];

const STEPS = [
  {
    title: "Crie sua empresa",
    body: "Um espaço por empresa, com sua moeda, unidades de medida e fuso horário.",
  },
  {
    title: "Cadastre veículos e motoristas",
    body: "Registre unidades, monte a escala e vincule os dois — um só campo mantém os prontuários alinhados.",
  },
  {
    title: "Deixe os alertas trabalharem",
    body: "O Fleet Command vigia vencimentos e intervalos de quilometragem e avisa semanas antes.",
  },
];

const METRICS = [
  { value: "8", label: "papéis de acesso" },
  { value: "100%", label: "isolado por empresa" },
  { value: "1", label: "base de dados" },
  { value: "24/7", label: "alertas de vencimento" },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Waypoints className="size-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">
                Fleet Command
              </span>
              <span className="block text-[0.7rem] text-muted-foreground">
                sistema de gestão de frota
              </span>
            </span>
          </div>
          <nav
            aria-label="Navegação do site"
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          >
            <a href="#modulos" className="transition-colors hover:text-ink">
              Módulos
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-ink">
              Como funciona
            </a>
            <a href="#seguranca" className="transition-colors hover:text-ink">
              Segurança
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth?returnTo=%2Fdashboard">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/auth?returnTo=%2Fsetup">
                Começar grátis <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(48rem 24rem at 8% -10%, rgba(29,78,216,0.16), transparent 60%), radial-gradient(40rem 22rem at 92% 4%, rgba(4,120,87,0.12), transparent 58%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--rule) 1px, transparent 1px), linear-gradient(to bottom, var(--rule) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(60% 55% at 50% 25%, black, transparent 80%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-stamp-ok" aria-hidden="true" />
              Centralize frota, motoristas, manutenção e documentos
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              O sistema operacional da sua frota, em um só lugar.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              O Fleet Command reúne veículos, motoristas, manutenções, documentos, impostos e
              vencimentos em um espaço privado da sua empresa. Cadastre uma vez — o cadastro, o
              painel e o livro de registros permanecem em sincronia.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth?returnTo=%2Fsetup">
                  Criar minha empresa <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?returnTo=%2Fdashboard">Entrar na minha frota</Link>
              </Button>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                "Sem planilhas",
                "Dados isolados por empresa",
                "Acesso por papéis",
                "Trilha de auditoria completa",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-stamp-ok" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Prévia do painel */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="note-edge rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Painel da frota
              </p>
              <span className="rounded-full bg-stamp-ok/10 px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-wide text-stamp-ok uppercase">
                em ordem
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { label: "Unidades", value: "24" },
                { label: "Motoristas", value: "19" },
                { label: "Em manutenção", value: "3" },
                { label: "Pendências", value: "7" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <p className="text-[0.68rem] tracking-wide text-muted-foreground uppercase">
                    {kpi.label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold text-ink">{kpi.value}</p>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {[
                { unit: "101", name: "Volvo FH 540", status: "Vinculado", tone: "text-stamp-ok" },
                { unit: "102", name: "Scania R450", status: "Vinculado", tone: "text-stamp-ok" },
                { unit: "103", name: "Mercedes Actros", status: "Em manutenção", tone: "text-stamp-warn" },
                { unit: "106", name: "Iveco S-Way", status: "Fora de operação", tone: "text-stamp-bad" },
              ].map((row) => (
                <li
                  key={row.unit}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
                >
                  <span className="font-mono font-semibold text-ink">{row.unit}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.name}</span>
                  <span className={`font-mono text-xs ${row.tone}`}>{row.status}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 text-stamp-warn" aria-hidden="true" />
              3 documentos precisam de atenção · 2 vencem em até 45 dias
            </div>
          </motion.div>
        </div>
      </section>

      {/* Métricas */}
      <section className="border-b border-border/70 bg-sidebar/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {METRICS.map((metric) => (
            <div key={metric.label}>
              <p className="font-mono text-2xl font-semibold text-ink">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.14em] text-pen uppercase">
            Um sistema, não doze abas
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Tudo o que a operação precisa
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Os módulos compartilham a mesma base — ao vincular um motorista, o veículo, a escala e o
            livro de registros se atualizam no mesmo instante. Sem digitação duplicada, sem versões
            divergentes.
          </p>
        </motion.div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, index) => (
            <motion.article
              key={module.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: index * 0.04 }}
              className="note-edge group rounded-xl border border-border/80 bg-card p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-pen transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <module.icon className="size-4" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 text-base font-semibold text-ink">{module.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{module.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-y border-border/70 bg-sidebar/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.14em] text-pen uppercase">
              Do zero à frota rodando
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Três passos e o sistema trabalha sozinho
            </h2>
          </motion.div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.07 }}
                className="note-edge relative rounded-xl border border-border/80 bg-card p-5"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  passo {index + 1}
                </span>
                <h3 className="mt-1.5 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </motion.li>
            ))}
          </ol>
          <motion.div {...fadeUp} className="mt-8">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth?returnTo=%2Fsetup">
                Começar minha configuração <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Segurança */}
      <section id="seguranca" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <motion.div {...fadeUp}>
            <p className="text-sm font-semibold tracking-[0.14em] text-pen uppercase">
              Feito para empresas, não para hobbies
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Privado por padrão
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                {
                  title: "Dados por empresa",
                  body: "Todo registro carrega o identificador da sua empresa e cada consulta reconfere o vínculo no servidor antes de devolver qualquer linha.",
                },
                {
                  title: "Oito papéis, validados duas vezes",
                  body: "A interface esconde o que o papel não pode fazer e o banco recusa o que a interface deixar passar.",
                },
                {
                  title: "Trilha de auditoria pronta para o contador",
                  body: "Quem alterou a data do seguro, quem trocou o motorista de veículo, quem registrou a manutenção — com data e hora.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-stamp-ok" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            {...fadeUp}
            className="note-edge rounded-xl border border-border bg-card p-6 text-sm"
          >
            <p className="text-xs font-semibold tracking-[0.08em] text-pen uppercase">
              Do painel, uma segunda-feira
            </p>
            <p className="mt-3 leading-6 text-muted-foreground">
              “Utilização em 78%. O seguro da unidade 106 venceu há 9 dias. Duas CNHs vencem nas
              próximas três semanas. Três manutenções agendadas.”
            </p>
            <p className="mt-3 leading-6 text-muted-foreground">
              Esse é o seu início de semana antes do primeiro café — não uma conciliação mensal de
              planilhas.
            </p>
            <p className="mt-4 border-t border-border/70 pt-4 text-sm font-medium text-ink">
              O Fleet Command vigia os prazos para o escritório cuidar da estrada.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/70 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Sua frota em uma só tela, a partir de hoje.
          </h2>
          <p className="max-w-xl text-base leading-7 text-primary-foreground/85">
            Crie o espaço da sua empresa, cadastre a primeira unidade e deixe o Fleet Command cuidar
            da papelada. Inclui frota de exemplo, se preferir explorar antes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/auth?returnTo=%2Fsetup">
                Criar minha empresa <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/auth?returnTo=%2Fdashboard">Entrar</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2">
            <Waypoints className="size-4 text-pen" aria-hidden="true" />
            <span>Fleet Command · sistema de gestão de frota</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <Link to="/termos" className="transition-colors hover:text-ink">
              Termos de uso
            </Link>
            <Link to="/privacidade" className="transition-colors hover:text-ink">
              Privacidade
            </Link>
            <span>v1 · veículos, motoristas, manutenção e documentos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
