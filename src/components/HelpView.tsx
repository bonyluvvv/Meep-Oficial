import React, {useState} from 'react';
import {
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Cpu,
  HelpCircle,
  Info,
  ListChecks,
  PlugZap,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  DEFAULT_BLE_CONFIG,
  loadBleConfig,
  saveBleConfig,
} from '../lib/bluetooth';
import type {BleConfig} from '../types/meep';
import {ProbeIcon} from './MeepIcons';
import {PWAInstallButton} from './PWAInstallButton';

interface HelpViewProps {
  onGoMeasure: () => void;
}

export const HelpView: React.FC<HelpViewProps> = ({onGoMeasure}) => {
  const [bleConfig, setBleConfig] = useState<BleConfig>(() => loadBleConfig());
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveBle = (e: React.FormEvent) => {
    e.preventDefault();
    saveBleConfig(bleConfig);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleResetBle = () => {
    setBleConfig(DEFAULT_BLE_CONFIG);
    saveBleConfig(DEFAULT_BLE_CONFIG);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const StepList = ({items}: {items: string[]}) => (
    <ol className="space-y-2.5 text-sm text-[#263238]">
      {items.map((text, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white mt-0.5">
            {idx + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );

  const Section = ({
    icon,
    title,
    children,
    defaultOpen = false,
  }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) => (
    <details
      open={defaultOpen}
      className="group rounded-[18px] border border-[#E1E3DA] bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 font-extrabold text-[#17324D] min-h-[56px]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E0F1EF] text-[#2A9D8F]">
          {icon}
        </span>
        <span className="flex-1 text-[15px]">{title}</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#55656D] transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[#17324D]">
          Ayuda y conexión MEEP
        </h2>
      </div>

      <button
        type="button"
        onClick={onGoMeasure}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#17324D] px-5 py-3.5 text-base font-extrabold text-white hover:bg-[#10253a] min-h-[54px]"
      >
        <ProbeIcon size={22} />
        <span>Ir a medir</span>
      </button>

      <PWAInstallButton variant="card" />

      <Section
        icon={<Bluetooth className="h-5 w-5" />}
        title="Cómo conectar MEEP por Bluetooth"
        defaultOpen
      >
        <StepList
          items={[
            'Enciende tu dispositivo MEEP y comprueba que tenga batería cargada.',
            'Activa el Bluetooth (y la Ubicación si tu teléfono Android lo solicita).',
            'En la pestaña Medir, pulsa “Conectar MEEP” usando Google Chrome.',
            'Selecciona tu dispositivo MEEP en la lista emergente del navegador y espera la confirmación.',
          ]}
        />
      </Section>

      <Section
        icon={<ListChecks className="h-5 w-5" />}
        title="Cómo seleccionar un alimento"
      >
        <StepList
          items={[
            'Pulsa “Comenzar medición” en la pantalla principal.',
            'Selecciona la tarjeta del producto lácteo a evaluar (Leche, Yogur o Queso).',
            'Pulsa “Continuar” para pasar a la toma de muestra.',
          ]}
        />
      </Section>

      <Section
        icon={<ProbeIcon size={20} />}
        title="Cómo realizar una medición"
      >
        <StepList
          items={[
            'Separa una pequeña muestra limpia del alimento en un recipiente.',
            'Introduce la sonda de pH del MEEP hasta cubrir el sensor.',
            'Pulsa “Realizar medición” en la app para capturar la lectura desde el dispositivo.',
            'Revisa el resultado en pantalla y en la luz LED del equipo (verde: dentro de rango; rojo: fuera de rango).',
          ]}
        />
      </Section>

      <Section
        icon={<Sparkles className="h-5 w-5" />}
        title="Cómo limpiar y cuidar la sonda"
      >
        <StepList
          items={[
            'Enjuaga la sonda con agua limpia inmediatamente después de cada medición.',
            'Sécala suavemente con un paño limpio o papel absorbente sin frotar el bulbo.',
            'No la raspes ni la golpees con cubiertos u objetos duros.',
            'Coloca la tapa protectora y guarda el equipo en un lugar seco.',
          ]}
        />
      </Section>

      <Section
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Qué significa cada resultado"
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E7D32] mt-0.5" />
            <p>
              <strong className="text-[#2E7D32]">
                Dentro del rango esperado.
              </strong>{' '}
              La lectura coincide con los parámetros de referencia para ese
              producto lácteo (LED verde).
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#C62828] mt-0.5" />
            <p>
              <strong className="text-[#C62828]">
                Fuera del rango esperado.
              </strong>{' '}
              Indica posible acidez o contaminación (LED rojo). Revisa cadena de
              frío, fecha de vencimiento y protocolos de descarte.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <HelpCircle className="h-5 w-5 shrink-0 text-[#55656D] mt-0.5" />
            <p>
              <strong>No interpretable.</strong> La lectura llegó incompleta o
              fuera de escala (0 a 14). Limpia la sonda y repite la medición.
            </p>
          </div>
        </div>
      </Section>

      <Section
        icon={<PlugZap className="h-5 w-5" />}
        title="Qué hacer si falla la conexión Bluetooth"
      >
        <StepList
          items={[
            'Verifica que el MEEP esté encendido y con carga suficiente.',
            'Comprueba que el navegador sea Google Chrome (Android/PC/Mac) o Bluefy (iPhone).',
            'Acerca el teléfono a menos de 2 metros del medidor.',
            'Si no aparece con el nombre MEEP, utiliza “Buscar todos los dispositivos Bluetooth”.',
          ]}
        />
      </Section>

      <Section
        icon={<Info className="h-5 w-5" />}
        title="Alcance y seguridad alimentaria"
      >
        <p className="text-sm text-[#263238]">
          El pH detecta variaciones asociadas al deterioro en productos lácteos,
          pero <strong>no reemplaza</strong> los controles de higiene,
          refrigeración ni análisis microbiológicos cuando corresponda.
        </p>
      </Section>

      <Section
        icon={<Cpu className="h-5 w-5" />}
        title="Configuración técnica BLE (Arduino Nano ESP32)"
      >
        <form onSubmit={handleSaveBle} className="space-y-3 text-sm">
          <p className="text-xs text-[#55656D]">
            Ajusta estos valores solo si modificaste el nombre o los UUIDs GATT
            en el código del microcontrolador ESP32.
          </p>
          <div>
            <label
              htmlFor="ble-prefix"
              className="block text-xs font-bold text-[#17324D] mb-1"
            >
              Prefijo de nombre Bluetooth
            </label>
            <input
              id="ble-prefix"
              type="text"
              value={bleConfig.namePrefix}
              onChange={(e) =>
                setBleConfig({...bleConfig, namePrefix: e.target.value})
              }
              className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="ble-service"
              className="block text-xs font-bold text-[#17324D] mb-1"
            >
              Service UUID
            </label>
            <input
              id="ble-service"
              type="text"
              value={bleConfig.serviceUuid}
              onChange={(e) =>
                setBleConfig({...bleConfig, serviceUuid: e.target.value})
              }
              className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="ble-char"
              className="block text-xs font-bold text-[#17324D] mb-1"
            >
              Characteristic UUID (Lectura / Notify pH)
            </label>
            <input
              id="ble-char"
              type="text"
              value={bleConfig.characteristicUuid}
              onChange={(e) =>
                setBleConfig({...bleConfig, characteristicUuid: e.target.value})
              }
              className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2 text-xs font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              className="rounded-xl bg-[#2A9D8F] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#23867a] min-h-[40px]"
            >
              Guardar configuración
            </button>
            <button
              type="button"
              onClick={handleResetBle}
              className="rounded-xl border border-[#E1E3DA] bg-white px-4 py-2 text-xs font-bold text-[#55656D] hover:text-[#17324D] min-h-[40px]"
            >
              Restaurar predeterminados
            </button>
          </div>
          {savedNotice && (
            <p className="text-xs font-bold text-[#2E7D32]">
              Configuración BLE actualizada.
            </p>
          )}
        </form>
      </Section>
    </div>
  );
};
