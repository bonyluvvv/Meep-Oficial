import React, {useState} from 'react';
import {
  AlertTriangle,
  Bluetooth,
  Check,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  Loader2,
  Search,
  User,
} from 'lucide-react';
import type {BleReading} from '../lib/bluetooth';
import {isWebBluetoothSupported} from '../lib/bluetooth';
import {
  ESTADO_CORTO,
  ESTADO_TITULO,
  NOTA_PH,
  SUBESTADO_LABEL,
  formatFechaHora,
  formatPh,
  formatRango,
} from '../lib/meepCore';
import type {
  BluetoothConnectionState,
  FoodDefinition,
  FoodKey,
  MeasurementRecord,
} from '../types/meep';
import {FoodIcon, ProbeIcon} from './MeepIcons';

export type MeasureViewStep = 'home' | 'food' | 'measure' | 'result';

interface MeasureFlowProps {
  step: MeasureViewStep;
  onChangeStep: (step: MeasureViewStep) => void;
  btState: BluetoothConnectionState;
  btDeviceName: string | null;
  btError: string;
  liveReading: BleReading | null;
  onConnectBt: (scanAll?: boolean) => Promise<void>;
  onDisconnectBt: () => void;
  onReadBtMeasurement: () => Promise<{ph: number | null; temperatura: number | null}>;
  alimentos: FoodDefinition[];
  selectedFood: FoodKey | null;
  onSelectFood: (clave: FoodKey) => void;
  manipulador: string;
  onChangeManipulador: (value: string) => void;
  onCommitMeasurement: (data: {
    ph: number | null;
    temperatura: number | null;
    origen: 'bluetooth' | 'demo';
  }) => Promise<void>;
  lastResult: MeasurementRecord | null;
  saving: boolean;
  savedToCloud: boolean;
  saveError: string;
  onRetrySave: () => Promise<void>;
  onGoHistory: () => void;
  onGoHelp: () => void;
}

export const MeasureFlow: React.FC<MeasureFlowProps> = ({
  step,
  onChangeStep,
  btState,
  btDeviceName,
  btError,
  liveReading,
  onConnectBt,
  onDisconnectBt,
  onReadBtMeasurement,
  alimentos,
  selectedFood,
  onSelectFood,
  manipulador,
  onChangeManipulador,
  onCommitMeasurement,
  lastResult,
  saving,
  savedToCloud,
  saveError,
  onRetrySave,
  onGoHistory,
  onGoHelp,
}) => {
  const [readingPhase, setReadingPhase] = useState<'idle' | 'reading' | 'error'>(
    'idle',
  );
  const [readError, setReadError] = useState('');
  const [manualPh, setManualPh] = useState('');
  const [manualTemp, setManualTemp] = useState('');
  const [manualError, setManualError] = useState('');

  const btSupported = isWebBluetoothSupported();
  const activeFood =
    alimentos.find((a) => a.clave === selectedFood) || alimentos[0] || null;

  const handleMeasureBt = async () => {
    setReadingPhase('reading');
    setReadError('');
    try {
      const reading = await onReadBtMeasurement();
      await onCommitMeasurement({
        ph: reading.ph,
        temperatura: reading.temperatura,
        origen: 'bluetooth',
      });
      setReadingPhase('idle');
      onChangeStep('result');
    } catch (err) {
      setReadingPhase('error');
      setReadError(
        err instanceof Error
          ? err.message
          : 'No se pudo obtener la lectura del dispositivo MEEP.',
      );
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    const phNum = Number(manualPh.replace(',', '.'));
    if (!manualPh.trim() || !Number.isFinite(phNum) || phNum < 0 || phNum > 14) {
      setManualError('Ingresa un valor de pH válido entre 0 y 14.');
      return;
    }
    let tempNum: number | null = null;
    if (manualTemp.trim()) {
      const parsedT = Number(manualTemp.replace(',', '.'));
      if (!Number.isFinite(parsedT) || parsedT < -20 || parsedT > 100) {
        setManualError('Ingresa una temperatura válida en °C.');
        return;
      }
      tempNum = Number(parsedT.toFixed(1));
    }

    await onCommitMeasurement({
      ph: Number(phNum.toFixed(2)),
      temperatura: tempNum,
      origen: 'demo',
    });
    setManualPh('');
    setManualTemp('');
    onChangeStep('result');
  };

  if (step === 'home') {
    const statusLabel =
      btState === 'connected'
        ? `Conectado · ${btDeviceName || 'MEEP'}`
        : btState === 'connecting'
          ? 'Buscando dispositivo MEEP…'
          : btState === 'error'
            ? 'No se completó la conexión'
            : 'Sin conexión Bluetooth';

    const statusBadgeClass =
      btState === 'connected'
        ? 'bg-[#E0F1EF] text-[#17324D]'
        : btState === 'connecting'
          ? 'bg-[#FDEEDF] text-[#263238]'
          : btState === 'error'
            ? 'bg-[#FAE8E8] text-[#C62828]'
            : 'bg-[#E9ECEE] text-[#263238]';

    return (
      <div className="space-y-4">
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#2A9D8F]">
            Control preventivo · Lácteos
          </div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#17324D] leading-tight">
            Conoce el pH de tus alimentos
          </h1>
          <p className="text-[15px] text-[#55656D]">
            Conecta tu dispositivo MEEP por Bluetooth, mide la muestra y guarda
            el registro en tu establecimiento.
          </p>
        </div>

        <section className="rounded-3xl border border-[#E1E3DA] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#17324D]">
              Dispositivo MEEP
            </h2>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${statusBadgeClass}`}
            >
              {btState === 'connecting' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : btState === 'connected' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#2A9D8F]" />
              ) : btState === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Bluetooth className="h-3.5 w-3.5" />
              )}
              <span>{statusLabel}</span>
            </span>
          </div>

          {btState !== 'connected' && (
            <div className="rounded-2xl bg-[#F7F7F2] border border-[#E1E3DA] p-3.5 text-sm text-[#263238] space-y-2">
              <p className="font-bold text-[#17324D]">
                Pasos para conectar tu MEEP:
              </p>
              <ol className="space-y-1.5 text-xs text-[#55656D]">
                <li>1. Enciende el dispositivo MEEP y verifica su batería.</li>
                <li>
                  2. Activa el <strong>Bluetooth</strong> en tu teléfono (y la{' '}
                  <strong>Ubicación</strong> si usas Android).
                </li>
                <li>
                  3. Pulsa <strong>Conectar MEEP</strong> y selecciona tu
                  dispositivo en la lista.
                </li>
              </ol>
            </div>
          )}

          {!btSupported && (
            <div className="rounded-2xl border border-[#F4A261] bg-[#FDEEDF] p-3.5 text-xs text-[#263238] flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#17324D]" />
              <div>
                <strong>Navegador sin Bluetooth directo.</strong> Para emparejar
                MEEP por Bluetooth abre la app en{' '}
                <strong>Google Chrome</strong> (Android, Windows o macOS) o{' '}
                <strong>Bluefy</strong> (iPhone).
              </div>
            </div>
          )}

          {btState === 'error' && btError && (
            <div className="rounded-2xl border border-[#C62828]/35 bg-[#FAE8E8] p-3.5 text-xs text-[#263238] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#C62828]" />
              <div>
                <p className="font-bold text-[#C62828]">
                  No se pudo conectar con MEEP
                </p>
                <p className="mt-0.5">{btError}</p>
              </div>
            </div>
          )}

          {btState === 'connected' ? (
            <div className="space-y-3">
              {liveReading?.ph !== null && liveReading?.ph !== undefined && (
                <div className="rounded-2xl bg-[#E0F1EF] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#17324D]">
                    Última lectura del sensor
                  </span>
                  <span className="font-display text-xl font-bold text-[#17324D] tabular-nums">
                    {formatPh(liveReading.ph)} pH
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={onDisconnectBt}
                className="w-full rounded-xl border-2 border-[#17324D] bg-white px-4 py-2.5 text-sm font-extrabold text-[#17324D] hover:bg-[#F7F7F2] min-h-[44px]"
              >
                Desconectar dispositivo
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={btState === 'connecting'}
                onClick={() => onConnectBt(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F] px-5 py-3.5 text-base font-extrabold text-white transition-colors hover:bg-[#23867a] disabled:opacity-50 min-h-[54px]"
              >
                <Bluetooth className="h-5 w-5 shrink-0" />
                <span>
                  {btState === 'connecting'
                    ? 'Buscando MEEP…'
                    : btState === 'error'
                      ? 'Reintentar conexión MEEP'
                      : 'Conectar MEEP'}
                </span>
              </button>

              {btSupported && (
                <button
                  type="button"
                  disabled={btState === 'connecting'}
                  onClick={() => onConnectBt(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E1E3DA] bg-white px-4 py-2.5 text-xs font-bold text-[#55656D] hover:text-[#17324D] hover:border-[#17324D] min-h-[42px]"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span>Buscar todos los dispositivos Bluetooth cercanos</span>
                </button>
              )}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E1E3DA] bg-white p-4 space-y-2">
          <label
            htmlFor="manipulador-input"
            className="flex items-center gap-2 text-sm font-bold text-[#17324D]"
          >
            <User className="h-4 w-4 text-[#2A9D8F]" />
            <span>Manipulador o turno (opcional)</span>
          </label>
          <input
            id="manipulador-input"
            type="text"
            value={manipulador}
            onChange={(e) => onChangeManipulador(e.target.value)}
            placeholder="Ej. María · Turno almuerzo"
            className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3.5 py-2.5 text-sm text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[44px]"
          />
          <p className="text-xs text-[#55656D]">
            Se guardará junto con tus mediciones para identificar quién realizó
            el control dentro del establecimiento.
          </p>
        </section>

        <button
          type="button"
          onClick={() => onChangeStep('food')}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#17324D] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#10253a] min-h-[56px]"
        >
          <ProbeIcon size={22} />
          <span>Comenzar medición</span>
        </button>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[#E1E3DA] bg-white p-3.5 text-xs text-[#55656D]">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            MEEP mide el pH para apoyar el control preventivo de alimentos
            lácteos.{' '}
            <button
              type="button"
              onClick={onGoHelp}
              className="font-extrabold text-[#2A9D8F] underline"
            >
              Ver guía de uso
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (step === 'food') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#17324D]">
            ¿Qué alimento vas a medir?
          </h2>
          <p className="text-sm text-[#55656D]">
            Toca una tarjeta para seleccionar el producto lácteo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {alimentos.map((a) => {
            const selected = selectedFood === a.clave;
            const rango = formatRango(a.ph_min, a.ph_max);
            return (
              <button
                key={a.clave}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectFood(a.clave)}
                className={`relative flex min-h-[144px] flex-col items-center justify-center gap-2 rounded-3xl border-2 px-3 py-4 text-center transition-colors ${
                  selected
                    ? 'border-[#2A9D8F] bg-[#E0F1EF]'
                    : 'border-[#E1E3DA] bg-white hover:border-[#2A9D8F]/60'
                }`}
              >
                {selected && (
                  <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2A9D8F] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    selected
                      ? 'bg-white text-[#2A9D8F]'
                      : 'bg-[#F7F7F2] text-[#17324D]'
                  }`}
                >
                  <FoodIcon clave={a.icono} size={30} />
                </span>
                <span className="font-display text-base font-semibold text-[#17324D]">
                  {a.nombre}
                </span>
                <span className="text-xs font-bold text-[#55656D] tabular-nums">
                  {rango ? `pH ${rango}` : 'Sin rango'}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selectedFood}
          onClick={() => {
            setReadingPhase('idle');
            setReadError('');
            onChangeStep('measure');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17324D] px-5 py-4 text-base font-extrabold text-white transition-colors hover:bg-[#10253a] disabled:opacity-45 disabled:cursor-not-allowed min-h-[56px]"
        >
          <span>Continuar</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  if (step === 'measure' && activeFood) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3.5 rounded-3xl border border-[#E1E3DA] bg-white p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F7F7F2] text-[#17324D]">
            <FoodIcon clave={activeFood.icono} size={28} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[#55656D]">
              Alimento seleccionado
            </div>
            <div className="font-display text-lg font-bold text-[#17324D] truncate">
              {activeFood.nombre}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangeStep('food')}
            className="text-sm font-extrabold text-[#2A9D8F] underline px-2 py-2 min-h-[44px]"
          >
            Cambiar
          </button>
        </div>

        {readingPhase === 'reading' ? (
          <div className="rounded-3xl border border-[#E1E3DA] bg-white px-5 py-8 text-center space-y-5">
            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              <span className="meep-wave absolute inset-0 rounded-full border-[3px] border-[#2A9D8F]" />
              <span className="meep-wave meep-wave-delay-1 absolute inset-0 rounded-full border-[3px] border-[#2A9D8F]" />
              <span className="meep-wave meep-wave-delay-2 absolute inset-0 rounded-full border-[3px] border-[#2A9D8F]" />
              <span className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[#17324D] text-white">
                <ProbeIcon size={38} />
              </span>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#17324D]">
                Recibiendo lectura del MEEP…
              </h2>
              <p className="mt-1 text-sm text-[#55656D]">
                Mantén la sonda en contacto estable con la muestra durante unos
                segundos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReadingPhase('idle')}
              className="w-full rounded-2xl border-2 border-[#17324D] bg-white py-3 text-sm font-extrabold text-[#17324D] min-h-[48px]"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-[#E1E3DA] bg-white px-5 py-6 text-center space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#17324D] text-white">
                <ProbeIcon size={38} />
              </div>
              <p className="text-sm text-[#55656D] max-w-[32ch] mx-auto">
                Introduce la sonda limpia en la muestra de{' '}
                <strong>{activeFood.nombre.toLowerCase()}</strong> y captura la
                lectura.
              </p>

              {readingPhase === 'error' && readError && (
                <div className="rounded-2xl border border-[#C62828]/40 bg-[#FAE8E8] p-3.5 text-left text-xs text-[#263238] flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#C62828]" />
                  <span>{readError}</span>
                </div>
              )}

              {btState === 'connected' ? (
                <button
                  type="button"
                  onClick={handleMeasureBt}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#17324D] px-5 py-4 text-base font-extrabold text-white hover:bg-[#10253a] min-h-[56px]"
                >
                  <ProbeIcon size={22} />
                  <span>Realizar medición por Bluetooth</span>
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="rounded-2xl bg-[#F7F7F2] border border-[#E1E3DA] p-3 text-xs text-[#55656D] text-left">
                    Para leer automáticamente desde el sensor, conecta primero tu
                    dispositivo MEEP por Bluetooth.
                  </div>
                  <button
                    type="button"
                    onClick={() => onConnectBt(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F] px-5 py-3.5 text-base font-extrabold text-white hover:bg-[#23867a] min-h-[54px]"
                  >
                    <Bluetooth className="h-5 w-5" />
                    <span>Conectar MEEP ahora</span>
                  </button>
                </div>
              )}
            </div>

            <details className="rounded-3xl border border-[#E1E3DA] bg-white">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-extrabold text-[#17324D] flex items-center justify-between min-h-[52px]">
                <span>Ingresar lectura manual del dispositivo</span>
                <ChevronRight className="h-4 w-4 text-[#55656D]" />
              </summary>
              <form
                onSubmit={handleManualSubmit}
                className="px-5 pb-5 pt-1 space-y-3 border-t border-[#E1E3DA]"
              >
                <p className="text-xs text-[#55656D] pt-2">
                  Si ves el resultado directamente en la pantalla del MEEP,
                  ingresa los valores aquí para guardarlos en el historial del
                  establecimiento.
                </p>
                {manualError && (
                  <p className="text-xs font-bold text-[#C62828]">
                    {manualError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="manual-ph"
                      className="block text-xs font-bold text-[#17324D] mb-1"
                    >
                      Valor pH (0–14)
                    </label>
                    <input
                      id="manual-ph"
                      type="number"
                      step="0.01"
                      min="0"
                      max="14"
                      required
                      value={manualPh}
                      onChange={(e) => setManualPh(e.target.value)}
                      placeholder="Ej. 6.72"
                      className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2.5 text-sm font-bold tabular-nums min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manual-temp"
                      className="block text-xs font-bold text-[#17324D] mb-1"
                    >
                      Temp °C (opcional)
                    </label>
                    <input
                      id="manual-temp"
                      type="number"
                      step="0.1"
                      min="-20"
                      max="100"
                      value={manualTemp}
                      onChange={(e) => setManualTemp(e.target.value)}
                      placeholder="Ej. 4.5"
                      className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2.5 text-sm font-bold tabular-nums min-h-[44px]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl border-2 border-[#17324D] bg-white py-3 text-sm font-extrabold text-[#17324D] hover:bg-[#E0F1EF] min-h-[48px]"
                >
                  Interpretar y guardar registro
                </button>
              </form>
            </details>
          </>
        )}
      </div>
    );
  }

  if (step === 'result' && lastResult) {
    const food =
      alimentos.find((a) => a.clave === lastResult.alimento_clave) || activeFood;
    const rango = food ? formatRango(food.ph_min, food.ph_max) : null;
    const heroClass =
      lastResult.estado === 'in'
        ? 'bg-[#2E7D32] text-white'
        : lastResult.estado === 'out'
          ? 'bg-[#C62828] text-white'
          : 'bg-[#E9ECEE] text-[#263238] border border-[#E1E3DA]';
    const iconColor =
      lastResult.estado === 'in'
        ? 'text-[#2E7D32]'
        : lastResult.estado === 'out'
          ? 'text-[#C62828]'
          : 'text-[#17324D]';

    return (
      <div className="space-y-4">
        <section
          aria-live="polite"
          className={`rounded-3xl px-5 py-6 text-center flex flex-col items-center gap-1.5 ${heroClass}`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full bg-white ${iconColor}`}
          >
            {lastResult.estado === 'in' ? (
              <CheckCircle2 className="h-9 w-9" />
            ) : lastResult.estado === 'out' ? (
              <AlertTriangle className="h-9 w-9" />
            ) : (
              <HelpCircle className="h-9 w-9" />
            )}
          </span>
          <span className="font-display text-lg font-semibold mt-1">
            {ESTADO_TITULO[lastResult.estado]}
          </span>
          <span className="font-display text-6xl font-bold tabular-nums leading-none my-1">
            {formatPh(lastResult.ph)}
            <small className="text-xl font-semibold ml-1.5 opacity-85">pH</small>
          </span>
          <span className="font-extrabold text-base">
            {food?.nombre || lastResult.alimento_clave}
          </span>
          {lastResult.motivo && (
            <p className="text-sm max-w-[34ch] opacity-95 mt-1">
              {lastResult.motivo}
            </p>
          )}
        </section>

        <div className="rounded-3xl border border-[#E1E3DA] bg-white px-5 py-2 divide-y divide-[#E1E3DA] text-sm">
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Alimento</span>
            <span className="font-extrabold text-right">
              {food?.nombre || lastResult.alimento_clave}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">
              Rango de referencia
            </span>
            <span className="font-extrabold text-right tabular-nums">
              {rango || 'No definido'}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Interpretación</span>
            <span className="font-extrabold text-right">
              {SUBESTADO_LABEL[lastResult.subestado] ||
                ESTADO_CORTO[lastResult.estado]}
            </span>
          </div>
          {lastResult.temperatura !== null && (
            <div className="flex justify-between gap-4 py-3">
              <span className="font-semibold text-[#55656D]">Temperatura</span>
              <span className="font-extrabold text-right tabular-nums">
                {lastResult.temperatura.toFixed(1).replace('.', ',')} °C
              </span>
            </div>
          )}
          {lastResult.manipulador && (
            <div className="flex justify-between gap-4 py-3">
              <span className="font-semibold text-[#55656D]">
                Manipulador / Turno
              </span>
              <span className="font-extrabold text-right">
                {lastResult.manipulador}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Fecha y hora</span>
            <span className="font-extrabold text-right tabular-nums">
              {formatFechaHora(lastResult.medido_at)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[#E1E3DA] bg-white p-3.5 text-xs text-[#55656D]">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{NOTA_PH}</p>
        </div>

        {saveError && (
          <div className="rounded-2xl border border-[#C62828]/40 bg-[#FAE8E8] p-3.5 text-xs text-[#263238] space-y-2">
            <p className="font-bold text-[#C62828]">{saveError}</p>
            <button
              type="button"
              onClick={onRetrySave}
              disabled={saving}
              className="rounded-xl bg-[#17324D] px-4 py-2 text-xs font-extrabold text-white"
            >
              {saving ? 'Sincronizando…' : 'Reintentar guardado en la nube'}
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F]/15 px-4 py-3 text-sm font-extrabold text-[#17324D] min-h-[48px]">
            <CheckCircle2 className="h-5 w-5 text-[#2E7D32]" />
            <span>
              {saving
                ? 'Guardando en historial…'
                : savedToCloud
                  ? 'Medición guardada en el establecimiento'
                  : 'Medición guardada en este dispositivo'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChangeStep('measure')}
            className="w-full rounded-2xl border-2 border-[#17324D] bg-white py-3.5 text-base font-extrabold text-[#17324D] hover:bg-[#E0F1EF] min-h-[52px]"
          >
            Nueva medición
          </button>

          <button
            type="button"
            onClick={onGoHistory}
            className="w-full py-2.5 text-center text-sm font-extrabold text-[#2A9D8F] underline min-h-[44px]"
          >
            Ver historial del establecimiento
          </button>
        </div>
      </div>
    );
  }

  return null;
};
