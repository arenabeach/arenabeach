-- =====================================================================
-- Tabela dos aparelhos que recebem aviso de reserva paga (celular/computador).
-- Rodar UMA vez: painel do Supabase > SQL Editor > colar tudo > Run.
-- Só as rotas /api/* (service_role) acessam; a chave pública não vê nada.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Conferência: deve listar a tabela com RLS ligado (rowsecurity = true).
select tablename, rowsecurity from pg_tables where tablename = 'push_subscriptions';
