-- ============================================================================
-- MEEP / PROYECTO PEMI (INSUCO ABG) - ESQUEMA SUPABASE + AUTH + RLS
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.establecimientos (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) >= 2),
  usuario text not null unique check (
    usuario = lower(trim(usuario))
    and usuario ~ '^[a-z0-9._-]{3,50}$'
  ),
  correo_contacto text,
  tipo text not null default 'establecimiento'
    check (tipo in ('establecimiento', 'casino_junaeb', 'pyme')),
  created_at timestamptz not null default now()
);

create table if not exists public.alimentos (
  clave text primary key,
  nombre text not null,
  icono text not null,
  ph_min numeric(4,2),
  ph_max numeric(4,2),
  rango_acido_max numeric(4,2),
  rango_contaminado_min numeric(4,2),
  validado boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.mediciones (
  id uuid primary key default gen_random_uuid(),
  establecimiento_id uuid not null references public.establecimientos(id) on delete cascade,
  alimento_clave text not null references public.alimentos(clave),
  ph numeric(4,2) check (ph is null or (ph >= 0 and ph <= 14)),
  temperatura numeric(5,2),
  estado text not null check (estado in ('in', 'out', 'na')),
  subestado text not null default 'no_interpretable'
    check (subestado in ('buen_estado', 'acido', 'contaminado', 'no_interpretable')),
  led_color text not null default 'apagado'
    check (led_color in ('verde', 'rojo', 'apagado')),
  motivo text,
  manipulador text,
  dispositivo_codigo text,
  origen text not null default 'bluetooth' check (origen in ('bluetooth', 'demo')),
  medido_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_mediciones_estab_fecha
  on public.mediciones (establecimiento_id, medido_at desc);

create index if not exists idx_mediciones_alimento
  on public.mediciones (alimento_clave);

create or replace view public.resumen_mediciones
with (security_invoker = true) as
select
  establecimiento_id,
  count(*) as total_mediciones,
  count(*) filter (where estado = 'in') as dentro_rango,
  count(*) filter (where estado = 'out') as fuera_rango,
  count(*) filter (where estado = 'na') as no_interpretables,
  max(medido_at) as ultima_medicion
from public.mediciones
group by establecimiento_id;

alter table public.establecimientos enable row level security;
alter table public.alimentos enable row level security;
alter table public.mediciones enable row level security;

drop policy if exists "establecimientos_select_propio" on public.establecimientos;
create policy "establecimientos_select_propio"
  on public.establecimientos for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "establecimientos_update_propio" on public.establecimientos;
create policy "establecimientos_update_propio"
  on public.establecimientos for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "alimentos_select_todos" on public.alimentos;
create policy "alimentos_select_todos"
  on public.alimentos for select
  to anon, authenticated
  using (true);

drop policy if exists "mediciones_select_propias" on public.mediciones;
create policy "mediciones_select_propias"
  on public.mediciones for select
  to authenticated
  using (establecimiento_id = auth.uid());

drop policy if exists "mediciones_insert_propias" on public.mediciones;
create policy "mediciones_insert_propias"
  on public.mediciones for insert
  to authenticated
  with check (establecimiento_id = auth.uid());

drop policy if exists "mediciones_delete_propias" on public.mediciones;
create policy "mediciones_delete_propias"
  on public.mediciones for delete
  to authenticated
  using (establecimiento_id = auth.uid());

create or replace function public.handle_new_establecimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text;
  v_nombre text;
  v_correo text;
begin
  v_usuario := lower(trim(coalesce(
    new.raw_user_meta_data ->> 'usuario',
    split_part(new.email, '@', 1)
  )));
  v_nombre := trim(coalesce(
    new.raw_user_meta_data ->> 'nombre',
    v_usuario
  ));
  v_correo := nullif(trim(coalesce(new.raw_user_meta_data ->> 'correo_contacto', '')), '');

  insert into public.establecimientos (id, nombre, usuario, correo_contacto, tipo)
  values (
    new.id,
    v_nombre,
    v_usuario,
    v_correo,
    coalesce(new.raw_user_meta_data ->> 'tipo', 'establecimiento')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_establecimiento on auth.users;
create trigger on_auth_user_created_establecimiento
  after insert on auth.users
  for each row execute function public.handle_new_establecimiento();

create or replace function public.usuario_disponible(p_usuario text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.establecimientos
    where usuario = lower(trim(p_usuario))
  );
$$;

create or replace function public.resolver_email_login(p_identificador text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_clean text := lower(trim(p_identificador));
  v_email text;
begin
  select u.email into v_email
  from public.establecimientos e
  join auth.users u on u.id = e.id
  where e.usuario = v_clean
     or lower(coalesce(e.correo_contacto, '')) = v_clean
     or lower(u.email) = v_clean
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.usuario_disponible(text) to anon, authenticated;
grant execute on function public.resolver_email_login(text) to anon, authenticated;

insert into public.alimentos (
  clave, nombre, icono, ph_min, ph_max,
  rango_acido_max, rango_contaminado_min, validado, activo, orden
) values
  ('leche', 'Leche', 'leche', 6.60, 6.80, 6.50, 6.90, false, true, 1),
  ('yogur', 'Yogur', 'yogur', 4.00, 4.50, 3.80, 4.60, false, true, 2),
  ('queso', 'Queso', 'queso', 5.20, 5.40, 5.00, null, false, true, 3)
on conflict (clave) do update set
  nombre = excluded.nombre,
  ph_min = excluded.ph_min,
  ph_max = excluded.ph_max,
  rango_acido_max = excluded.rango_acido_max,
  rango_contaminado_min = excluded.rango_contaminado_min,
  orden = excluded.orden;

-- Reparación segura del usuario INSUCO ABG (evita campos NULL en auth.users)
update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  recovery_token = coalesce(recovery_token, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email = 'institutodecomercioinsucoabg@meep.pemi';
