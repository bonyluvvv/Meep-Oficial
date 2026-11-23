import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {
  EstablishmentProfile,
  FoodDefinition,
  IntegrationRequestPayload,
  MeasurementRecord,
  MeepChannel,
} from '../types/meep';
import {DEFAULT_ALIMENTOS} from './meepCore';

const SESSION_TOKEN_KEYS: Record<MeepChannel, string> = {
  web: 'meep.session.token.web.v1',
  app: 'meep.session.token.app.v1',
};

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
    .replace(/[^a-zñ0-9._-]/g, '');
}

function getStoredToken(channel: MeepChannel): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEYS[channel]);
  } catch {
    return null;
  }
}

function setStoredToken(channel: MeepChannel, token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEYS[channel], token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEYS[channel]);
    }
  } catch {
    // ignore storage errors
  }
}

function mapRpcError(message: string): string {
  const upper = message.toUpperCase();
  const lower = message.toLowerCase();

  if (upper.includes('SOLO_APP_MANIPULADOR')) {
    return 'Ese usuario pertenece a manipuladores de alimentos. Úsalo en la App MEEP para medir.';
  }
  if (upper.includes('SOLO_WEB_ADMIN')) {
    return 'Esa cuenta es de administrador. Úsala en el Portal Web para revisar el historial.';
  }
  if (upper.includes('CREDENCIALES_INVALIDAS')) {
    return 'Usuario o contraseña incorrectos. Verifica las credenciales asignadas a tu institución.';
  }
  if (upper.includes('NOMBRE_INVALIDO')) {
    return 'Ingresa el nombre completo de la institución.';
  }
  if (upper.includes('CONTACTO_INVALIDO')) {
    return 'Ingresa el nombre de la persona encargada o de contacto.';
  }
  if (upper.includes('CORREO_INVALIDO')) {
    return 'Ingresa un correo electrónico válido para poder enviarte los datos de acceso.';
  }
  if (upper.includes('SESION_INVALIDA')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
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

export async function restoreSession(
  channel: MeepChannel,
): Promise<EstablishmentProfile | null> {
  if (!supabase) return null;
  const token = getStoredToken(channel);
  if (!token) return null;

  const {data, error} = await supabase.rpc('meep_perfil', {
    p_token: token,
  });

  if (error || !data) {
    if (!error) {
      setStoredToken(channel, null);
    }
    return null;
  }

  return data as EstablishmentProfile;
}

export async function signInEstablishment(
  identificador: string,
  password: string,
  channel: MeepChannel,
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
    p_canal: channel,
  });

  if (error || !data) {
    throw new Error(mapRpcError(error?.message || 'CREDENCIALES_INVALIDAS'));
  }

  const res = data as {token: string; profile: EstablishmentProfile};
  setStoredToken(channel, res.token);
  return {userId: res.profile.id, profile: res.profile};
}

export async function submitIntegrationRequest(
  payload: IntegrationRequestPayload,
): Promise<{id: string; estado: string}> {
  if (!supabase) {
    throw new Error(
      'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el proyecto.',
    );
  }

  const {data, error} = await supabase.rpc('meep_enviar_solicitud', {
    p_nombre_institucion: payload.nombreInstitucion.trim(),
    p_tipo: payload.tipo,
    p_nombre_contacto: payload.nombreContacto.trim(),
    p_correo_contacto: payload.correoContacto.trim().toLowerCase(),
    p_telefono: payload.telefono?.trim() || null,
    p_ciudad_comuna: payload.ciudadComuna?.trim() || null,
    p_observaciones: payload.observaciones?.trim() || null,
  });

  if (error || !data) {
    throw new Error(mapRpcError(error?.message || ''));
  }

  return data as {id: string; estado: string};
}

export async function signOutEstablishment(channel: MeepChannel): Promise<void> {
  const token = getStoredToken(channel);
  setStoredToken(channel, null);
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
  channel: MeepChannel,
): Promise<MeasurementRecord[]> {
  if (!supabase) return [];
  const token = getStoredToken(channel);
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
  channel: MeepChannel = 'app',
): Promise<MeasurementRecord> {
  if (!supabase) {
    throw new Error('Supabase no configurado.');
  }
  const token = getStoredToken(channel);
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

export async function deleteMedicion(
  id: string,
  channel: MeepChannel = 'app',
): Promise<void> {
  if (!supabase) return;
  const token = getStoredToken(channel);
  if (!token) return;

  const {error} = await supabase.rpc('meep_eliminar_medicion', {
    p_token: token,
    p_medicion_id: id,
  });

  if (error) {
    throw new Error(mapRpcError(error.message));
  }
}
