# AgendaKopcode

Aplicação web de agenda e gestão para barbearias, construída com React, TypeScript, Vite e Supabase.

## Funcionalidades implementadas no front-end

- Cadastro e login por e-mail e senha via Supabase Auth.
- Criação e configuração da barbearia com endereço público próprio.
- Painel de gestão com boas-vindas personalizadas pelo nome da barbearia.
- Gestão de profissionais, serviços, categorias e produtos.
- Controle de estoque e registro de vendas com baixa de estoque transacional.
- Contabilidade mensal com faturamento, despesas e comissões individuais por barbeiro.
- Histórico financeiro protegido por preço do serviço salvo no momento do agendamento.
- Cadastro/ativação de profissionais e serviços.
- Página pública de agendamento em `/b/slug-da-barbearia`.
- Consulta de horários ocupados sem expor dados de clientes.
- Criação de agendamentos validada no banco e proteção contra conflito de horários.
- Alteração de status e link direto para WhatsApp do cliente.
- Não há cobrança ou pagamento ativado nesta versão.

## Supabase configurado

O cliente do Supabase está em `src/lib/supabase.ts` e aponta por padrão para o projeto KOPCODE `hfxakwkmitmjvmzzyytq`. A chave `sb_publishable` é pública; nunca coloque uma chave `service_role` ou secret no navegador.

Para sobrescrever valores no ambiente, copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Na Vercel, cadastre as mesmas variáveis em **Settings → Environment Variables** e publique novamente.

## Migração obrigatória para agendamento público

O banco inicial criou as tabelas e políticas do painel. Para que o link público possa carregar a barbearia, consultar horários e gravar reservas, execute também o arquivo:

`supabase/migrations/202610250001_public_booking.sql`

Passos:
1. Abra o [SQL Editor do projeto KOPCODE](https://supabase.com/dashboard/project/hfxakwkmitmjvmzzyytq/sql/new).
2. Abra esse arquivo no GitHub, copie todo o conteúdo e cole no SQL Editor.
3. Confirme que o projeto selecionado é `hfxakwkmitmjvmzzyytq`, depois clique em **Run**.
4. Não execute em nenhum projeto usado pelos sites antigos.

## Personalização visual e envio de fotos

Depois da migração de agendamento público, execute também:

`supabase/migrations/202610250002_customization_uploads.sql`

Ela adiciona descrição, endereço, logo, capa e cor da barbearia, fotos de serviços e profissionais, e cria o bucket público `agenda-photos`. As políticas permitem que cada conta autenticada envie/edite/exclua arquivos somente dentro da pasta da própria barbearia; a leitura pública serve para exibir as imagens na página de agendamento. O limite por imagem é 8 MB.

Passos:
1. Abra o arquivo `202610250002_customization_uploads.sql` no GitHub e copie todo o conteúdo.
2. No SQL Editor do projeto KOPCODE (`hfxakwkmitmjvmzzyytq`), cole e execute.
3. Só depois teste os uploads no painel e confira a página pública.

## Proteção contra horários duplicados e atualização em tempo real

Execute `supabase/migrations/202610250003_realtime_no_double_booking.sql` depois das duas migrações anteriores. Ela cria a trava no PostgreSQL para impedir sobreposição de reservas pendentes/confirmadas do mesmo profissional e habilita a publicação Realtime da tabela de agendamentos. Se já houver reservas conflitantes, a migração para sem apagar ou cancelar reservas; resolva os conflitos indicados e execute novamente.

Execute também `supabase/migrations/202610270001_booking_collision_guard.sql` para reforçar a trava de colisão. A migração verifica conflitos antes de criar a constraint e preserva todos os registros existentes.

**Ordem obrigatória das migrações:** `202610250001_public_booking.sql` → `202610250002_customization_uploads.sql` → `202610250003_realtime_no_double_booking.sql` → `202610270001_booking_collision_guard.sql` → `202611010001_products_accounting_commissions.sql` → `202611020001_crm_loyalty_plans_public_products.sql`. Execute todas somente no projeto `hfxakwkmitmjvmzzyytq`, nunca nos Supabase dos outros sites.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Produtos, estoque, contabilidade e comissões

Depois das migrações anteriores, execute também:

`supabase/migrations/202611010001_products_accounting_commissions.sql`

Ela cria categorias e produtos por barbearia, permite ajustar estoque e alerta de estoque mínimo, registra vendas com baixa automática e transacional do estoque, lança despesas, adiciona percentual de comissão por profissional e congela o preço do serviço no agendamento para preservar o histórico financeiro. As tabelas novas usam RLS e só podem ser acessadas pelo proprietário da respectiva barbearia. Categorias, estoque, vendas, despesas e agendamentos são sincronizados em tempo real entre dispositivos da mesma barbearia.

**Ordem das migrações:** `202610250001_public_booking.sql` → `202610250002_customization_uploads.sql` → `202610250003_realtime_no_double_booking.sql` → `202610270001_booking_collision_guard.sql` → `202611010001_products_accounting_commissions.sql`. → `202611020001_crm_loyalty_plans_public_products.sql`.

A contabilidade considera atendimentos com status **Concluído**. Configure o percentual de cada profissional na aba **Contabilidade**. A comissão é calculada sobre o valor do serviço salvo no agendamento. Despesas e vendas de produtos são registradas separadamente.

## Observações importantes

- O banco e o front-end devem ser testados com uma conta nova antes de usar com clientes reais.
- O link público usa o slug da barbearia. Escolha um slug único.
- A prevenção de reservas duplicadas é validada no PostgreSQL, não apenas no navegador.
- Confirmação de e-mail depende da configuração de Authentication no Supabase. Se estiver ativada, o usuário deve confirmar o e-mail antes do primeiro login.
- Pagamentos online e renovação automática ainda não estão integrados. Os planos aparecem no painel e os limites de barbeiros são validados no banco, mas a ativação comercial dos upgrades será feita após integrar o provedor de pagamentos. WhatsApp/chatbot e campanhas automatizadas exigem integrações externas e ainda não estão ativos.
- Nenhum dos sistemas Supabase antigos deve ser alterado.
