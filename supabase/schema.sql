-- ============================================================================
-- MEEP / PROYECTO PEMI (INSUCO ABG) - ESQUEMA SUPABASE (USUARIO + CLAVE + RLS)
-- ============================================================================
-- Autenticación directa por usuario de establecimiento (sin requerir correo).
-- Ejecuta este script completo en: Supabase -> SQL Editor -> New query -> Run.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.establecimientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) >= 2),
  usuario text not null unique check (
    usuario = lower(trim(usuario))
    and usuario ~ '^[a-z0-9._-]{3,50}$'
  ),
  password_hash text,
  correo_contacto text,
  tipo text not null default 'establecimiento'
    check (tipo in ('establecimiento', 'casino_junaeb', 'pyme')),
  created_at timestamptz not null default now()
);

-- Migración segura si ya existía la tabla vinculada a auth.users
alter table if exists public.establecimientos
  drop constraint if exists establecimientos_id_fkey;

alter table if exists public.establecimientos
  alter column id set default gen_random_uuid();

alter table if exists public.establecimientos
  add column if not exists password_hash text;

create table if not exists public.establecimiento_sesiones (
  token text primary key,
  establecimiento_id uuid not null references public.establecimientos(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_sesiones_estab
  on public.establecimiento_sesiones (establecimiento_id);

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

-- Seguridad RLS: solo alimentos es público en lectura; establecimientos, sesiones
-- y mediciones se consultan exclusivamente mediante funciones RPC validadas.
alter table public.establecimientos enable row level security;
alter table public.establecimiento_sesiones enable row level security;
alter table public.alimentos enable row level security;
alter table public.mediciones enable row level security;

drop policy if exists "establecimientos_select_propio" on public.establecimientos;
drop policy if exists "establecimientos_update_propio" on public.establecimientos;
drop policy if exists "mediciones_select_propias" on public.mediciones;
drop policy if exists "mediciones_insert_propias" on public.mediciones;
drop policy if exists "mediciones_delete_propias" on public.mediciones;

drop policy if exists "alimentos_select_todos" on public.alimentos;
create policy "alimentos_select_todos"
  on public.alimentos for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- FUNCIONES RPC DE AUTENTICACIÓN POR USUARIO Y GESTIÓN DE MEDICIONES
-- ============================================================================

create or replace function public.meep_registrar(
  p_nombre text,
  p_usuario text,
  p_tipo text,
  p_correo_contacto text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_usuario text := regexp_replace(lower(trim(coalesce(p_usuario, ''))), '[^a-z0-9._-]', '', 'g');
  v_tipo text := case
    when p_tipo in ('establecimiento', 'casino_junaeb', 'pyme') then p_tipo
    else 'establecimiento'
  end;
  v_correo text := nullif(trim(coalesce(p_correo_contacto, '')), '');
  v_est public.establecimientos;
  v_token text;
begin
  if char_length(v_nombre) < 2 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  if v_usuario !~ '^[a-z0-9._-]{3,50}$' then
    raise exception 'USUARIO_INVALIDO';
  end if;

  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'PASSWORD_CORTA';
  end if;

  if exists (select 1 from public.establecimientos where usuario = v_usuario) then
    raise exception 'USUARIO_DUPLICADO';
  end if;

  insert into public.establecimientos (nombre, usuario, password_hash, correo_contacto, tipo)
  values (
    v_nombre,
    v_usuario,
    crypt(p_password, gen_salt('bf')),
    v_correo,
    v_tipo
  )
  returning * into v_est;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.establecimiento_sesiones (token, establecimiento_id)
  values (v_token, v_est.id);

  return jsonb_build_object(
    'token', v_token,
    'profile', jsonb_build_object(
      'id', v_est.id,
      'nombre', v_est.nombre,
      'usuario', v_est.usuario,
      'correo_contacto', v_est.correo_contacto,
      'tipo', v_est.tipo,
      'created_at', v_est.created_at
    )
  );
end;
$$;

create or replace function public.meep_login(
  p_identificador text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_clean text := lower(trim(coalesce(p_identificador, '')));
  v_est public.establecimientos;
  v_token text;
begin
  if v_clean = '' or coalesce(p_password, '') = '' then
    raise exception 'CREDENCIALES_INVALIDAS';
  end if;

  select * into v_est
  from public.establecimientos e
  where e.usuario = v_clean
     or lower(coalesce(e.correo_contacto, '')) = v_clean
  limit 1;

  if v_est.id is null
     or v_est.password_hash is null
     or v_est.password_hash <> crypt(p_password, v_est.password_hash) then
    raise exception 'CREDENCIALES_INVALIDAS';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.establecimiento_sesiones (token, establecimiento_id)
  values (v_token, v_est.id);

  return jsonb_build_object(
    'token', v_token,
    'profile', jsonb_build_object(
      'id', v_est.id,
      'nombre', v_est.nombre,
      'usuario', v_est.usuario,
      'correo_contacto', v_est.correo_contacto,
      'tipo', v_est.tipo,
      'created_at', v_est.created_at
    )
  );
end;
$$;

create or replace function public.meep_perfil(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est public.establecimientos;
begin
  if coalesce(trim(p_token), '') = '' then
    return null;
  end if;

  select e.* into v_est
  from public.establecimiento_sesiones s
  join public.establecimientos e on e.id = s.establecimiento_id
  where s.token = p_token
    and s.expires_at > now()
  limit 1;

  if v_est.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_est.id,
    'nombre', v_est.nombre,
    'usuario', v_est.usuario,
    'correo_contacto', v_est.correo_contacto,
    'tipo', v_est.tipo,
    'created_at', v_est.created_at
  );
end;
$$;

create or replace function public.meep_logout(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.establecimiento_sesiones where token = p_token;
$$;

create or replace function public.meep_listar_mediciones(p_token text)
returns setof public.mediciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est_id uuid;
begin
  select s.establecimiento_id into v_est_id
  from public.establecimiento_sesiones s
  where s.token = p_token
    and s.expires_at > now()
  limit 1;

  if v_est_id is null then
    raise exception 'SESION_INVALIDA';
  end if;

  return query
  select *
  from public.mediciones m
  where m.establecimiento_id = v_est_id
  order by m.medido_at desc
  limit 200;
end;
$$;

create or replace function public.meep_insertar_medicion(
  p_token text,
  p_alimento_clave text,
  p_ph numeric,
  p_temperatura numeric,
  p_estado text,
  p_subestado text,
  p_led_color text,
  p_motivo text,
  p_manipulador text,
  p_dispositivo_codigo text,
  p_origen text,
  p_medido_at timestamptz
)
returns public.mediciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est_id uuid;
  v_row public.mediciones;
begin
  select s.establecimiento_id into v_est_id
  from public.establecimiento_sesiones s
  where s.token = p_token
    and s.expires_at > now()
  limit 1;

  if v_est_id is null then
    raise exception 'SESION_INVALIDA';
  end if;

  insert into public.mediciones (
    establecimiento_id,
    alimento_clave,
    ph,
    temperatura,
    estado,
    subestado,
    led_color,
    motivo,
    manipulador,
    dispositivo_codigo,
    origen,
    medido_at
  ) values (
    v_est_id,
    p_alimento_clave,
    p_ph,
    p_temperatura,
    p_estado,
    coalesce(p_subestado, 'no_interpretable'),
    coalesce(p_led_color, 'apagado'),
    p_motivo,
    p_manipulador,
    p_dispositivo_codigo,
    coalesce(p_origen, 'bluetooth'),
    coalesce(p_medido_at, now())
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.meep_eliminar_medicion(
  p_token text,
  p_medicion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est_id uuid;
begin
  select s.establecimiento_id into v_est_id
  from public.establecimiento_sesiones s
  where s.token = p_token
    and s.expires_at > now()
  limit 1;

  if v_est_id is null then
    raise exception 'SESION_INVALIDA';
  end if;

  delete from public.mediciones
  where id = p_medicion_id
    and establecimiento_id = v_est_id;
end;
$$;

grant execute on function public.meep_registrar(text, text, text, text, text) to anon, authenticated;
grant execute on function public.meep_login(text, text) to anon, authenticated;
grant execute on function public.meep_perfil(text) to anon, authenticated;
grant execute on function public.meep_logout(text) to anon, authenticated;
grant execute on function public.meep_listar_mediciones(text) to anon, authenticated;
grant execute on function public.meep_insertar_medicion(text, text, numeric, numeric, text, text, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.meep_eliminar_medicion(text, uuid) to anon, authenticated;

-- ============================================================================
-- DATOS INICIALES: ALIMENTOS LÁCTEOS + CUENTA OFICIAL INSUCO ABG
-- ============================================================================

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

insert into public.establecimientos (
  nombre, usuario, password_hash, correo_contacto, tipo
) values (
  'INSUCO ABG',
  'institutodecomercioinsucoabg',
  extensions.crypt('INSUCOABGALIMENTOS2026', extensions.gen_salt('bf')),
  null,
  'establecimiento'
)
on conflict (usuario) do update set
  nombre = excluded.nombre,
  password_hash = excluded.password_hash;

notify pgrst, 'reload schema';
