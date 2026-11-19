# Doce Agenda v2

Web app mobile-first para confeiteiras autônomas brasileiras gerenciarem encomendas, capacidade diária, pagamentos conferidos e vitrine pública.

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4
- Supabase (PostgreSQL, Auth, RLS, Storage)
- Cloudflare Pages via @opennextjs/cloudflare (SSR para /p/[slug])
- Vitest (domínio) + Playwright (E2E)

## Setup
```bash
npm install
cp .env.example .env.local
# preencha as variáveis do Supabase
npm run dev
```

## Scripts
- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run typecheck` — verificação de tipos
- `npm run test` — testes unitários (Vitest)
- `npm run lint` — lint

## Variáveis de ambiente
Veja `.env.example`.

## Estrutura
- `src/app` — rotas (App Router)
- `src/domain` — motor de domínio puro (currency, timezone, orderStatus, payments, capacity)
- `supabase/migrations` — schema SQL + RLS
- `public/images` — assets copiados do app anterior
