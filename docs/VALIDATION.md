# Validação técnica — 2 de novembro de 2026

## Correções

- Autenticação independente: provedor por senha do Convex Auth, hash, normalização de e-mail, limite de 8 a 128 caracteres, aceite com versão e data; remoção de provedor anônimo e confiança em emissor externo.
- Remoção de relay de e-mail, plugin de build, barra, monitoramento externo e dependências da ferramenta de origem.
- Arquivo de chave dotenv removido e arquivos de ambiente ignorados; nenhuma credencial antiga é necessária ao novo sistema.
- Liberação de equipe restrita ao proprietário, vinculando identificador da conta e e-mail; prontuário pessoal não é liberado só por um e-mail declarado.
- Histórico respeita restrições de remuneração e dados pessoais; conclusão da configuração exige proprietário ou administrador.
- Dados de demonstração compatíveis com os enums do schema e chassis fictícios editáveis; exemplos não se misturam a cadastros já preenchidos.
- Exclusão remove todos os registros associados, sem interrupção silenciosa após o 500º item.
- Dependências e lockfile sincronizados. Arquivos gerados do Convex versionados e testes removidos da pasta de funções implantáveis.
- Headers de segurança prontos para aplicação no Cloudflare Pages.

## Verificações executadas localmente

41 testes passaram: regras de autorização, cotas, isolamento de leitura/escrita/exclusão/exportação, CSV e fórmulas, demonstração, documentos/manutenções, equipe, identidade de motorista, privacidade no histórico, cadastro/login/senha/aceite e recuperação administrativa com revogação das sessões. Lint sem erros (avisos de Fast Refresh em componentes existentes); TypeScript e build passaram.

Auditoria de dependências de execução: zero vulnerabilidades. Auditoria completa: zero altas/críticas e 13 alertas moderados restritos à cadeia de lint (`minimatch`/ESLint); não foi aplicado downgrade automático nem troca incompatível de dependências. A CI remota deve ser consultada no resultado do commit. Esta validação local não comprova uma implantação remota.

## Implantação

Projeto Convex `fleet-os-pro` criado, deployment `mellow-tapir-783`. Publicação das funções ainda depende da credencial de deploy. Cloudflare Pages requer autenticação da conta e configuração do projeto. Não houve criação de domínio pago, ativação de plano pago ou publicação de link ainda não validado.

Depois do deploy: testar cadastro/login no endereço real, persistência após recarregar, cadastros operacionais, exportação e acesso de funcionário. Somente após isso o produto pode ser declarado acessível e validado para o primeiro cliente.

## Referências usadas

- Cloudflare Pages, configuração de headers: https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Pages, fallback de SPA: https://developers.cloudflare.com/pages/configuration/serving-pages/
- ANPD, Resolução nº 2/2022, art. 11 (canal de comunicação e hipóteses de dispensa de encarregado): https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
- Convex Auth: implementação instalada do provedor Password, funções de sessão e assinatura.
