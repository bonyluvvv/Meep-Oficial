-- ============================================================================
-- MEEP / PROYECTO PEMI (RED EDUCACIONAL COMEDUC) - ESQUEMA SUPABASE
-- ============================================================================
-- Modelo de acceso por institución:
--   1) Administrador (Página Web - solo consulta): usuario + clave admin
--   2) Manipuladores (App MEEP - medir por Bluetooth): usuario_manipulador + clave
--   3) Solicitudes de integración (formulario web): tabla solicitudes_integracion
--
-- Ejecuta este script completo en: Supabase -> SQL Editor -> New query -> Run.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.establecimientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) >= 2),
  usuario text not null unique check (
    usuario = lower(trim(usuario))
    and usuario ~ '^[a-zñ0-9._-]{3,50}$'
  ),
  password_hash text,
  usuario_manipulador text unique check (
    usuario_manipulador is null
    or (
      usuario_manipulador = lower(trim(usuario_manipulador))
      and usuario_manipulador ~ '^[a-zñ0-9._-]{3,50}$'
    )
  ),
  password_manipulador_hash text,
  correo_contacto text,
  tipo text not null default 'establecimiento'
    check (tipo in ('establecimiento', 'casino_junaeb', 'pyme')),
  created_at timestamptz not null default now()
);

-- Migraciones seguras si la tabla ya existía de una versión anterior
alter table if exists public.establecimientos
  drop constraint if exists establecimientos_id_fkey;

alter table if exists public.establecimientos
  alter column id set default gen_random_uuid();

alter table if exists public.establecimientos
  add column if not exists nombre text;

alter table if exists public.establecimientos
  add column if not exists usuario text;

alter table if exists public.establecimientos
  add column if not exists password_hash text;

alter table if exists public.establecimientos
  add column if not exists usuario_manipulador text;

alter table if exists public.establecimientos
  add column if not exists password_manipulador_hash text;

alter table if exists public.establecimientos
  add column if not exists correo_contacto text;

alter table if exists public.establecimientos
  add column if not exists tipo text not null default 'establecimiento';

alter table if exists public.establecimientos
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'establecimientos'
      and column_name = 'email'
  ) then
    execute 'alter table public.establecimientos alter column email drop not null';
  end if;
end $$;

update public.establecimientos
set nombre = 'Establecimiento MEEP'
where nombre is null or char_length(trim(nombre)) < 2;

update public.establecimientos
set usuario = lower(regexp_replace(trim(usuario), '[^a-zA-ZñÑ0-9._-]', '', 'g'))
where usuario is not null;

update public.establecimientos
set usuario = 'estab_' || substr(replace(id::text, '-', ''), 1, 12)
where usuario is null or usuario !~ '^[a-zñ0-9._-]{3,50}$';

update public.establecimientos
set usuario_manipulador = lower(regexp_replace(trim(usuario_manipulador), '[^a-zA-ZñÑ0-9._-]', '', 'g'))
where usuario_manipulador is not null;

update public.establecimientos
set usuario_manipulador = null
where usuario_manipulador is not null
  and usuario_manipulador !~ '^[a-zñ0-9._-]{3,50}$';

alter table if exists public.establecimientos
  alter column nombre set not null;

alter table if exists public.establecimientos
  alter column usuario set not null;

alter table if exists public.establecimientos
  drop constraint if exists establecimientos_usuario_check;

alter table if exists public.establecimientos
  add constraint establecimientos_usuario_check check (
    usuario = lower(trim(usuario))
    and usuario ~ '^[a-zñ0-9._-]{3,50}$'
  );

alter table if exists public.establecimientos
  drop constraint if exists establecimientos_usuario_manipulador_check;

alter table if exists public.establecimientos
  add constraint establecimientos_usuario_manipulador_check check (
    usuario_manipulador is null
    or (
      usuario_manipulador = lower(trim(usuario_manipulador))
      and usuario_manipulador ~ '^[a-zñ0-9._-]{3,50}$'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.establecimientos'::regclass
      and c.contype in ('u', 'p')
      and array_length(c.conkey, 1) = 1
      and a.attname = 'usuario'
  ) then
    alter table public.establecimientos
      add constraint establecimientos_usuario_key unique (usuario);
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.establecimientos'::regclass
      and c.contype in ('u', 'p')
      and array_length(c.conkey, 1) = 1
      and a.attname = 'usuario_manipulador'
  ) then
    alter table public.establecimientos
      add constraint establecimientos_usuario_manipulador_key unique (usuario_manipulador);
  end if;
end $$;

create or replace function public.meep_hash_establecimiento_passwords()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password_hash is not null
     and new.password_hash <> ''
     and new.password_hash !~ '^\$2[aby]\$\d{2}\$' then
    new.password_hash := extensions.crypt(new.password_hash, extensions.gen_salt('bf'));
  end if;

  if new.password_manipulador_hash is not null
     and new.password_manipulador_hash <> ''
     and new.password_manipulador_hash !~ '^\$2[aby]\$\d{2}\$' then
    new.password_manipulador_hash := extensions.crypt(new.password_manipulador_hash, extensions.gen_salt('bf'));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_establecimientos_hash_passwords on public.establecimientos;
create trigger trg_establecimientos_hash_passwords
  before insert or update of password_hash, password_manipulador_hash
  on public.establecimientos
  for each row
  execute function public.meep_hash_establecimiento_passwords();

create table if not exists public.establecimiento_sesiones (
  token text primary key,
  establecimiento_id uuid not null references public.establecimientos(id) on delete cascade,
  rol text not null default 'admin' check (rol in ('admin', 'manipulador')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table if exists public.establecimiento_sesiones
  add column if not exists rol text not null default 'admin';

create index if not exists idx_sesiones_estab
  on public.establecimiento_sesiones (establecimiento_id);

-- Tabla para recibir solicitudes de nuevas instituciones desde el formulario web
create table if not exists public.solicitudes_integracion (
  id uuid primary key default gen_random_uuid(),
  nombre_institucion text not null check (char_length(trim(nombre_institucion)) >= 2),
  tipo text not null default 'establecimiento'
    check (tipo in ('establecimiento', 'casino_junaeb', 'pyme')),
  nombre_contacto text not null check (char_length(trim(nombre_contacto)) >= 2),
  correo_contacto text not null check (position('@' in correo_contacto) > 1),
  telefono text,
  ciudad_comuna text,
  observaciones text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_revision', 'aprobada', 'rechazada')),
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

alter table if exists public.alimentos
  add column if not exists icono text not null default 'leche';
alter table if exists public.alimentos
  add column if not exists ph_min numeric(4,2);
alter table if exists public.alimentos
  add column if not exists ph_max numeric(4,2);
alter table if exists public.alimentos
  add column if not exists rango_acido_max numeric(4,2);
alter table if exists public.alimentos
  add column if not exists rango_contaminado_min numeric(4,2);
alter table if exists public.alimentos
  add column if not exists validado boolean not null default false;
alter table if exists public.alimentos
  add column if not exists activo boolean not null default true;
alter table if exists public.alimentos
  add column if not exists orden int not null default 0;

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

alter table if exists public.mediciones
  add column if not exists temperatura numeric(5,2);
alter table if exists public.mediciones
  add column if not exists subestado text not null default 'no_interpretable';
alter table if exists public.mediciones
  add column if not exists led_color text not null default 'apagado';
alter table if exists public.mediciones
  add column if not exists motivo text;
alter table if exists public.mediciones
  add column if not exists manipulador text;
alter table if exists public.mediciones
  add column if not exists dispositivo_codigo text;
alter table if exists public.mediciones
  add column if not exists origen text not null default 'bluetooth';
alter table if exists public.mediciones
  add column if not exists medido_at timestamptz not null default now();
alter table if exists public.mediciones
  add column if not exists created_at timestamptz not null default now();

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

-- Seguridad RLS: solo alimentos es público en lectura; establecimientos, sesiones,
-- solicitudes y mediciones se operan únicamente mediante funciones RPC validadas.
alter table public.establecimientos enable row level security;
alter table public.establecimiento_sesiones enable row level security;
alter table public.solicitudes_integracion enable row level security;
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
-- FUNCIONES RPC DE AUTENTICACIÓN POR ROL, SOLICITUDES Y MEDICIONES
-- ============================================================================

-- Limpia firma anterior si existía de versión previa
drop function if exists public.meep_login(text, text);

create or replace function public.meep_login(
  p_identificador text,
  p_password text,
  p_canal text default 'web'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_clean text := lower(trim(coalesce(p_identificador, '')));
  v_canal text := case when p_canal = 'app' then 'app' else 'web' end;
  v_est public.establecimientos;
  v_token text;
  v_rol text;
begin
  if v_clean = '' or coalesce(p_password, '') = '' then
    raise exception 'CREDENCIALES_INVALIDAS';
  end if;

  if v_canal = 'web' then
    -- En la página web solo ingresan administradores
    select * into v_est
    from public.establecimientos e
    where e.usuario = v_clean
    limit 1;

    if v_est.id is not null then
      if v_est.password_hash is null
         or v_est.password_hash <> crypt(p_password, v_est.password_hash) then
        raise exception 'CREDENCIALES_INVALIDAS';
      end if;
      v_rol := 'admin';
    else
      -- Verifica si está intentando usar la cuenta de manipulador en la web
      select * into v_est
      from public.establecimientos e
      where e.usuario_manipulador = v_clean
      limit 1;

      if v_est.id is not null then
        raise exception 'SOLO_APP_MANIPULADOR';
      end if;

      raise exception 'CREDENCIALES_INVALIDAS';
    end if;
  else
    -- En la App MEEP ingresan los manipuladores de alimentos
    select * into v_est
    from public.establecimientos e
    where e.usuario_manipulador = v_clean
    limit 1;

    if v_est.id is not null then
      if v_est.password_manipulador_hash is null
         or v_est.password_manipulador_hash <> crypt(p_password, v_est.password_manipulador_hash) then
        raise exception 'CREDENCIALES_INVALIDAS';
      end if;
      v_rol := 'manipulador';
    else
      -- Verifica si está intentando usar la cuenta de administrador en la App
      select * into v_est
      from public.establecimientos e
      where e.usuario = v_clean
      limit 1;

      if v_est.id is not null then
        raise exception 'SOLO_WEB_ADMIN';
      end if;

      raise exception 'CREDENCIALES_INVALIDAS';
    end if;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.establecimiento_sesiones (token, establecimiento_id, rol)
  values (v_token, v_est.id, v_rol);

  return jsonb_build_object(
    'token', v_token,
    'profile', jsonb_build_object(
      'id', v_est.id,
      'nombre', v_est.nombre,
      'usuario', case when v_rol = 'manipulador' then coalesce(v_est.usuario_manipulador, v_est.usuario) else v_est.usuario end,
      'usuario_manipulador', v_est.usuario_manipulador,
      'correo_contacto', v_est.correo_contacto,
      'tipo', v_est.tipo,
      'rol', v_rol,
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
  v_rol text;
begin
  if coalesce(trim(p_token), '') = '' then
    return null;
  end if;

  select
    e.id,
    e.nombre,
    e.usuario,
    e.password_hash,
    e.usuario_manipulador,
    e.password_manipulador_hash,
    e.correo_contacto,
    e.tipo,
    e.created_at,
    s.rol
  into
    v_est.id,
    v_est.nombre,
    v_est.usuario,
    v_est.password_hash,
    v_est.usuario_manipulador,
    v_est.password_manipulador_hash,
    v_est.correo_contacto,
    v_est.tipo,
    v_est.created_at,
    v_rol
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
    'usuario', case when v_rol = 'manipulador' then coalesce(v_est.usuario_manipulador, v_est.usuario) else v_est.usuario end,
    'usuario_manipulador', v_est.usuario_manipulador,
    'correo_contacto', v_est.correo_contacto,
    'tipo', v_est.tipo,
    'rol', v_rol,
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

create or replace function public.meep_enviar_solicitud(
  p_nombre_institucion text,
  p_tipo text,
  p_nombre_contacto text,
  p_correo_contacto text,
  p_telefono text default null,
  p_ciudad_comuna text default null,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institucion text := trim(coalesce(p_nombre_institucion, ''));
  v_contacto text := trim(coalesce(p_nombre_contacto, ''));
  v_correo text := lower(trim(coalesce(p_correo_contacto, '')));
  v_tipo text := case
    when p_tipo in ('establecimiento', 'casino_junaeb', 'pyme') then p_tipo
    else 'establecimiento'
  end;
  v_row public.solicitudes_integracion;
begin
  if char_length(v_institucion) < 2 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  if char_length(v_contacto) < 2 then
    raise exception 'CONTACTO_INVALIDO';
  end if;

  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'CORREO_INVALIDO';
  end if;

  insert into public.solicitudes_integracion (
    nombre_institucion,
    tipo,
    nombre_contacto,
    correo_contacto,
    telefono,
    ciudad_comuna,
    observaciones
  ) values (
    v_institucion,
    v_tipo,
    v_contacto,
    v_correo,
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_ciudad_comuna, '')), ''),
    nullif(trim(coalesce(p_observaciones, '')), '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'estado', v_row.estado,
    'created_at', v_row.created_at
  );
end;
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

grant execute on function public.meep_login(text, text, text) to anon, authenticated;
grant execute on function public.meep_perfil(text) to anon, authenticated;
grant execute on function public.meep_logout(text) to anon, authenticated;
grant execute on function public.meep_enviar_solicitud(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.meep_listar_mediciones(text) to anon, authenticated;
grant execute on function public.meep_insertar_medicion(text, text, numeric, numeric, text, text, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.meep_eliminar_medicion(text, uuid) to anon, authenticated;

-- ============================================================================
-- DATOS INICIALES: ALIMENTOS LÁCTEOS + CUENTA DUAL OFICIAL INSUCO ABG
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

-- Migra el registro previo de INSUCO ABG (si existe) para conservar sus mediciones
update public.establecimientos
set
  nombre = 'Instituto Comercial Bicentenario de Viña del Mar',
  usuario = 'adminabg',
  password_hash = extensions.crypt('comeducabg.cl2026', extensions.gen_salt('bf')),
  usuario_manipulador = 'insucoalbertoblestgana',
  password_manipulador_hash = extensions.crypt('comeducABG', extensions.gen_salt('bf'))
where id = (
  select e.id
  from public.establecimientos e
  where e.usuario in ('institutodecomercioinsucoabg', 'insucoadministracion')
  order by e.created_at asc
  limit 1
)
and not exists (
  select 1 from public.establecimientos
  where usuario = 'adminabg' or usuario_manipulador = 'insucoalbertoblestgana'
);

-- Limpia registros de prueba antiguos sin mediciones asociadas
delete from public.establecimientos e
where e.usuario in ('institutodecomercioinsucoabg', 'insucoadministracion', 'comeducadministracion')
  and not exists (
    select 1 from public.mediciones m where m.establecimiento_id = e.id
  );

-- Seed oficial: 19 liceos de la Red Educacional Comeduc (Web Admin + App Manipuladores)
insert into public.establecimientos (
  nombre,
  usuario,
  password_hash,
  usuario_manipulador,
  password_manipulador_hash,
  correo_contacto,
  tipo
) values
  (
    'Instituto Comercial Bicentenario de Viña del Mar',
    'adminabg',
    extensions.crypt('comeducabg.cl2026', extensions.gen_salt('bf')),
    'insucoalbertoblestgana',
    extensions.crypt('comeducABG', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Comercial Luis Correa Prieto',
    'adminlcp',
    extensions.crypt('comeduclcp.cl2026', extensions.gen_salt('bf')),
    'lcluiscorreapietro',
    extensions.crypt('comeducLCP', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Instituto Tecnológico y Comercial Recoleta',
    'adminrecoleta',
    extensions.crypt('comeducrecoleta.cl2026', extensions.gen_salt('bf')),
    'intecorecoleta',
    extensions.crypt('comeducRECOLETA', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Colegio Técnico Profesional Achiga-Comeduc',
    'adminachiga',
    extensions.crypt('comeducachiga.cl2026', extensions.gen_salt('bf')),
    'ctachiga',
    extensions.crypt('comeducACHIGA', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Técnico Clelia Clavel Dinator',
    'admincleviaclavel',
    extensions.crypt('comeduccleliaclavel.cl2026', extensions.gen_salt('bf')),
    'ltcleviaclavel',
    extensions.crypt('comeducCLELIACLAVEL', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Bicentenario Joaquín Vera Morales Insuco2',
    'adminjvm',
    extensions.crypt('comeducjvm.cl2026', extensions.gen_salt('bf')),
    'insucojoaquinveramorales',
    extensions.crypt('comeducJVM', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Técnico José María Narbona Cortés',
    'adminjmnc',
    extensions.crypt('comeducjmnc.cl2026', extensions.gen_salt('bf')),
    'ltjosemarianarbonacortes',
    extensions.crypt('comeducJMNC', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Comercial Gabriel González Videla',
    'adminggv',
    extensions.crypt('comeducggv.cl2026', extensions.gen_salt('bf')),
    'lcgabrielgonzalezvidela',
    extensions.crypt('comeducGGV', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Bicentenario Comercial Molina Lavín',
    'adminml',
    extensions.crypt('comeducml.cl2026', extensions.gen_salt('bf')),
    'lcmolinalavin',
    extensions.crypt('comeducML', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Comercial Vate Vicente Huidobro',
    'adminvvh',
    extensions.crypt('comeducvvh.cl2026', extensions.gen_salt('bf')),
    'lcvatevicentehuidobro',
    extensions.crypt('comeducVVH', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Instituto Comercial Padre Alberto Hurtado',
    'adminpah',
    extensions.crypt('comeducpah.cl2026', extensions.gen_salt('bf')),
    'lcpadrealbertohurtado',
    extensions.crypt('comeducPAH', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Técnico Clotario Blest Riffo',
    'admincbr',
    extensions.crypt('comeduccbr.cl2026', extensions.gen_salt('bf')),
    'ltclotarioblestriffo',
    extensions.crypt('comeducCBR', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Comercial de San Bernardo',
    'adminsanbernardo',
    extensions.crypt('comeducsanbernardo.cl2026', extensions.gen_salt('bf')),
    'lcsanbernardo',
    extensions.crypt('comeducSANBERNARDO', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Colegio Comercial de Peñaflor',
    'adminpeñaflor',
    extensions.crypt('comeducpeñaflor.cl2026', extensions.gen_salt('bf')),
    'ccpeñaflor',
    extensions.crypt('comeducPEÑAFLOR', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Bicentenario Técnico de Rancagua',
    'adminrancagua',
    extensions.crypt('comeducrancagua.cl2026', extensions.gen_salt('bf')),
    'ltrancagua',
    extensions.crypt('comeducRANCAGUA', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Técnico Bicentenario Felisa Tolup',
    'adminft',
    extensions.crypt('comeducft.cl2026', extensions.gen_salt('bf')),
    'ltfelisatolup',
    extensions.crypt('comeducFT', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Instituto Politécnico Bicentenario Juan Terrier Dailly',
    'adminjtd',
    extensions.crypt('comeducjtd.cl2026', extensions.gen_salt('bf')),
    'lpjuanterrierdailly',
    extensions.crypt('comeducJTD', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Liceo Bicentenario de Excelencia INSUCO Chillán',
    'adminchillan',
    extensions.crypt('comeducchillan.cl2026', extensions.gen_salt('bf')),
    'insucochillan',
    extensions.crypt('comeducCHILLAN', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  ),
  (
    'Instituto Técnico Mabel Condemarín Grimberg',
    'adminmcg',
    extensions.crypt('comeducmcg.cl2026', extensions.gen_salt('bf')),
    'ltmabelcondemaringrimberg',
    extensions.crypt('comeducMCG', extensions.gen_salt('bf')),
    null,
    'establecimiento'
  )
on conflict (usuario) do update set
  nombre = excluded.nombre,
  password_hash = excluded.password_hash,
  usuario_manipulador = excluded.usuario_manipulador,
  password_manipulador_hash = excluded.password_manipulador_hash;

notify pgrst, 'reload schema';

-- ============================================================================
-- PLANTILLA PARA QUE EL EQUIPO MEEP CREE NUEVAS INSTITUCIONES APROBADAS:
-- (Ejecutar en SQL Editor cuando aprueben una solicitud de solicitudes_integracion)
--
-- insert into public.establecimientos (
--   nombre, usuario, password_hash, usuario_manipulador, password_manipulador_hash, correo_contacto, tipo
-- ) values (
--   'Nombre Nueva Institución',
--   'usuarioadmin',
--   extensions.crypt('clave_admin', extensions.gen_salt('bf')),
--   'manipuladorainstitucion',
--   extensions.crypt('clave_manipuladores', extensions.gen_salt('bf')),
--   'correo@institucion.cl',
--   'establecimiento'
-- );
-- ============================================================================
