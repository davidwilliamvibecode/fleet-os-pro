# Primeiro cliente — implantação simples

Uma oferta inicial: assinatura mensal do Fleet OS Pro para uma empresa, com cadastro de frota, motoristas, manutenções, documentos, alertas na tela, equipe com permissões e exportação CSV. Sem módulos adicionais, integração bancária ou cobrança automática. Valor e condições serão definidos pelo fornecedor diretamente com o primeiro cliente; nenhum preço foi inventado nem cobrança ativada no sistema.

## Demonstração

Usar uma conta do fornecedor e uma empresa de demonstração criada pelo próprio sistema. Carregar exemplos apenas nesse espaço vazio. Mostrar painel → veículos → motorista → manutenção → vencimento → exportação. Não usar dados reais de terceiros na apresentação. Os exemplos não aparecem em outras empresas.

## Entrada do cliente

1. Entregar endereço do Pages após validação, identificação do fornecedor, preço, condições e canal de suporte.
2. Proprietário cria conta e empresa. Usar BRL, km e litros (padrões do sistema).
3. Cadastrar um veículo, um motorista, um documento e uma manutenção reais com o proprietário.
4. Se houver funcionário, a conta é criada por ele e liberada pelo proprietário, com a menor permissão adequada.
5. Baixar o primeiro CSV e confirmar que o cliente consegue abri-lo.

## Suporte

Atendimento inicial pelo canal já usado na venda; não é necessária uma nova integração. Registrar empresa, tela, horário, passos e impacto. Nunca solicitar a senha. Prioridade: acesso indisponível, risco aos dados e falhas de cadastro/exportação; melhorias visuais podem aguardar.

O operador consulta GitHub Actions, Cloudflare Pages e Convex. Só encerrar incidente após repetir o fluxo com sucesso. Exportar regularmente e avisar que o CSV não tem restauração automática.

Usar apenas os planos gratuitos e acompanhar suas cotas. Não prometer capacidade ilimitada ou SLA que não foi contratado. A única versão mantida para o cliente é a `main` publicada no endereço definitivo do Pages.
