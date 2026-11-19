import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {
  EstablishmentProfile,
  EstablishmentType,
  FoodDefinition,
  MeasurementRecord,
} from '../types/meep';
import {DEFAULT_ALIMENTOS} from './meepCore';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('tu-proyecto.supabase.co');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function normalizeUsuario(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function buildInternalAuthEmail(usuario: string): string {
  return `${normalizeUsuario(usuario)}@meep.pemi`;
}

export async function getEstablishmentProfile(
  userId: string,
): Promise<EstablishmentProfile | null> {
  if (!supabase) return null;
  const {data, error} = await supabase
    .from('establecimientos')
    .select('id, nombre, usuario, correo_contacto, tipo, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data as EstablishmentProfile | null;
}

export async function signInEstablishment(
  identificador: string,
  password: string,
): Promise<{profile: EstablishmentProfile; userId: string}> {
  if (!supabase) {
    throw new Error(
      'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el proyecto.',
    );
  }

  const clean = identificador.trim().toLowerCase();
  if (!clean || !password) {
    throw new Error('Ingresa tu usuario y contraseña.');
  }

  let authEmail = clean.includes('@') ? clean : buildInternalAuthEmail(clean);

  // Resuelve el correo interno asociado tanto si ingresa usuario como correo_contacto
  try {
    const {data: resolvedEmail} = await supabase.rpc('resolver_email_login', {
      p_identificador: clean,
    });

    if (typeof resolvedEmail === 'string' && resolvedEmail.includes('@')) {
      authEmail = resolvedEmail;
    }
  } catch {
    // Si la función RPC aún no existe en Supabase, continúa con el email construido
  }

  const {data, error} = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (error || !data.user) {
    const msg = error?.message || '';
    const lower = msg.toLowerCase();
    if (lower.includes('email not confirmed')) {
      throw new Error(
        'Supabase requiere confirmar el correo. Ve a Authentication -> Providers -> Email y desactiva "Confirm email", o confirma el usuario en Authentication -> Users.',
      );
    }
    if (lower.includes('database error')) {
      throw new Error(
        'Error interno en el usuario creado por SQL. Elimina el usuario en Authentication -> Users y créalo desde la pestaña "Registrarse" o "Add user".',
      );
    }
    if (
      lower.includes('invalid api key') ||
      lower.includes('apikey') ||
      lower.includes('failed to fetch')
    ) {
      throw new Error(
        `No se pudo conectar con Supabase (${msg}). Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Secrets.`,
      );
    }
    throw new Error(
      'Usuario o contraseña incorrectos. Verifica tus datos o usa la pestaña "Registrarse".',
    );
  }

  const profile = await getEstablishmentProfile(data.user.id);
  if (!profile) {
    return {
      userId: data.user.id,
      profile: {
        id: data.user.id,
        nombre:
          (data.user.user_metadata?.nombre as string) ||
          clean.split('@')[0],
        usuario:
          (data.user.user_metadata?.usuario as string) ||
          normalizeUsuario(clean.split('@')[0]),
        correo_contacto:
          (data.user.user_metadata?.correo_contacto as string) || null,
        tipo:
          ((data.user.user_metadata?.tipo as EstablishmentType) ||
            'establecimiento'),
      },
    };
  }

  return {userId: data.user.id, profile};
}

export async function registerEstablishment(params: {
  nombre: string;
  usuario: string;
  tipo: EstablishmentType;
  correoContacto?: string;
  password: string;
}): Promise<{profile: EstablishmentProfile; userId: string}> {
  if (!supabase) {
    throw new Error(
      'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el proyecto.',
    );
  }

  const nombre = params.nombre.trim();
  const usuarioClean = normalizeUsuario(params.usuario);
  const correoContacto = params.correoContacto?.trim() || '';

  if (nombre.length < 2) {
    throw new Error('Ingresa el nombre completo del establecimiento.');
  }
  if (!/^[a-z0-9._-]{3,50}$/.test(usuarioClean)) {
    throw new Error(
      'El usuario debe tener entre 3 y 50 caracteres (solo letras, números, punto, guion o guion bajo).',
    );
  }
  if (params.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  const {data: disponible, error: checkError} = await supabase.rpc(
    'usuario_disponible',
    {p_usuario: usuarioClean},
  );

  if (checkError) {
    const lower = checkError.message.toLowerCase();
    const isMissingFunction =
      checkError.code === 'PGRST202' ||
      lower.includes('could not find the function') ||
      lower.includes('does not exist');

    if (!isMissingFunction) {
      throw new Error(
        `No se pudo verificar el usuario en Supabase: ${checkError.message}`,
      );
    }
    // Si solo falta la función RPC usuario_disponible, continuamos con signUp
    // (Supabase Auth validará si el correo interno ya existe).
  } else if (disponible === false) {
    throw new Error(
      `El usuario "${usuarioClean}" ya está registrado. Intenta iniciar sesión.`,
    );
  }

  const internalEmail = buildInternalAuthEmail(usuarioClean);

  const {data, error} = await supabase.auth.signUp({
    email: internalEmail,
    password: params.password,
    options: {
      data: {
        nombre,
        usuario: usuarioClean,
        correo_contacto: correoContacto || null,
        tipo: params.tipo,
      },
    },
  });

  if (error || !data.user) {
    const msg = error?.message || '';
    const lower = msg.toLowerCase();
    if (
      lower.includes('already registered') ||
      lower.includes('already exists')
    ) {
      throw new Error(
        `El usuario "${usuarioClean}" ya está registrado. Cambia a "Iniciar sesión".`,
      );
    }
    if (lower.includes('database error saving new user')) {
      throw new Error(
        'Falta ejecutar supabase/schema.sql en el SQL Editor de Supabase para crear la tabla "establecimientos" y su trigger.',
      );
    }
    throw new Error(
      msg || 'No se pudo completar el registro del establecimiento.',
    );
  }

  if (!data.session) {
    throw new Error(
      'Tu cuenta se creó, pero Supabase tiene activada la confirmación por correo. Desactiva "Confirm email" en Authentication -> Providers -> Email.',
    );
  }

  const profile = (await getEstablishmentProfile(data.user.id)) || {
    id: data.user.id,
    nombre,
    usuario: usuarioClean,
    correo_contacto: correoContacto || null,
    tipo: params.tipo,
  };

  return {userId: data.user.id, profile};
}

export async function signOutEstablishment(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchAlimentos(): Promise<FoodDefinition[]> {
  if (!supabase) return DEFAULT_ALIMENTOS;
  const {data, error} = await supabase
    .from('alimentos')
    .select('*')
    .eq('activo', true)
    .order('orden', {ascending: true});

  if (error || !data || data.length === 0) {
    return DEFAULT_ALIMENTOS;
  }
  return data.map((row) => ({
    clave: row.clave,
    nombre: row.nombre,
    icono: row.icono,
    ph_min: row.ph_min !== null ? Number(row.ph_min) : null,
    ph_max: row.ph_max !== null ? Number(row.ph_max) : null,
    rango_acido_max:
      row.rango_acido_max !== null ? Number(row.rango_acido_max) : null,
    rango_contaminado_min:
      row.rango_contaminado_min !== null
        ? Number(row.rango_contaminado_min)
        : null,
    validado: Boolean(row.validado),
    activo: Boolean(row.activo),
    orden: Number(row.orden ?? 0),
  }));
}

export async function fetchMediciones(
  establecimientoId: string,
): Promise<MeasurementRecord[]> {
  if (!supabase) return [];
  const {data, error} = await supabase
    .from('mediciones')
    .select('*')
    .eq('establecimiento_id', establecimientoId)
    .order('medido_at', {ascending: false})
    .limit(200);

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo cargar el historial.');
  }

  return data.map((row) => ({
    id: row.id,
    establecimiento_id: row.establecimiento_id,
    alimento_clave: row.alimento_clave,
    ph: row.ph !== null ? Number(row.ph) : null,
    temperatura: row.temperatura !== null ? Number(row.temperatura) : null,
    estado: row.estado,
    subestado: row.subestado,
    led_color: row.led_color,
    motivo: row.motivo,
    manipulador: row.manipulador,
    dispositivo_codigo: row.dispositivo_codigo,
    origen: row.origen,
    medido_at: row.medido_at,
  }));
}

export async function insertMedicion(
  payload: Omit<MeasurementRecord, 'id'>,
): Promise<MeasurementRecord> {
  if (!supabase) {
    throw new Error('Supabase no configurado.');
  }

  const {data, error} = await supabase
    .from('mediciones')
    .insert({
      establecimiento_id: payload.establecimiento_id,
      alimento_clave: payload.alimento_clave,
      ph: payload.ph,
      temperatura: payload.temperatura,
      estado: payload.estado,
      subestado: payload.subestado,
      led_color: payload.led_color,
      motivo: payload.motivo,
      manipulador: payload.manipulador,
      dispositivo_codigo: payload.dispositivo_codigo,
      origen: payload.origen,
      medido_at: payload.medido_at,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo guardar la medición.');
  }

  return {
    id: data.id,
    establecimiento_id: data.establecimiento_id,
    alimento_clave: data.alimento_clave,
    ph: data.ph !== null ? Number(data.ph) : null,
    temperatura: data.temperatura !== null ? Number(data.temperatura) : null,
    estado: data.estado,
    subestado: data.subestado,
    led_color: data.led_color,
    motivo: data.motivo,
    manipulador: data.manipulador,
    dispositivo_codigo: data.dispositivo_codigo,
    origen: data.origen,
    medido_at: data.medido_at,
  };
}

export async function deleteMedicion(id: string): Promise<void> {
  if (!supabase) return;
  const {error} = await supabase.from('mediciones').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}
