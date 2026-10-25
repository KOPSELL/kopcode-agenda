# AgendaKopcode

Primeira versão do front-end público do SaaS de agendamento e gestão para barbearias.

## Tecnologias
- React + TypeScript
- Vite
- Lucide React
- CSS responsivo próprio

## Rodar localmente
```bash
npm install
npm run dev
```

## Build de produção
```bash
npm run build
```

## Estado atual
Esta entrega é somente a camada visual: landing page responsiva, prévia demonstrativa do painel, apresentação dos recursos, planos de referência e perguntas frequentes. Os dados do painel são fictícios.

Ainda não estão conectados: autenticação, criação de contas/barbearias, banco Supabase, políticas RLS, agendamento real, pagamentos, renovação automática, OneSignal, nem ativação do teste de 7 dias. Não inserir chaves secretas no front-end.

## Próximas etapas
1. Criar um projeto Supabase novo e exclusivo para o AgendaKopcode.
2. Implementar autenticação e isolamento multiempresa com RLS e testes.
3. Construir o fluxo de cadastro e a área autenticada.
4. Implementar agendamento público e prevenção de conflitos.
5. Integrar pagamentos e webhooks idempotentes.
6. Integrar notificações direcionadas por empresa/usuário.
7. Validar domínio e publicar na Vercel.

**Importante:** não execute migrações em nenhum projeto Supabase usado pelos outros sites.