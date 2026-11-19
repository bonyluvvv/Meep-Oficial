import type {
  FoodDefinition,
  FoodKey,
  LedColor,
  MeasurementStatus,
  MeasurementSubstatus,
} from '../types/meep';

export const DEFAULT_ALIMENTOS: FoodDefinition[] = [
  {
    clave: 'leche',
    nombre: 'Leche',
    icono: 'leche',
    ph_min: 6.6,
    ph_max: 6.8,
    rango_acido_max: 6.5,
    rango_contaminado_min: 6.9,
    validado: false,
    activo: true,
    orden: 1,
  },
  {
    clave: 'yogur',
    nombre: 'Yogur',
    icono: 'yogur',
    ph_min: 4.0,
    ph_max: 4.5,
    rango_acido_max: 3.8,
    rango_contaminado_min: 4.6,
    validado: false,
    activo: true,
    orden: 2,
  },
  {
    clave: 'queso',
    nombre: 'Queso',
    icono: 'queso',
    ph_min: 5.2,
    ph_max: 5.4,
    rango_acido_max: 5.0,
    rango_contaminado_min: null,
    validado: false,
    activo: true,
    orden: 3,
  },
];

export const NOTA_PH =
  'Una medición de pH dentro del rango esperado apoya el control preventivo, pero no reemplaza los protocolos de higiene ni certifica ausencia total de patógenos.';

export const ESTADO_TITULO: Record<MeasurementStatus, string> = {
  in: 'pH dentro del rango esperado',
  out: 'pH fuera del rango esperado',
  na: 'No se pudo interpretar la medición',
};

export const ESTADO_CORTO: Record<MeasurementStatus, string> = {
  in: 'Dentro del rango',
  out: 'Fuera del rango',
  na: 'No interpretable',
};

export const SUBESTADO_LABEL: Record<MeasurementSubstatus, string> = {
  buen_estado: 'En buen estado (LED verde)',
  acido: 'Alteración ácida detectada (LED rojo)',
  contaminado: 'Posible contaminación / alcalinidad (LED rojo)',
  no_interpretable: 'Lectura no interpretable',
};

export function formatPh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return Number(value).toFixed(2).replace('.', ',');
}

export function formatRango(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min === null || min === undefined || max === null || max === undefined) {
    return null;
  }
  return `${formatPh(min)} – ${formatPh(max)}`;
}

export function formatFechaHora(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function interpretarPh(
  clave: FoodKey,
  ph: number | null | undefined,
  alimentos: FoodDefinition[],
): {
  estado: MeasurementStatus;
  subestado: MeasurementSubstatus;
  led_color: LedColor;
  motivo: string;
} {
  const alimento = alimentos.find((a) => a.clave === clave);

  if (
    ph === null ||
    ph === undefined ||
    !Number.isFinite(ph) ||
    ph < 0 ||
    ph > 14
  ) {
    return {
      estado: 'na',
      subestado: 'no_interpretable',
      led_color: 'apagado',
      motivo: 'La lectura llegó incompleta o fuera de la escala de pH (0 a 14).',
    };
  }

  if (
    !alimento ||
    alimento.ph_min === null ||
    alimento.ph_max === null
  ) {
    return {
      estado: 'na',
      subestado: 'no_interpretable',
      led_color: 'apagado',
      motivo:
        'Este alimento aún no tiene un rango de referencia configurado.',
    };
  }

  if (ph >= alimento.ph_min && ph <= alimento.ph_max) {
    return {
      estado: 'in',
      subestado: 'buen_estado',
      led_color: 'verde',
      motivo:
        'La lectura se encuentra dentro del rango de referencia para este producto lácteo.',
    };
  }

  if (
    alimento.rango_acido_max !== null &&
    ph < alimento.ph_min
  ) {
    return {
      estado: 'out',
      subestado: 'acido',
      led_color: 'rojo',
      motivo:
        ph < alimento.rango_acido_max
          ? 'Valor ácido por debajo del umbral esperado. Revisa la cadena de frío y no sirvas el alimento sin verificación.'
          : 'Valor levemente por debajo del rango esperado. Verifica conservación y fecha de vencimiento.',
    };
  }

  return {
    estado: 'out',
    subestado: 'contaminado',
    led_color: 'rojo',
    motivo:
      'Valor por encima del rango esperado (posible alteración o contaminación). Revisa conservación y aplica protocolo de seguridad alimentaria.',
  };
}
