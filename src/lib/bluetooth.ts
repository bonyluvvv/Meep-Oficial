import type {BleConfig} from '../types/meep';

const BLE_CONFIG_KEY = 'meep.ble.config.v1';

export const DEFAULT_BLE_CONFIG: BleConfig = {
  namePrefix: 'MEEP',
  // UUIDs estándar recomendados para Arduino Nano ESP32 BLE (editables en Ayuda -> Configuración BLE)
  serviceUuid: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  characteristicUuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
};

export function loadBleConfig(): BleConfig {
  try {
    const raw = localStorage.getItem(BLE_CONFIG_KEY);
    if (!raw) return DEFAULT_BLE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BleConfig>;
    return {
      namePrefix: parsed.namePrefix?.trim() || DEFAULT_BLE_CONFIG.namePrefix,
      serviceUuid:
        parsed.serviceUuid?.trim().toLowerCase() ||
        DEFAULT_BLE_CONFIG.serviceUuid,
      characteristicUuid:
        parsed.characteristicUuid?.trim().toLowerCase() ||
        DEFAULT_BLE_CONFIG.characteristicUuid,
    };
  } catch {
    return DEFAULT_BLE_CONFIG;
  }
}

export function saveBleConfig(config: BleConfig): void {
  localStorage.setItem(
    BLE_CONFIG_KEY,
    JSON.stringify({
      namePrefix: config.namePrefix.trim() || DEFAULT_BLE_CONFIG.namePrefix,
      serviceUuid: config.serviceUuid.trim().toLowerCase(),
      characteristicUuid: config.characteristicUuid.trim().toLowerCase(),
    }),
  );
}

export interface BleReading {
  ph: number | null;
  temperatura: number | null;
  rawText: string;
}

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof (navigator as Navigator & {bluetooth?: unknown}).bluetooth === 'object'
  );
}

export function parseBleDataView(value: DataView): BleReading {
  const bytes = new Uint8Array(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  );
  const text = new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();

  // 1. Intenta formato JSON: {"ph": 6.72, "temp": 4.2}
  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text) as {
        ph?: unknown;
        pH?: unknown;
        temp?: unknown;
        temperatura?: unknown;
      };
      const rawPh = json.ph ?? json.pH;
      const rawTemp = json.temp ?? json.temperatura;
      const ph = rawPh !== undefined ? Number(rawPh) : null;
      const temperatura = rawTemp !== undefined ? Number(rawTemp) : null;
      return {
        ph: ph !== null && Number.isFinite(ph) ? Number(ph.toFixed(2)) : null,
        temperatura:
          temperatura !== null && Number.isFinite(temperatura)
            ? Number(temperatura.toFixed(1))
            : null,
        rawText: text,
      };
    } catch {
      // sigue con otros formatos
    }
  }

  // 2. Intenta formato texto: "6.72" o "6.72,4.5" o "PH:6.72 T:4.5"
  const normalized = text.replace(/,/g, '.');
  const phMatch =
    normalized.match(/ph\s*[:=]\s*(-?\d+(?:\.\d+)?)/i) ||
    normalized.match(/^(-?\d+(?:\.\d+)?)$/);
  const tempMatch = normalized.match(/t(?:emp(?:eratura)?)?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);

  if (phMatch) {
    const ph = Number(phMatch[1]);
    const temperatura = tempMatch ? Number(tempMatch[1]) : null;
    if (Number.isFinite(ph) && ph >= 0 && ph <= 14) {
      return {
        ph: Number(ph.toFixed(2)),
        temperatura:
          temperatura !== null && Number.isFinite(temperatura)
            ? Number(temperatura.toFixed(1))
            : null,
        rawText: text,
      };
    }
  }

  // 3. Formato separado por coma decimal o pares "6.72;4.5"
  const parts = text.split(/[;|]/).map((p) => Number(p.trim().replace(',', '.')));
  if (parts.length >= 1 && Number.isFinite(parts[0]) && parts[0] >= 0 && parts[0] <= 14) {
    return {
      ph: Number(parts[0].toFixed(2)),
      temperatura:
        parts.length >= 2 && Number.isFinite(parts[1])
          ? Number(parts[1].toFixed(1))
          : null,
      rawText: text,
    };
  }

  // 4. Fallback binario IEEE-754 float32 little-endian (4 bytes desde ESP32)
  if (value.byteLength === 4) {
    const floatVal = value.getFloat32(0, true);
    if (Number.isFinite(floatVal) && floatVal >= 0 && floatVal <= 14) {
      return {
        ph: Number(floatVal.toFixed(2)),
        temperatura: null,
        rawText: floatVal.toFixed(2),
      };
    }
  }

  return {ph: null, temperatura: null, rawText: text};
}

// Tipos mínimos para Web Bluetooth API
interface BluetoothRemoteGATTCharacteristicLike extends EventTarget {
  value?: DataView;
  properties: {
    read: boolean;
    notify: boolean;
    indicate: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
  };
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTServiceLike {
  uuid: string;
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTServiceLike>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTServiceLike[]>;
}

interface BluetoothDeviceLike extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth: {
    requestDevice(options: {
      filters?: Array<{namePrefix?: string; services?: string[]}>;
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }): Promise<BluetoothDeviceLike>;
  };
}

class MeepBluetoothClient {
  private device: BluetoothDeviceLike | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private lastReading: BleReading | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onReadingCallback: ((reading: BleReading) => void) | null = null;

  public getDeviceName(): string | null {
    return this.device?.name || (this.device ? 'Dispositivo MEEP' : null);
  }

  public isConnected(): boolean {
    return Boolean(this.device?.gatt?.connected && this.characteristic);
  }

  public getLastReading(): BleReading | null {
    return this.lastReading;
  }

  public setOnDisconnect(cb: (() => void) | null): void {
    this.onDisconnectCallback = cb;
  }

  public setOnReading(cb: ((reading: BleReading) => void) | null): void {
    this.onReadingCallback = cb;
  }

  private handleCharacteristicChanged = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristicLike;
    if (!target.value) return;
    const parsed = parseBleDataView(target.value);
    if (parsed.ph !== null) {
      this.lastReading = parsed;
      this.onReadingCallback?.(parsed);
    }
  };

  private handleGattDisconnected = () => {
    this.characteristic = null;
    this.onDisconnectCallback?.();
  };

  public async connect(options?: {
    scanAllDevices?: boolean;
    config?: BleConfig;
  }): Promise<{deviceName: string}> {
    if (!isWebBluetoothSupported()) {
      throw new Error(
        'Tu navegador no permite Bluetooth directo. Abre MEEP en Google Chrome (Android, Windows o macOS) o Bluefy (iOS).',
      );
    }

    const cfg = options?.config || loadBleConfig();
    const bt = (navigator as NavigatorWithBluetooth).bluetooth;

    const requestOptions = options?.scanAllDevices
      ? {
          acceptAllDevices: true,
          optionalServices: [cfg.serviceUuid, 'battery_service'],
        }
      : {
          filters: [
            {namePrefix: cfg.namePrefix},
            {services: [cfg.serviceUuid]},
          ],
          optionalServices: [cfg.serviceUuid, 'battery_service'],
        };

    const device = await bt.requestDevice(requestOptions);
    if (!device.gatt) {
      throw new Error('El dispositivo seleccionado no soporta Bluetooth LE (GATT).');
    }

    this.device = device;
    device.addEventListener('gattserverdisconnected', this.handleGattDisconnected);

    const server = await device.gatt.connect();

    // Intenta el servicio configurado primero; si no coincide, busca un servicio con lectura/notificación
    let service: BluetoothRemoteGATTServiceLike | null = null;
    try {
      service = await server.getPrimaryService(cfg.serviceUuid);
    } catch {
      const services = await server.getPrimaryServices();
      if (services.length > 0) {
        service = services[0];
      }
    }

    if (!service) {
      throw new Error(
        'No se encontró el servicio de datos en el dispositivo MEEP. Revisa el firmware ESP32 o los UUIDs en Ayuda.',
      );
    }

    let char: BluetoothRemoteGATTCharacteristicLike | null = null;
    try {
      char = await service.getCharacteristic(cfg.characteristicUuid);
    } catch {
      const chars = await service.getCharacteristics();
      char =
        chars.find((c) => c.properties.notify || c.properties.read) ||
        chars[0] ||
        null;
    }

    if (!char) {
      throw new Error(
        'No se encontró la característica de lectura de pH en el sensor MEEP.',
      );
    }

    this.characteristic = char;

    if (char.properties.notify || char.properties.indicate) {
      await char.startNotifications();
      char.addEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicChanged,
      );
    }

    if (char.properties.read) {
      try {
        const val = await char.readValue();
        const parsed = parseBleDataView(val);
        if (parsed.ph !== null) {
          this.lastReading = parsed;
          this.onReadingCallback?.(parsed);
        }
      } catch {
        // Algunos sensores solo emiten por notificación
      }
    }

    return {
      deviceName: device.name || 'Dispositivo MEEP',
    };
  }

  public async readMeasurement(timeoutMs = 5000): Promise<BleReading> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error('MEEP no está conectado por Bluetooth.');
    }

    const char = this.characteristic;

    // Intenta lectura directa si el ESP32 soporta Read
    if (char.properties.read) {
      try {
        const view = await char.readValue();
        const parsed = parseBleDataView(view);
        if (parsed.ph !== null) {
          this.lastReading = parsed;
          return parsed;
        }
      } catch {
        // Continúa esperando notificación
      }
    }

    // Si soporta Notify, espera la siguiente lectura entrante o usa la última recibida en los últimos 3s
    const current = this.lastReading;
    return new Promise<BleReading>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        char.removeEventListener('characteristicvaluechanged', onNotify);
        if (current && current.ph !== null) {
          resolve(current);
        } else {
          reject(
            new Error(
              'No llegó una lectura válida desde la sonda. Verifica el contacto con la muestra e intenta nuevamente.',
            ),
          );
        }
      }, timeoutMs);

      const onNotify = (ev: Event) => {
        const t = ev.target as BluetoothRemoteGATTCharacteristicLike;
        if (!t.value || settled) return;
        const parsed = parseBleDataView(t.value);
        if (parsed.ph !== null) {
          settled = true;
          window.clearTimeout(timer);
          char.removeEventListener('characteristicvaluechanged', onNotify);
          this.lastReading = parsed;
          resolve(parsed);
        }
      };

      char.addEventListener('characteristicvaluechanged', onNotify);
    });
  }

  public disconnect(): void {
    if (this.characteristic) {
      try {
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleCharacteristicChanged,
        );
      } catch {
        // ignore
      }
    }
    if (this.device) {
      try {
        this.device.removeEventListener(
          'gattserverdisconnected',
          this.handleGattDisconnected,
        );
        if (this.device.gatt?.connected) {
          this.device.gatt.disconnect();
        }
      } catch {
        // ignore
      }
    }
    this.characteristic = null;
    this.device = null;
    this.lastReading = null;
  }
}

export const meepBluetooth = new MeepBluetoothClient();
