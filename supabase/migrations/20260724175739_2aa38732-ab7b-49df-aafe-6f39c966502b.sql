
-- Roles enum + user_roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil text default 'user',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles select all authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email) values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contratos
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text not null unique,
  fornecedor text not null,
  data_inicio date,
  data_fim date,
  status text default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contratos to authenticated;
grant all on public.contratos to service_role;
alter table public.contratos enable row level security;
create policy "contratos all authenticated" on public.contratos for all to authenticated using (true) with check (true);

create index on public.contratos (numero_contrato);
create index on public.contratos (fornecedor);

-- Itens
create table public.itens (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  codigo text not null,
  descricao text,
  unidade text,
  preco_atual numeric(14,4) not null default 0,
  preco_anterior numeric(14,4),
  data_atualizacao timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.itens to authenticated;
grant all on public.itens to service_role;
alter table public.itens enable row level security;
create policy "itens all authenticated" on public.itens for all to authenticated using (true) with check (true);

create index on public.itens (contrato_id);
create index on public.itens (codigo);

-- Historico precos
create table public.historico_precos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.itens(id) on delete cascade,
  codigo text not null,
  preco numeric(14,4) not null,
  data_referencia timestamptz not null default now()
);
grant select, insert, update, delete on public.historico_precos to authenticated;
grant all on public.historico_precos to service_role;
alter table public.historico_precos enable row level security;
create policy "hist all authenticated" on public.historico_precos for all to authenticated using (true) with check (true);
create index on public.historico_precos (codigo);
create index on public.historico_precos (item_id);

-- Importacoes
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  usuario_nome text,
  data_importacao timestamptz not null default now(),
  quantidade_registros integer not null default 0,
  status text default 'concluido'
);
grant select, insert, update, delete on public.importacoes to authenticated;
grant all on public.importacoes to service_role;
alter table public.importacoes enable row level security;
create policy "importacoes all authenticated" on public.importacoes for all to authenticated using (true) with check (true);
