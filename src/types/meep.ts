export type FoodKey = 'leche' | 'yogur' | 'queso' | string;

export type MeasurementStatus = 'in' | 'out' | 'na';

export type MeasurementSubstatus =
  | 'buen_estado'
  | 'acido'
  | 'contaminado'
  | 'no_interpretable';

export type LedColor = 'verde' | 'rojo' | 'apagado';

export type EstablishmentType = 'establecimiento' | 'casino_junaeb' | 'pyme';

export interface FoodDefinition {
  clave: FoodKey;
  nombre: string;
  icono: string;
  ph_min: number | null;
  ph_max: number | null;
  rango_acido_max: number | null;
  rango_contaminado_min: number | null;
  validado: boolean;
  activo: boolean;
  orden: number;
}

export interface EstablishmentProfile {
  id: string;
  nombre: string;
  usuario: string;
  correo_contacto: string | null;
  tipo: EstablishmentType;
  created_at?: string;
}

export interface MeasurementRecord {
  id: string;
  establecimiento_id?: string;
  alimento_clave: FoodKey;
  ph: number | null;
  temperatura: number | null;
  estado: MeasurementStatus;
  subestado: MeasurementSubstatus;
  led_color: LedColor;
  motivo: string | null;
  manipulador: string | null;
  dispositivo_codigo: string | null;
  origen: 'bluetooth' | 'demo';
  medido_at: string;
}

export interface BleConfig {
  namePrefix: string;
  serviceUuid: string;
  characteristicUuid: string;
}

export type BluetoothConnectionState =
  | 'off'
  | 'connecting'
  | 'connected'
  | 'error';
