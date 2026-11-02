# Fleet OS Pro

Gestão de veículos, motoristas, manutenções, documentos e vencimentos para pequenas frotas. React + TypeScript + Vite, com autenticação e persistência no Convex e interface no Cloudflare Pages.

## Uma versão

- Código: branch `main` deste repositório.
- Convex: projeto `fleet-os-pro`, deployment `mellow-tapir-783` (único deployment ativo; o rótulo técnico `dev/david-william` é do Convex).
- Endereço pretendido: `https://fleet-os-pro.pages.dev` — a existência e disponibilidade deste endereço só se confirmam após o deploy no Cloudflare.
- Não são necessários domínio próprio, gateway de pagamento ou serviço de e-mail para usar o MVP.

## Executar

Node.js 22 ou superior:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

O frontend depende das funções implantadas no deployment configurado. `npm run check` executa lint, testes e build; os testes usam banco em memória e não alteram dados de clientes. Os arquivos `_generated` estão versionados para a CI funcionar sem credenciais do Convex.

## Implantação

1. Usar somente o projeto Convex já criado. Configurar no backend `SITE_URL`, `JWT_PRIVATE_KEY` e `JWKS` (par de chaves exclusivo deste sistema). `CONVEX_SITE_URL` é fornecida pelo próprio Convex; não usar a URL do Pages nesse campo.
2. Conectar este repositório ao Cloudflare Pages, branch `main`, saída `dist`, Node.js 22.
3. Variável pública no build: `VITE_CONVEX_URL=https://mellow-tapir-783.convex.cloud`.
4. Segredo de build: `CONVEX_DEPLOY_KEY`, restrito a esse deployment. Nunca adicionar a chave ao repositório ou usar prefixo `VITE_`.
5. Comando de build: `npm run lint && npm test && npx convex deploy --cmd 'npm run build'`.
6. Abrir o endereço emitido pelo Pages e validar cadastro, login, cadastro de veículo e exportação. O workflow GitHub Actions valida cada alteração na `main`; a publicação fica a cargo da integração Git do Pages, sem duplicar ambientes.

## Primeiro cliente

1. O proprietário cria conta com e-mail e senha de pelo menos 8 caracteres e aceita os termos e a política de privacidade.
2. Cria a empresa e cadastra o primeiro veículo e motorista. Dados de exemplo são opcionais e só podem ser carregados em um cadastro vazio.
3. Para funcionários: a pessoa cria a própria conta, compartilha seu identificador da tela inicial diretamente com o proprietário e aguarda a liberação em Configurações → Equipe. O identificador não é senha e não é exigido para entrar; serve para o proprietário conferir a conta que receberá acesso. Não se confia apenas em um e-mail não verificado.
4. Acesso a prontuário de motorista é vinculado à conta admitida pelo proprietário. O e-mail do funcionário deve corresponder ao e-mail do cadastro do motorista.
5. Fazer exportação em Configurações → Dados. CSV UTF-8, separador `;`, protegido contra interpretação de campos como fórmulas.

Dados ficam no Convex. Limpar cache ou trocar de computador não apaga os registros. É preciso entrar novamente com a mesma conta.

## Limites conhecidos

- Recuperação de senha é assistida: confirmar a identidade por um canal já conhecido e usar procedimento administrativo; não há envio automático de recuperação.
- CSV é uma cópia para consulta e reconstrução manual, não uma restauração automática. Ver [RECOVERY.md](RECOVERY.md).
- O MVP lê até 500 registros por tipo nas telas operacionais; não prometer uso ilimitado. Exportação consulta todos os registros da empresa, sujeita aos limites técnicos do Convex.
- Antes de receber dados reais, informar ao cliente a identificação do fornecedor e canal de suporte na contratação. Não há dados comerciais inventados na aplicação.
- Infraestrutura usa os planos gratuitos existentes, dentro das suas cotas; não ativar upgrades pagos automaticamente.

## Segurança

Login por senha com hash, sessão do Convex Auth, isolamento por empresa, autorização também no servidor, cotas nas operações de gravação, controle de dados pessoais e financeiros no histórico, exportação protegida, CSP e bloqueio de iframe via `_headers` no Pages. Nenhum serviço de geração original é necessário para build, login ou execução.

A chave privada dotenv que estava em `.env.keys` foi retirada da versão atual; continua no histórico do Git. Não reutilizá-la. A varredura de histórico encontrou essa chave, sem arquivo de ambiente cifrado correspondente versionado. Credenciais de implantação devem ser novas e exclusivas deste projeto.

Veja [docs/VALIDATION.md](docs/VALIDATION.md) e [docs/COMMERCIAL.md](docs/COMMERCIAL.md).
