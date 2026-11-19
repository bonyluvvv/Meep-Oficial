import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  Info,
  RefreshCw,
  Trash2,
} from 'lucide-react';
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
  FoodDefinition,
  MeasurementRecord,
  MeasurementStatus,
} from '../types/meep';

interface HistoryViewProps {
  registros: MeasurementRecord[];
  alimentos: FoodDefinition[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
  onGoMeasure: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  registros,
  alimentos,
  loading,
  onRefresh,
  onDelete,
  onGoMeasure,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | MeasurementStatus>('all');
  const [deleting, setDeleting] = useState(false);

  const selectedRecord = useMemo(
    () => registros.find((r) => r.id === selectedId) || null,
    [registros, selectedId],
  );

  const filteredRecords = useMemo(() => {
    const sorted = [...registros].sort(
      (a, b) =>
        new Date(b.medido_at).getTime() - new Date(a.medido_at).getTime(),
    );
    if (filter === 'all') return sorted;
    return sorted.filter((r) => r.estado === filter);
  }, [registros, filter]);

  const getFood = (clave: string) =>
    alimentos.find((a) => a.clave === clave) || {
      clave,
      nombre: clave,
      ph_min: null,
      ph_max: null,
    };

  if (selectedRecord) {
    const food = getFood(selectedRecord.alimento_clave);
    const rango = formatRango(food.ph_min, food.ph_max);
    const heroColors =
      selectedRecord.estado === 'in'
        ? 'bg-[#2E7D32] text-white'
        : selectedRecord.estado === 'out'
          ? 'bg-[#C62828] text-white'
          : 'bg-[#E9ECEE] text-[#263238] border border-[#E1E3DA]';
    const iconColors =
      selectedRecord.estado === 'in'
        ? 'text-[#2E7D32]'
        : selectedRecord.estado === 'out'
          ? 'text-[#C62828]'
          : 'text-[#17324D]';

    const handleDelete = async () => {
      setDeleting(true);
      try {
        await onDelete(selectedRecord.id);
        setSelectedId(null);
      } finally {
        setDeleting(false);
      }
    };

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E1E3DA] bg-white px-3.5 py-2 text-sm font-bold text-[#17324D] hover:bg-[#E0F1EF] min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al historial</span>
        </button>

        <section
          className={`rounded-3xl px-5 py-6 text-center flex flex-col items-center gap-1.5 ${heroColors}`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full bg-white ${iconColors}`}
          >
            {selectedRecord.estado === 'in' ? (
              <CheckCircle2 className="h-9 w-9" />
            ) : selectedRecord.estado === 'out' ? (
              <AlertTriangle className="h-9 w-9" />
            ) : (
              <HelpCircle className="h-9 w-9" />
            )}
          </span>
          <span className="font-display text-lg font-semibold mt-1">
            {ESTADO_TITULO[selectedRecord.estado]}
          </span>
          <span className="font-display text-6xl font-bold tabular-nums leading-none my-1">
            {formatPh(selectedRecord.ph)}
            <small className="text-xl font-semibold ml-1.5 opacity-85">pH</small>
          </span>
          <span className="font-extrabold text-base">{food.nombre}</span>
          {selectedRecord.motivo && (
            <p className="text-sm max-w-[34ch] opacity-95 mt-1">
              {selectedRecord.motivo}
            </p>
          )}
        </section>

        <div className="rounded-3xl border border-[#E1E3DA] bg-white px-5 py-2 divide-y divide-[#E1E3DA] text-sm">
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Alimento</span>
            <span className="font-extrabold text-right">{food.nombre}</span>
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
            <span className="font-semibold text-[#55656D]">Estado</span>
            <span className="font-extrabold text-right">
              {SUBESTADO_LABEL[selectedRecord.subestado] ||
                ESTADO_CORTO[selectedRecord.estado]}
            </span>
          </div>
          {selectedRecord.temperatura !== null && (
            <div className="flex justify-between gap-4 py-3">
              <span className="font-semibold text-[#55656D]">Temperatura</span>
              <span className="font-extrabold text-right tabular-nums">
                {selectedRecord.temperatura.toFixed(1).replace('.', ',')} °C
              </span>
            </div>
          )}
          {selectedRecord.manipulador && (
            <div className="flex justify-between gap-4 py-3">
              <span className="font-semibold text-[#55656D]">
                Manipulador / Turno
              </span>
              <span className="font-extrabold text-right">
                {selectedRecord.manipulador}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Origen</span>
            <span className="font-extrabold text-right">
              {selectedRecord.origen === 'bluetooth'
                ? selectedRecord.dispositivo_codigo || 'Bluetooth MEEP'
                : 'Registro manual'}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <span className="font-semibold text-[#55656D]">Fecha y hora</span>
            <span className="font-extrabold text-right tabular-nums">
              {formatFechaHora(selectedRecord.medido_at)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[#E1E3DA] bg-white p-3.5 text-sm text-[#55656D]">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{NOTA_PH}</p>
        </div>

        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#C62828] bg-white px-4 py-3.5 text-base font-extrabold text-[#C62828] hover:bg-[#FAE8E8] disabled:opacity-50 min-h-[52px]"
        >
          <Trash2 className="h-5 w-5" />
          <span>{deleting ? 'Eliminando…' : 'Eliminar registro'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[#17324D]">
          Historial del establecimiento
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E1E3DA] bg-white px-3 py-2 text-xs font-bold text-[#17324D] hover:bg-[#E0F1EF] disabled:opacity-50 min-h-[40px]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {registros.length > 0 && (
        <div className="flex items-center gap-1 rounded-2xl border border-[#E1E3DA] bg-white p-1 overflow-x-auto">
          {(
            [
              ['all', 'Todos'],
              ['in', 'En rango'],
              ['out', 'Fuera de rango'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap min-h-[40px] ${
                filter === key
                  ? 'bg-[#17324D] text-white'
                  : 'text-[#55656D] hover:text-[#17324D]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && registros.length === 0 ? (
        <div className="rounded-3xl border border-[#E1E3DA] bg-white p-8 text-center text-sm font-semibold text-[#55656D]">
          Cargando mediciones del establecimiento…
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-3xl border border-[#E1E3DA] bg-white px-5 py-10 text-center flex flex-col items-center gap-3">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F1EF] text-[#2A9D8F]">
            <Clock className="h-9 w-9" />
          </span>
          <h3 className="font-display text-lg font-bold text-[#17324D]">
            {registros.length === 0
              ? 'Aún no hay mediciones guardadas'
              : 'No hay registros en esta categoría'}
          </h3>
          <p className="text-sm text-[#55656D] max-w-[30ch]">
            {registros.length === 0
              ? 'Cuando realices una medición con MEEP quedará registrada para tu establecimiento.'
              : 'Prueba cambiando el filtro para ver las demás mediciones.'}
          </p>
          {registros.length === 0 && (
            <button
              type="button"
              onClick={onGoMeasure}
              className="mt-2 rounded-2xl bg-[#17324D] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#10253a] min-h-[48px]"
            >
              Hacer la primera medición
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRecords.map((r) => {
            const food = getFood(r.alimento_clave);
            const phColor =
              r.estado === 'in'
                ? 'text-[#2E7D32]'
                : r.estado === 'out'
                  ? 'text-[#C62828]'
                  : 'text-[#55656D]';
            const StatusIcon =
              r.estado === 'in'
                ? CheckCircle2
                : r.estado === 'out'
                  ? AlertTriangle
                  : HelpCircle;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#2A9D8F] min-h-[68px]"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    r.estado === 'in'
                      ? 'bg-[#E5F0E6] text-[#2E7D32]'
                      : r.estado === 'out'
                        ? 'bg-[#FAE8E8] text-[#C62828]'
                        : 'bg-[#E9ECEE] text-[#55656D]'
                  }`}
                >
                  <StatusIcon className="h-5 w-5" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-[#17324D] truncate">
                    {food.nombre}
                  </div>
                  <div className="text-xs text-[#55656D] truncate">
                    <span>{formatFechaHora(r.medido_at)}</span>
                    {r.manipulador && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{r.manipulador}</span>
                      </>
                    )}
                  </div>
                  <div className={`text-xs font-extrabold mt-0.5 ${phColor}`}>
                    {ESTADO_CORTO[r.estado]}
                  </div>
                </div>

                <span
                  className={`font-display text-2xl font-bold tabular-nums shrink-0 ${phColor}`}
                >
                  {formatPh(r.ph)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#55656D]" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
