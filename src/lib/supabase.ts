import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {
  EstablishmentProfile,
  EstablishmentType,
  FoodDefinition,
  MeasurementRecord,
} from '../types/meep';
import {DEFAULT_ALIMENTOS} from './meepCore';

const SESSION_TOKEN_KEY = 'meep.session.token.v1';

function normalizeSupabaseUrl(raw: string | undefined): string {
  const trimmed = (raw?.trim() || '').replace(/^["']+|["']+$/g, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

const supabaseUrl = normalizeSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
);
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    ?.trim()
    .replace(/^["']+|["']+$/g, '') || '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('tu-proyecto.supabase.co');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function mapRpcError(message: string, usuarioClean?: string): string {
  const upper = message.toUpperCase();
  const lower = message.toLowerCase();

  if (upper.includes('CREDENCIALES_INVALIDAS')) {
    return 'Usuario o contraseña incorrectos. Verifica tus datos o crea tu cuenta en "Registrarse".';
  }
  if (upper.includes('USUARIO_DUPLICADO')) {
    return `El usuario "${usuarioClean || ''}" ya está registrado. Cambia a "Iniciar sesión".`;
  }
  if (upper.includes('NOMBRE_INVALIDO')) {
    return 'Ingresa el nombre completo del establecimiento.';
  }
  if (upper.includes('USUARIO_INVALIDO')) {
    return 'El usuario debe tener entre 3 y 50 caracteres (solo letras, números, punto, guion o guion bajo).';
  }
  if (upper.includes('PASSWORD_CORTA')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (upper.includes('SESION_INVALIDA')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión con el usuario de tu establecimiento.';
  }
  if (
    lower.includes('could not find the function') ||
    lower.includes('pgrst202') ||
    lower.includes('does not exist')
  ) {
    return 'Falta ejecutar el archivo supabase/schema.sql actualizado en el SQL Editor de Supabase.';
  }
  if (
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('failed to fetch')
  ) {
    return `No se pudo conectar con Supabase (${message}). Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Secrets.`;
  }
  return message || 'No se pudo completar la operación en Supabase.';
}

export async function restoreSession(): Promise<EstablishmentProfile | null> {
  if (!supabase) return null;
  const token = getStoredToken();
  if (!token) return null;

  const {data, error} = await supabase.rpc('meep_perfil', {
    p_token: token,
  });

  if (error || !data) {
    if (!error) {
      setStoredToken(null);
    }
    return null;
  }

  return data as EstablishmentProfile;
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

  const {data, error} = await supabase.rpc('meep_login', {
    p_identificador: clean,
    p_password: password,
  });

  if (error || !data) {
    throw new Error(mapRpcError(error?.message || 'CREDENCIALES_INVALIDAS'));
  }

  const res = data as {token: string; profile: EstablishmentProfile};
  setStoredToken(res.token);
  return {userId: res.profile.id, profile: res.profile};
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

  const {data, error} = await supabase.rpc('meep_registrar', {
    p_nombre: nombre,
    p_usuario: usuarioClean,
    p_tipo: params.tipo,
    p_correo_contacto: correoContacto || null,
    p_password: params.password,
  });

  if (error || !data) {
    throw new Error(mapRpcError(error?.message || '', usuarioClean));
  }

  const res = data as {token: string; profile: EstablishmentProfile};
  setStoredToken(res.token);
  return {userId: res.profile.id, profile: res.profile};
}

export async function signOutEstablishment(): Promise<void> {
  const token = getStoredToken();
  setStoredToken(null);
  if (!supabase || !token) return;
  try {
    await supabase.rpc('meep_logout', {p_token: token});
  } catch {
    // ignore logout cleanup errors
  }
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

interface RawMedicionRow {
  id: string;
  establecimiento_id: string;
  alimento_clave: string;
  ph: number | string | null;
  temperatura: number | string | null;
  estado: MeasurementRecord['estado'];
  subestado: MeasurementRecord['subestado'];
  led_color: MeasurementRecord['led_color'];
  motivo: string | null;
  manipulador: string | null;
  dispositivo_codigo: string | null;
  origen: MeasurementRecord['origen'];
  medido_at: string;
}

function mapMedicion(row: RawMedicionRow): MeasurementRecord {
  return {
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
  };
}

export async function fetchMediciones(
  _establecimientoId: string,
): Promise<MeasurementRecord[]> {
  if (!supabase) return [];
  const token = getStoredToken();
  if (!token) return [];

  const {data, error} = await supabase.rpc('meep_listar_mediciones', {
    p_token: token,
  });

  if (error || !data) {
    throw new Error(
      mapRpcError(error?.message || 'No se pudo cargar el historial.'),
    );
  }

  return (data as RawMedicionRow[]).map(mapMedicion);
}

export async function insertMedicion(
  payload: Omit<MeasurementRecord, 'id'>,
): Promise<MeasurementRecord> {
  if (!supabase) {
    throw new Error('Supabase no configurado.');
  }
  const token = getStoredToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  const {data, error} = await supabase.rpc('meep_insertar_medicion', {
    p_token: token,
    p_alimento_clave: payload.alimento_clave,
    p_ph: payload.ph,
    p_temperatura: payload.temperatura,
    p_estado: payload.estado,
    p_subestado: payload.subestado,
    p_led_color: payload.led_color,
    p_motivo: payload.motivo,
    p_manipulador: payload.manipulador,
    p_dispositivo_codigo: payload.dispositivo_codigo,
    p_origen: payload.origen,
    p_medido_at: payload.medido_at,
  });

  if (error || !data) {
    throw new Error(
      mapRpcError(error?.message || 'No se pudo guardar la medición.'),
    );
  }

  return mapMedicion(data as RawMedicionRow);
}

export async function deleteMedicion(id: string): Promise<void> {
  if (!supabase) return;
  const token = getStoredToken();
  if (!token) return;

  const {error} = await supabase.rpc('meep_eliminar_medicion', {
    p_token: token,
    p_medicion_id: id,
  });

  if (error) {
    throw new Error(mapRpcError(error.message));
  }
}
