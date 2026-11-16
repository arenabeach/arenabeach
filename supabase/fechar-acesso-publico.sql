-- =====================================================================
-- Fecha o acesso público (chave anon) ao banco da Arena.
--
-- RODE SÓ DEPOIS de publicar a versão nova do site na Vercel. A versão
-- antiga lê e grava em `bookings` direto do navegador e para de funcionar
-- assim que este script rodar.
--
-- Onde rodar: painel do Supabase > SQL Editor > colar tudo > Run.
-- As rotas /api/* usam a service_role key, que ignora RLS e continua
-- funcionando normalmente.
-- =====================================================================

begin;

-- Remove TODAS as policies existentes das 4 tabelas (não sabemos quais
-- foram criadas pelo painel; recriamos abaixo só o que é necessário).
do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('bookings', 'monthly_subscribers', 'blocked_slots', 'recurring_blocked_slots')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.bookings                enable row level security;
alter table public.monthly_subscribers     enable row level security;
alter table public.blocked_slots           enable row level security;
alter table public.recurring_blocked_slots enable row level security;

-- bookings e monthly_subscribers têm nome e telefone de clientes:
-- nenhum acesso pela chave pública. Tudo passa pelas rotas /api/*.
revoke all on public.bookings            from anon, authenticated;
revoke all on public.monthly_subscribers from anon, authenticated;

-- Bloqueios de horário não têm dado pessoal: o site continua LENDO direto,
-- mas só o admin (via /api/admin) grava.
revoke all on public.blocked_slots           from anon, authenticated;
revoke all on public.recurring_blocked_slots from anon, authenticated;
grant select (court_id, date, time) on public.blocked_slots           to anon, authenticated;
grant select (court_id, time)       on public.recurring_blocked_slots to anon, authenticated;

create policy "leitura publica dos bloqueios"
  on public.blocked_slots for select
  to anon, authenticated
  using (true);

create policy "leitura publica dos bloqueios permanentes"
  on public.recurring_blocked_slots for select
  to anon, authenticated
  using (true);

commit;

-- Conferência (deve listar só as 2 policies de leitura acima):
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename;
