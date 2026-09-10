# Prado's Tour — Sistema Web Completo

Sistema oficial de operação da **Prado's Tour**: catálogo, reservas, pagamentos (PIX/cartão, 50%+50% ou 100%), voucher com QR Code, check-in, vendedores/comissões, financeiro, CRM, cupons, notificações e personalização visual.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- Autenticação por sessão JWT (cookie httpOnly)
- Persistência local em `.data/store.json` (pronta para demo/produção interna)
- Schema **PostgreSQL/Supabase** com RLS em `database/schema.sql`
- Webhook de pagamento em `/api/webhooks/payment`

## Arquitetura

```
Cliente → Viagem → Reserva → Pagamento (gateway/webhook) → Voucher → Check-in
Empresa → Vendedores → Comissões → Financeiro → Relatórios
```

Regras críticas (vagas, preço, cupom, assento, pagamento) são validadas no **backend** (`src/lib/booking/actions.ts`), nunca só no frontend.

## Como rodar

```bash
cd ~/prados-tour
cp .env.example .env.local
# gere AUTH_SECRET e PAYMENT_WEBHOOK_SECRET com: openssl rand -base64 32
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas demo (senha `Prados@123`)

| E-mail | Papel |
|--------|--------|
| admin@pradostour.com | SUPER_ADMIN |
| vendedor@pradostour.com | VENDEDOR |
| monitor@pradostour.com | MONITOR |
| financeiro@pradostour.com | FINANCEIRO |
| cliente@pradostour.com | CLIENTE |

## Fluxos principais

1. **Cliente**: criar conta → excursões → reservar → checkout (6 etapas) → PIX/cartão → voucher
2. **Pagamento**: status só muda para PAGO via webhook (`confirmPaymentWebhook`) ou confirmação admin em `/financeiro`
3. **Vendedor**: `/vendedor` + código `VD001` no checkout (comissão 10%)
4. **Operacional**: `/operacional` e `/check-in` (sem acesso financeiro)
5. **Admin**: `/admin` (viagens, clientes/CRM, cupons, despesas, personalização)
6. **Financeiro**: receitas, despesas, comissões, lucro por viagem

## Personalização

Em `/admin/configuracoes` altere cores, logo, banner, WhatsApp, Instagram e e-mail. As variáveis CSS do layout leem essas configurações automaticamente.

## Supabase (produção)

1. Crie um projeto Supabase
2. Execute `database/schema.sql` no SQL Editor
3. Execute `database/seed.sql`
4. Se o projeto Supabase já existia antes desta versão, execute também `database/migrations/001_production_hardening.sql`
5. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_URL`
6. Use apenas a **anon/publishable key** no cliente; `SUPABASE_SERVICE_ROLE_KEY` só no servidor
7. Configure o webhook do gateway apontando para `/api/webhooks/payment` com `PAYMENT_WEBHOOK_SECRET`

### Preparação de infraestrutura

O backend ativo continua sendo `DATA_BACKEND=local`, usando `.data/store.json`.
O projeto já separa o cliente Supabase de navegador (anon key) do cliente
administrativo de servidor (`SUPABASE_SERVICE_ROLE_KEY`). Não altere
`DATA_BACKEND` para `supabase` até que os repositórios e os dados de cada domínio
tenham sido migrados e validados.

O app atual funciona 100% no modo store local. A camada Supabase do schema já cobre RLS, `create_booking`, dashboards e roles alinhados à especificação.

## Deploy

- Vercel / Node 20+
- Defina `AUTH_SECRET` e `PAYMENT_WEBHOOK_SECRET` fortes; o app não possui fallback de JWT
- Monte volume persistente para `.data/`, configure `LOCAL_STORE_BACKUP_DIR` fora do repositório **ou** migre a store para Supabase
- Domínio HTTPS obrigatório para cookies `secure`

## Estrutura

```
src/app          → rotas (cliente, admin, financeiro, vendedor, operacional)
src/components   → UI, layout, checkout
src/lib/auth     → sessão e ações de autenticação
src/lib/booking  → reservas e pagamentos
src/lib/admin    → check-in, viagens, métricas
src/lib/db       → store + seed
database/        → schema SQL + seed Supabase
```

## Segurança

- Páginas privadas protegidas por middleware + checagem de role
- Cliente não acessa reserva/pagamento de outro usuário
- Monitor não acessa financeiro
- Preço/vagas/assentos confirmados no servidor
- Senhas com bcrypt; secrets só em variáveis de ambiente
