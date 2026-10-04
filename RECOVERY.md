# Plano de recuperação — Fleet Command

Documento operacional para o dia em que algo der errado: app fora do ar, deploy
que quebrou, erro em produção ou pedido de exclusão de dados (LGPD).

## Papéis

| Papel | Responsabilidade |
|---|---|
| Proprietário da empresa | Decide sobre dados da própria empresa; é quem solicita exclusão e exportação |
| Administrador | Opera a empresa; vê diagnóstico de erros e livro de registros |
| Operador da plataforma (você) | Responder por incidentes técnicos, deploys e restauração |

## 1. App fora do ar / erro em produção

**Sintoma:** página não carrega, erro do Convex ("Could not find public path",
"Internal Server Error") ou fonctionnalité quebrada.

**Diagnóstico (5 min):**

1. Abrir **Configurações › Dados › Diagnóstico de erros** — a lista mostra a
   mensagem, a origem e a hora do último erro capturado.
2. Rodar localmente o health check:
   ```bash
   bunx convex dev --once   # confirma que o backend sobe e o schema está íntegro
   bunx tsc -b --noEmit     # confirma que o frontend está consistente
   bun run test             # confirma as regras de segurança (24 testes: autorização,
                            # cotas de uso e isolamento entre empresas)
   ```

**Se o backend responde e o frontend falha:** o problema é no código do
frontend — reverta o último deploy.

**Reverter um deploy:**

```bash
# O histórico fica no histórico de commits; reverter é um commit novo.
# Grave o código em que o app funcionava:
git revert <commit-do-deploy-que-quebrou>   # ou:
git checkout <commit-bom> -- src/            # copia só o frontend
```

Depois: `bunx convex dev --once && bunx tsc -b --noEmit` e testar o login.

**Se o Convex (plataforma) estiver instável:** não há ação do nosso lado — o
backend é gerenciado por ele. Converse com o suporte da plataforma.

## 2. Exclusão de dados (pedido de titular — LGPD)

**Prazo legal: responder em até 15 dias.**

O titular pede para a **empresa controladora** (o cliente), que aciona a
plataforma. Caminhos possíveis:

- **Exclusão só de um cadastro:** o Proprietário deleta o veículo/motorista em
  Fleet Command; a exclusão é em cascata (veículo leva manutenções e documentos).
- **Exporta antes:** Configurações › Dados › **Exportar dados** baixa os CSVs.
  Exija o export **antes** de qualquer limpeza — sem o CSV, o dado vai embora.
- **Exclusão total do espaço:** Configurações › Dados › *Limpar dados da frota*
  (remove veículos, motoristas, manutenções, documentos e livro de registros;
  mantém empresa e integrantes). Irreversível.
- **Exclusão da conta inteira / encerramento:** abrir chamado com a plataforma.

> O backup do banco é do Convex. O backup **do cliente** é o CSV — por isso a
> exportação precisa ser rotineira, não uma medida de emergência.

## 3. Restauração a partir do CSV

Não há importador automático hoje. Se um cliente precisar reimportar após um
incidente, o caminho é:

1. O Proprietário exporta (antes da limpeza) ou usa o CSV guardado.
2. A reimportação hoje é **manual** (cadastro por tela) — não automatizado.
   Para volumes grandes, combine com o cliente caso a caso.

## 4. Prevenção (o que já está no lugar)

| Medida | Onde |
|---|---|
| Isolamento por empresa em toda query | `src/convex/fleet.ts` (`requireOrg`) |
| Segredos só em ambiente | `emailOtp.ts` lê `process.env`, sem literal |
| Poda de convidados abandonados (24 h) | `housekeeping.ts` + `crons.ts` |
| Exportação de dados pelo cliente | `src/convex/export.ts` |
| Captura de erros | `src/convex/errors.ts` + hook no cliente |
| Testes das regras de autorização | `src/convex/access.test.ts` (`bun run test`) |
| Teste de isolamento entre empresas (executa as functions reais) | `src/tests/tenant-isolation.test.ts` |
| Testes das cotas de uso | `src/convex/rateLimit.test.ts` |

## 5. O que NÃO temos (honesto)

- **Sem importador de backup** — a restauração é manual.
- **Sem monitoramento externo** — o diagnóstico é interno ao app; se o app
  inteiro não carrega, não há como ver a lista.
- **Sem teste de carga** — validado por leitura de índices, não por medição.
- **Sem plano de continuidade testado** em ambiente de homologação.