# Operação e recuperação — Fleet OS Pro

## Falha de acesso

Consultar Configurações → Dados → Diagnóstico. Se a interface não abrir, consultar o último build do Cloudflare e os logs do deployment `mellow-tapir-783` no Convex. Não criar outro projeto para corrigir uma falha de deploy.

Executar `npm ci` e `npm run check` no mesmo commit da `main`. Um novo `git revert` do commit defeituoso preserva o histórico; conferir efeitos de alterações de schema antes de publicar. Validar o login e um registro após cada implantação.

## Senha esquecida

Não há recuperação por e-mail neste MVP. Antes de qualquer alteração administrativa, confirmar o titular por um canal já registrado. Não pedir senha antiga, não aceitar apenas a alegação de posse do e-mail e não editar hashes manualmente. Após confirmar o titular por um canal conhecido, o operador autenticado no painel Convex pode executar a ação interna `support.resetPassword`, conferindo `userId`, e-mail e nova senha. Ela usa a API do Convex Auth para gerar o hash e invalida todas as sessões existentes. Não há endpoint público para esse procedimento. Não registrar a nova senha em chamados ou mensagens abertas; combinar a entrega por canal privado e orientar o titular a usar uma senha exclusiva. O fluxo está coberto por teste automatizado.

## Cópias dos dados

O proprietário ou administrador pode baixar CSVs de veículos, motoristas, manutenções, documentos e histórico em Configurações → Dados. Arquivos abrem no Excel ou LibreOffice; podem conter dados pessoais, portanto devem ser guardados com acesso restrito.

Não existe importador automático de CSV. A reconstrução pelo CSV é manual. Exportação não equivale a backup restaurável do banco. Para uma cópia integral, usar as opções de exportação do deployment no Convex conforme disponibilidade do plano, antes de operações destrutivas. A restauração de um export integral afeta o deployment inteiro, inclusive outras empresas; nunca executá-la como se fosse restauração de um único cliente.

## Exclusão

A remoção de veículo apaga seus registros de manutenção e documentos. Remover motorista desvincula veículos. Limpar dados da frota remove os registros operacionais da empresa, mantendo empresa, equipe e um registro da ação de limpeza. Não é exclusão de conta ou de todo o espaço. Solicitações de encerramento e direitos dos titulares precisam ser tratadas pelo responsável da empresa com apoio do operador, conforme o caso.

Confirmar identidade, escopo e necessidade de exportação antes de exclusões. As exclusões pela interface são definitivas; não prometer desfazer.
