# AgendaKopcode

Primeira versão do front-end público do SaaS de agendamento e gestão para barbearias.

## Tecnologias
- React + TypeScript
- Vite
- Lucide React
- CSS responsivo próprio

## Configurar o Supabase

O cliente do Supabase fica em `src/lib/supabase.ts` e usa variáveis de ambiente Vite. Copie `.env.example` para `.env.local` e preencha:

- `VITE_SUPABASE_URL`: `https://hfxakwkmitmjvmzzyytq.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: a chave pública `sb_publishable_...` do projeto KOPCODE

Nunca coloque uma chave `service_role` no front-end. No deploy da Vercel, cadastre as mesmas variáveis em **Settings → Environment Variables** e faça um novo deploy.

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

A biblioteca cliente do Supabase e a verificação inicial de conexão já estão no código. Ainda não estão implementados: cadastro/autenticação de usuários, criação de barbearias pelo site, fluxo de agendamento real, pagamentos, renovação automática, OneSignal e ativação do teste de 7 dias. As políticas RLS do banco precisam ser testadas antes de dados reais. Não inserir chaves secretas no front-end.

## Próximas etapas
1. Criar um projeto Supabase novo e exclusivo para o AgendaKopcode.
2. Implementar autenticação e isolamento multiempresa com RLS e testes.
3. Construir o fluxo de cadastro e a área autenticada.
4. Implementar agendamento público e prevenção de conflitos.
5. Integrar pagamentos e webhooks idempotentes.
6. Integrar notificações direcionadas por empresa/usuário.
7. Validar domínio e publicar na Vercel.

**Importante:** não execute migrações em nenhum projeto Supabase usado pelos outros sites.