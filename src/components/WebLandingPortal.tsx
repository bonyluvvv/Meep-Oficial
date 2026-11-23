import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bluetooth,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  ESTADO_CORTO,
  SUBESTADO_LABEL,
  formatFechaHora,
  formatPh,
  formatRango,
} from '../lib/meepCore';
import {
  isSupabaseConfigured,
  signInEstablishment,
  submitIntegrationRequest,
} from '../lib/supabase';
import type {
  EstablishmentProfile,
  EstablishmentType,
  FoodDefinition,
  MeasurementRecord,
  MeasurementStatus,
} from '../types/meep';
import {FoodIcon, MeepLogo} from './MeepIcons';
import {PWAInstallButton} from './PWAInstallButton';

interface WebLandingPortalProps {
  profile: EstablishmentProfile | null;
  alimentos: FoodDefinition[];
  registros: MeasurementRecord[];
  loadingHistory: boolean;
  onAuthenticated: (profile: EstablishmentProfile) => Promise<void>;
  onLogout: () => Promise<void>;
  onRefreshHistory: () => void;
  onOpenApp: () => void;
}

export const WebLandingPortal: React.FC<WebLandingPortalProps> = ({
  profile,
  alimentos,
  registros,
  loadingHistory,
  onAuthenticated,
  onLogout,
  onRefreshHistory,
  onOpenApp,
}) => {
  // Auth & Solicitud de integración en Portal Web (solo administradores)
  const [portalMode, setPortalMode] = useState<'login' | 'request'>('login');
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos del formulario de solicitud de nueva institución
  const [nombreInstitucion, setNombreInstitucion] = useState('');
  const [tipo, setTipo] = useState<EstablishmentType>('establecimiento');
  const [nombreContacto, setNombreContacto] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudadComuna, setCiudadComuna] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [requestSent, setRequestSent] = useState<{
    institucion: string;
    correo: string;
  } | null>(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Filtros del portal de solo lectura
  const [statusFilter, setStatusFilter] = useState<'all' | MeasurementStatus>(
    'all',
  );
  const [foodFilter, setFoodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handlePortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (portalMode === 'login') {
        const res = await signInEstablishment(identificador, password, 'web');
        await onAuthenticated(res.profile);
      } else {
        await submitIntegrationRequest({
          nombreInstitucion,
          tipo,
          nombreContacto,
          correoContacto,
          telefono,
          ciudadComuna,
          observaciones,
        });
        setRequestSent({
          institucion: nombreInstitucion.trim(),
          correo: correoContacto.trim(),
        });
        setNombreInstitucion('');
        setNombreContacto('');
        setCorreoContacto('');
        setTelefono('');
        setCiudadComuna('');
        setObservaciones('');
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la operación.',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...registros]
      .sort(
        (a, b) =>
          new Date(b.medido_at).getTime() - new Date(a.medido_at).getTime(),
      )
      .filter((r) => {
        if (statusFilter !== 'all' && r.estado !== statusFilter) return false;
        if (foodFilter !== 'all' && r.alimento_clave !== foodFilter) return false;
        if (q) {
          const handler = (r.manipulador || '').toLowerCase();
          const device = (r.dispositivo_codigo || '').toLowerCase();
          if (!handler.includes(q) && !device.includes(q)) return false;
        }
        return true;
      });
  }, [registros, statusFilter, foodFilter, searchTerm]);

  const stats = useMemo(() => {
    const total = registros.length;
    const inRange = registros.filter((r) => r.estado === 'in').length;
    const outRange = registros.filter((r) => r.estado === 'out').length;
    const latest =
      registros.length > 0
        ? [...registros].sort(
            (a, b) =>
              new Date(b.medido_at).getTime() - new Date(a.medido_at).getTime(),
          )[0].medido_at
        : null;
    return {total, inRange, outRange, latest};
  }, [registros]);

  const getFoodName = (clave: string) =>
    alimentos.find((a) => a.clave === clave)?.nombre || clave;

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    const header = [
      'Fecha y hora',
      'Alimento',
      'pH',
      'Temperatura (°C)',
      'Estado',
      'Indicador LED',
      'Manipulador / Turno',
      'Origen',
    ];
    const rows = filteredRecords.map((r) => [
      formatFechaHora(r.medido_at),
      getFoodName(r.alimento_clave),
      r.ph !== null ? r.ph.toFixed(2) : '',
      r.temperatura !== null ? r.temperatura.toFixed(1) : '',
      ESTADO_CORTO[r.estado],
      r.led_color,
      r.manipulador || 'Sin especificar',
      r.origen === 'bluetooth' ? 'Bluetooth MEEP' : 'Registro manual',
    ]);
    const csv = [header, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meep-registros-${profile?.usuario || 'establecimiento'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-[#263238]">
      {/* Top Bar Contract: Brand — 4-5 nav links — 1 Primary Action */}
      <header className="sticky top-0 z-30 border-b border-[#E1E3DA] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#inicio"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-[0.12em] text-[#17324D] whitespace-nowrap shrink-0"
          >
            <MeepLogo size={30} />
            <span>MEEP</span>
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#55656D]"
          >
            <a
              href="#problema"
              className="hover:text-[#17324D] transition-colors whitespace-nowrap shrink-0"
            >
              El problema
            </a>
            <a
              href="#solucion"
              className="hover:text-[#17324D] transition-colors whitespace-nowrap shrink-0"
            >
              Solución
            </a>
            <a
              href="#modelo"
              className="hover:text-[#17324D] transition-colors whitespace-nowrap shrink-0"
            >
              Modelo
            </a>
            <a
              href="#portal"
              className="hover:text-[#17324D] transition-colors whitespace-nowrap shrink-0"
            >
              Portal
            </a>
            <a
              href="#equipo"
              className="hover:text-[#17324D] transition-colors whitespace-nowrap shrink-0"
            >
              Equipo
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenApp}
              className="inline-flex items-center gap-2 rounded-xl bg-[#17324D] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#10253a] whitespace-nowrap shrink-0 min-h-[42px]"
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Abrir App MEEP</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="inicio" className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-12 sm:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
              Proyecto PEMI · Instituto Comercial Bicentenario de Viña del Mar
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#17324D] leading-[1.08] tracking-tight">
              Control preventivo de pH para alimentos más seguros
            </h1>
            <p className="text-base sm:text-lg text-[#55656D] max-w-[60ch]">
              MEEP es un medidor portátil impreso en 3D con conexión Bluetooth que
              evalúa el pH de productos lácteos en segundos y sincroniza el
              historial de control para casinos escolares JUNAEB y PYMEs.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#portal"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17324D] px-6 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-[#10253a] whitespace-nowrap shrink-0 min-h-[50px]"
              >
                <span>Consultar registros del establecimiento</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={onOpenApp}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#17324D] bg-white px-5 py-3.5 text-sm font-extrabold text-[#17324D] transition-colors hover:bg-[#E0F1EF] whitespace-nowrap shrink-0 min-h-[50px]"
              >
                <Bluetooth className="h-4 w-4 text-[#2A9D8F]" />
                <span>Medir con la App</span>
              </button>
              <PWAInstallButton variant="header" />
            </div>
          </div>

          {/* Esquema técnico limpio del prototipo MEEP y rangos oficiales */}
          <div className="lg:col-span-5 rounded-3xl border border-[#E1E3DA] bg-white p-6 flex flex-col justify-between gap-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#55656D]">
                  Dispositivo portátil + App Bluetooth
                </div>
                <div className="font-display text-lg font-bold text-[#17324D]">
                  Esquema de detección MEEP
                </div>
              </div>
              <MeepLogo size={38} />
            </div>

            <div className="rounded-2xl bg-[#F7F7F2] border border-[#E1E3DA] p-4 flex items-center gap-4">
              {/* Ilustración SVG fiel al diseño en P del Informe */}
              <svg
                width="84"
                height="96"
                viewBox="0 0 84 96"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect x="26" y="8" width="46" height="36" rx="14" fill="#17324D" />
                <rect x="34" y="15" width="30" height="22" rx="7" fill="#F7F7F2" />
                <rect x="26" y="8" width="16" height="72" rx="8" fill="#17324D" />
                <circle cx="34" cy="20" r="3.5" fill="#2E7D32" />
                <circle cx="34" cy="30" r="3.5" fill="#C62828" />
                <path
                  d="M34 80 L34 92"
                  stroke="#2A9D8F"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <text
                  x="49"
                  y="30"
                  textAnchor="middle"
                  fill="#17324D"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="Sora, sans-serif"
                >
                  6.7
                </text>
              </svg>
              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-[#17324D]">
                  Lectura directa con luz LED
                </div>
                <p className="text-[#55656D]">
                  <strong>LED Verde:</strong> pH dentro del rango esperado.
                </p>
                <p className="text-[#55656D]">
                  <strong>LED Rojo:</strong> pH alterado (ácido o contaminado).
                </p>
                <p className="text-[#55656D]">
                  Envía la lectura a la App por Bluetooth en segundos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {alimentos.map((a) => (
                <div
                  key={a.clave}
                  className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] px-2 py-2.5"
                >
                  <div className="text-xs font-bold text-[#17324D]">
                    {a.nombre}
                  </div>
                  <div className="font-display text-xs font-bold text-[#2A9D8F] tabular-nums mt-0.5">
                    {formatRango(a.ph_min, a.ph_max)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4-column KPI strip below hero */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[#E1E3DA] bg-white p-4">
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#17324D] tabular-nums">
              600 M
            </div>
            <div className="mt-1 text-xs font-semibold text-[#55656D]">
              Personas enferman cada año por alimentos contaminados (OMS)
            </div>
          </div>
          <div className="rounded-2xl border border-[#E1E3DA] bg-white p-4">
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#C62828] tabular-nums">
              420 mil
            </div>
            <div className="mt-1 text-xs font-semibold text-[#55656D]">
              Muertes anuales estimadas por ETA en el mundo (OMS)
            </div>
          </div>
          <div className="rounded-2xl border border-[#E1E3DA] bg-white p-4">
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#2A9D8F] tabular-nums">
              51,5%
            </div>
            <div className="mt-1 text-xs font-semibold text-[#55656D]">
              Encuestados en 2025 que sufrió intoxicación alimentaria
            </div>
          </div>
          <div className="rounded-2xl border border-[#E1E3DA] bg-white p-4">
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#2E7D32]">
              ODS 3
            </div>
            <div className="mt-1 text-xs font-semibold text-[#55656D]">
              Salud y Bienestar · Prevención alimentaria en casinos escolares
            </div>
          </div>
        </div>
      </section>

      {/* Sección 1: El Problema */}
      <section
        id="problema"
        className="border-t border-[#E1E3DA] bg-white py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
              01. El origen y el problema
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#17324D]">
              La apariencia de un alimento no basta para saber si es seguro
            </h2>
            <p className="text-sm sm:text-base text-[#55656D]">
              El proyecto nació en 2025 en el Instituto Comercial Bicentenario de
              Viña del Mar tras la intoxicación de un compañero en el almuerzo
              JUNAEB. Un alimento en mal estado puede verse y oler normal, pero
              su nivel de pH ya refleja el inicio de su deterioro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-[#E1E3DA] bg-[#F7F7F2] p-5 space-y-2">
              <div className="font-display text-sm font-bold text-[#17324D]">
                Encuesta PEMI 2025 (n = 33)
              </div>
              <div className="font-display text-3xl font-bold text-[#17324D] tabular-nums">
                51,5%
              </div>
              <p className="text-xs text-[#55656D]">
                Respondió haber sufrido intoxicación por comida en mal estado,
                requiriendo hidratación, dieta blanda o atención médica.
              </p>
            </div>

            <div className="rounded-3xl border border-[#E1E3DA] bg-[#F7F7F2] p-5 space-y-2">
              <div className="font-display text-sm font-bold text-[#17324D]">
                Encuesta PEMI 2026 (n = 33)
              </div>
              <div className="font-display text-3xl font-bold text-[#2A9D8F] tabular-nums">
                28,1%
              </div>
              <p className="text-xs text-[#55656D]">
                Reportó malestar estomacal reciente y un 37,5% presenció
                intoxicaciones en su círculo cercano.
              </p>
            </div>

            <div className="rounded-3xl border border-[#E1E3DA] bg-[#F7F7F2] p-5 space-y-2">
              <div className="font-display text-sm font-bold text-[#17324D]">
                Brecha del mercado actual
              </div>
              <div className="font-display text-3xl font-bold text-[#C62828] tabular-nums">
                13 / 33
              </div>
              <p className="text-xs text-[#55656D]">
                Calificó con nota 3 o menos las soluciones actuales (como tiras
                desechables de pH), por ser poco prácticas y sin historial.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección 2: La Solución */}
      <section id="solucion" className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
              02. Cómo funciona MEEP
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#17324D]">
              De la sonda en cocina al historial en la nube
            </h2>
            <p className="text-sm sm:text-base text-[#55656D]">
              A diferencia de los papeles medidores desechables o sondas sin
              registro, MEEP es reutilizable, muestra alerta visual inmediata y
              guarda cada lectura por establecimiento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alimentos.map((food) => (
              <div
                key={food.clave}
                className="rounded-3xl border border-[#E1E3DA] bg-white p-6 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E0F1EF] text-[#2A9D8F]">
                    <FoodIcon clave={food.icono} size={26} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#17324D]">
                      {food.nombre}
                    </h3>
                    <div className="text-xs font-semibold text-[#55656D]">
                      Producto lácteo · Primera etapa
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#E1E3DA] text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#2E7D32]">
                      Buen estado (LED verde)
                    </span>
                    <span className="font-bold tabular-nums text-[#17324D]">
                      {formatRango(food.ph_min, food.ph_max)} pH
                    </span>
                  </div>
                  {food.rango_acido_max !== null && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#C62828]">
                        Mal estado ácido (LED rojo)
                      </span>
                      <span className="font-bold tabular-nums text-[#263238]">
                        &lt; {formatPh(food.rango_acido_max)} pH
                      </span>
                    </div>
                  )}
                  {food.rango_contaminado_min !== null && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#C62828]">
                        Contaminado (LED rojo)
                      </span>
                      <span className="font-bold tabular-nums text-[#263238]">
                        &gt; {formatPh(food.rango_contaminado_min)} pH
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección 3: Modelo de Negocio */}
      <section
        id="modelo"
        className="border-t border-[#E1E3DA] bg-white py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
                03. Modelo de negocio y alcance
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#17324D]">
                Pensado para casinos escolares y PYMEs alimentarias
              </h2>
              <p className="text-sm sm:text-base text-[#55656D]">
                Nuestro foco inicial son los establecimientos educacionales
                vinculados a Comeduc y el programa JUNAEB (más de 1,8 millones de
                estudiantes en Chile, partiendo por nuestro liceo con más de 500
                alumnos), junto a pequeñas distribuidoras de lácteos.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-4">
                  <div className="text-xs font-semibold text-[#55656D]">
                    Costo unitario (8 comp.)
                  </div>
                  <div className="font-display text-2xl font-bold text-[#17324D] tabular-nums mt-1">
                    $103.290
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-4">
                  <div className="text-xs font-semibold text-[#55656D]">
                    Precio de venta estimado
                  </div>
                  <div className="font-display text-2xl font-bold text-[#2A9D8F] tabular-nums mt-1">
                    $154.935
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-3xl border border-[#E1E3DA] bg-[#F7F7F2] p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-[#17324D]">
                Arquitectura hardware + software incluida
              </h3>
              <ul className="space-y-2.5 text-sm text-[#263238]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E7D32] mt-0.5" />
                  <span>
                    <strong>Hardware:</strong> carcasa impresa en 3D, Arduino
                    Nano ESP32, sensor de pH profesional, sensor de temperatura,
                    batería recargable y doble LED indicador.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E7D32] mt-0.5" />
                  <span>
                    <strong>App Móvil PWA (Manipuladores):</strong> el personal de
                    cocina ingresa con el usuario de manipuladores de su
                    institución, mide por Bluetooth y guarda cada lectura.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E7D32] mt-0.5" />
                  <span>
                    <strong>Portal Web (Administradores):</strong> la dirección y
                    encargados de calidad ingresan con su cuenta de administración
                    para revisar el historial y exportar reportes en solo consulta.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Sección 4: Portal de Establecimientos (Solo lectura + Login idéntico al index enviado) */}
      <section
        id="portal"
        className="border-t border-[#E1E3DA] bg-[#E8E9E1] py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
              04. Portal de administradores (Solo consulta)
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#17324D]">
              Consulta el historial de tu institución
            </h2>
            <p className="text-sm text-[#55656D]">
              Este portal web es de acceso exclusivo para administradores de cada
              institución. Si aún no forman parte de MEEP, envía la solicitud de
              integración y les enviaremos sus credenciales por correo.
            </p>
          </div>

          {!profile ? (
            /* Tarjeta de acceso de administradores + formulario de integración */
            <div className="mx-auto w-full max-w-[450px] rounded-[24px] border border-[#DDE2DC] bg-[#F7F7F2] shadow-[0_14px_40px_rgba(23,50,77,0.12)] overflow-hidden">
              <div className="bg-[#17324D] text-white text-center px-5 py-7">
                <strong className="font-display text-sm tracking-[0.16em]">
                  MEEP · ADMINISTRACIÓN
                </strong>
                <h3 className="font-display text-[28px] font-bold mt-2 mb-0.5 leading-tight">
                  {portalMode === 'login'
                    ? 'Iniciar sesión'
                    : 'Integrar institución'}
                </h3>
                <p className="text-sm text-white/80">
                  {portalMode === 'login'
                    ? 'Acceso exclusivo para administradores del establecimiento'
                    : 'Envía los datos base de tu institución para recibir acceso'}
                </p>
              </div>

              <div className="p-6">
                <div
                  className="grid grid-cols-2 gap-2 mb-4"
                  role="tablist"
                  aria-label="Opciones de acceso al portal"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={portalMode === 'login'}
                    onClick={() => {
                      setPortalMode('login');
                      setAuthError('');
                      setRequestSent(null);
                    }}
                    className={`min-h-[44px] rounded-xl font-extrabold text-sm border transition-colors ${
                      portalMode === 'login'
                        ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                        : 'bg-white text-[#55656D] border-[#DDE2DC]'
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={portalMode === 'request'}
                    onClick={() => {
                      setPortalMode('request');
                      setAuthError('');
                    }}
                    className={`min-h-[44px] rounded-xl font-extrabold text-sm border transition-colors ${
                      portalMode === 'request'
                        ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                        : 'bg-white text-[#55656D] border-[#DDE2DC]'
                    }`}
                  >
                    Solicitar acceso
                  </button>
                </div>

                {!isSupabaseConfigured && (
                  <div className="mb-3 rounded-xl border border-[#F4A261] bg-[#FDEEDF] p-3 text-xs text-[#263238]">
                    <strong>Conexión pendiente en este entorno:</strong>{' '}
                    configura{' '}
                    <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
                    <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en
                    los Secrets de GitHub o en tu archivo{' '}
                    <code className="font-mono">.env</code>.
                  </div>
                )}

                {authError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-[#E3A8A8] bg-[#FAE8E8] px-3 py-2.5 text-sm text-[#C62828] font-semibold"
                  >
                    {authError}
                  </div>
                )}

                {portalMode === 'request' && requestSent ? (
                  <div className="rounded-2xl border border-[#BBD8BF] bg-[#E5F0E6] p-5 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2E7D32]">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h4 className="font-display text-lg font-bold text-[#17324D]">
                      ¡Solicitud recibida!
                    </h4>
                    <p className="text-sm text-[#263238]">
                      Registramos los datos de{' '}
                      <strong>{requestSent.institucion}</strong>. Al correo{' '}
                      <strong>{requestSent.correo}</strong> que nos entregaste
                      les llegará el <strong>usuario y contraseña</strong> que
                      crearemos para su institución (acceso administrador para la
                      web y acceso de manipuladores para la App MEEP).
                    </p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPortalMode('login');
                          setRequestSent(null);
                        }}
                        className="w-full min-h-[46px] rounded-xl bg-[#17324D] text-white text-sm font-extrabold hover:bg-[#10253a]"
                      >
                        Ir a Iniciar sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequestSent(null)}
                        className="w-full min-h-[42px] rounded-xl border border-[#DDE2DC] bg-white text-xs font-bold text-[#55656D] hover:text-[#17324D]"
                      >
                        Enviar otra solicitud
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePortalSubmit} className="space-y-3">
                    {portalMode === 'request' ? (
                      <>
                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Nombre de la institución</span>
                          <input
                            type="text"
                            required
                            maxLength={100}
                            value={nombreInstitucion}
                            onChange={(e) =>
                              setNombreInstitucion(e.target.value)
                            }
                            placeholder="Ej. Liceo Bicentenario de Viña del Mar"
                            className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          />
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Tipo de entidad</span>
                          <select
                            value={tipo}
                            onChange={(e) =>
                              setTipo(e.target.value as EstablishmentType)
                            }
                            className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          >
                            <option value="establecimiento">
                              Establecimiento educacional
                            </option>
                            <option value="casino_junaeb">
                              Casino escolar JUNAEB / PAE
                            </option>
                            <option value="pyme">
                              PYME / Distribuidora de alimentos
                            </option>
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Nombre del encargado o contacto</span>
                          <input
                            type="text"
                            required
                            maxLength={80}
                            value={nombreContacto}
                            onChange={(e) => setNombreContacto(e.target.value)}
                            placeholder="Ej. María Pérez (Encargada de casino)"
                            className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          />
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Correo para recibir credenciales</span>
                          <input
                            type="email"
                            required
                            value={correoContacto}
                            onChange={(e) => setCorreoContacto(e.target.value)}
                            placeholder="contacto@institucion.cl"
                            className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          />
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                            <span>Teléfono (opcional)</span>
                            <input
                              type="tel"
                              value={telefono}
                              onChange={(e) => setTelefono(e.target.value)}
                              placeholder="+56 9 1234 5678"
                              className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                            <span>Comuna / ciudad (opcional)</span>
                            <input
                              type="text"
                              value={ciudadComuna}
                              onChange={(e) => setCiudadComuna(e.target.value)}
                              placeholder="Viña del Mar"
                              className="w-full min-h-[48px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                            />
                          </label>
                        </div>

                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Datos adicionales (opcional)</span>
                          <textarea
                            rows={2}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Ej. Cantidad aproximada de manipuladores o comentarios…"
                            className="w-full rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-sm font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Usuario administrador</span>
                          <input
                            type="text"
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={identificador}
                            onChange={(e) => setIdentificador(e.target.value)}
                            placeholder="insucoadministracion"
                            className="w-full min-h-[50px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                          />
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
                          <span>Contraseña</span>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full min-h-[50px] rounded-[13px] border border-[#DDE2DC] bg-white px-3.5 py-2.5 pr-12 text-base font-normal text-[#263238] focus:border-[#2A9D8F] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={
                                showPassword
                                  ? 'Ocultar contraseña'
                                  : 'Mostrar contraseña'
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#55656D] hover:bg-[#E9ECEE]"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </label>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading || !isSupabaseConfigured}
                      className="w-full min-h-[52px] rounded-[14px] bg-[#17324D] text-white text-base font-extrabold hover:bg-[#10253a] disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {authLoading
                        ? 'Enviando…'
                        : portalMode === 'login'
                          ? 'Ingresar al portal'
                          : 'Enviar solicitud'}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={onOpenApp}
                  className="mt-2.5 w-full min-h-[50px] rounded-[14px] border-2 border-[#17324D] bg-white text-[#17324D] text-sm font-extrabold hover:bg-[#E0F1EF]"
                >
                  Ir a la App MEEP (acceso manipuladores)
                </button>
              </div>
            </div>
          ) : (
            /* Panel de solo lectura cuando el administrador ya inició sesión */
            <div className="rounded-3xl border border-[#DDE2DC] bg-white p-5 sm:p-7 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E1E3DA] pb-5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E0F1EF] text-[#2A9D8F]">
                    <Building2 className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-xl font-bold text-[#17324D] truncate">
                      {profile.nombre}
                    </div>
                    <div className="text-xs font-semibold text-[#55656D]">
                      @{profile.usuario} · Administrador (Solo consulta)
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onRefreshHistory}
                    disabled={loadingHistory}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3.5 py-2 text-xs font-bold text-[#17324D] hover:bg-[#E0F1EF] min-h-[42px]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        loadingHistory ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Actualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={filteredRecords.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3.5 py-2 text-xs font-bold text-[#17324D] hover:bg-[#E0F1EF] disabled:opacity-45 min-h-[42px]"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[#2A9D8F]" />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenApp}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2A9D8F] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#23867a] min-h-[42px]"
                  >
                    <Bluetooth className="h-3.5 w-3.5" />
                    <span>Medir en App</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E1E3DA] bg-white px-3.5 py-2 text-xs font-bold text-[#C62828] hover:bg-[#FAE8E8] min-h-[42px]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>

              {/* KPIs del establecimiento */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-4">
                  <div className="text-xs font-semibold text-[#55656D]">
                    Total mediciones
                  </div>
                  <div className="font-display text-2xl font-bold text-[#17324D] tabular-nums mt-1">
                    {stats.total}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#E5F0E6] p-4">
                  <div className="text-xs font-semibold text-[#2E7D32]">
                    Dentro de rango
                  </div>
                  <div className="font-display text-2xl font-bold text-[#2E7D32] tabular-nums mt-1">
                    {stats.inRange}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#FAE8E8] p-4">
                  <div className="text-xs font-semibold text-[#C62828]">
                    Fuera de rango
                  </div>
                  <div className="font-display text-2xl font-bold text-[#C62828] tabular-nums mt-1">
                    {stats.outRange}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-4">
                  <div className="text-xs font-semibold text-[#55656D]">
                    Último registro
                  </div>
                  <div className="font-display text-sm font-bold text-[#17324D] tabular-nums mt-2">
                    {stats.latest
                      ? formatFechaHora(stats.latest)
                      : 'Sin registros aún'}
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-[#55656D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por manipulador, turno o dispositivo…"
                    className="w-full rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] pl-10 pr-3.5 py-2.5 text-sm focus:border-[#2A9D8F] focus:outline-none min-h-[42px]"
                  />
                </div>

                <select
                  aria-label="Filtrar por alimento"
                  value={foodFilter}
                  onChange={(e) => setFoodFilter(e.target.value)}
                  className="rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] px-3 py-2.5 text-sm font-semibold text-[#17324D] min-h-[42px]"
                >
                  <option value="all">Todos los alimentos</option>
                  {alimentos.map((a) => (
                    <option key={a.clave} value={a.clave}>
                      {a.nombre}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 rounded-xl border border-[#E1E3DA] bg-[#F7F7F2] p-1">
                  {(
                    [
                      ['all', 'Todos'],
                      ['in', 'En rango'],
                      ['out', 'Alerta'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap ${
                        statusFilter === key
                          ? 'bg-[#17324D] text-white'
                          : 'text-[#55656D] hover:text-[#17324D]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla de registros */}
              {filteredRecords.length === 0 ? (
                <div className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-8 text-center space-y-2">
                  <p className="font-display font-bold text-[#17324D]">
                    {registros.length === 0
                      ? 'Este establecimiento aún no tiene mediciones guardadas'
                      : 'No hay registros que coincidan con tu filtro'}
                  </p>
                  <p className="text-sm text-[#55656D]">
                    Los manipuladores deben ingresar en la{' '}
                    <button
                      type="button"
                      onClick={onOpenApp}
                      className="font-bold text-[#2A9D8F] underline"
                    >
                      App MEEP
                    </button>{' '}
                    con esta misma cuenta para medir con el dispositivo y
                    guardar aquí.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#E1E3DA]">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#F7F7F2] text-xs font-bold text-[#55656D] border-b border-[#E1E3DA]">
                      <tr>
                        <th className="py-3 px-4">Fecha y hora</th>
                        <th className="py-3 px-4">Alimento</th>
                        <th className="py-3 px-4 text-right">pH</th>
                        <th className="py-3 px-4 text-right">Temp.</th>
                        <th className="py-3 px-4">Resultado / LED</th>
                        <th className="py-3 px-4">Manipulador / Turno</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E3DA] bg-white">
                      {filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-[#F7F7F2]/60">
                          <td className="py-3 px-4 text-xs text-[#55656D] tabular-nums whitespace-nowrap">
                            {formatFechaHora(r.medido_at)}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#17324D]">
                            {getFoodName(r.alimento_clave)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-display font-bold tabular-nums ${
                              r.estado === 'in'
                                ? 'text-[#2E7D32]'
                                : r.estado === 'out'
                                  ? 'text-[#C62828]'
                                  : 'text-[#55656D]'
                            }`}
                          >
                            {formatPh(r.ph)}
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-semibold text-[#55656D] tabular-nums">
                            {r.temperatura !== null
                              ? `${r.temperatura.toFixed(1)} °C`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-xs font-bold">
                            <span
                              className={`inline-flex items-center gap-1.5 ${
                                r.estado === 'in'
                                  ? 'text-[#2E7D32]'
                                  : r.estado === 'out'
                                    ? 'text-[#C62828]'
                                    : 'text-[#55656D]'
                              }`}
                            >
                              {r.estado === 'in' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                              )}
                              <span>
                                {SUBESTADO_LABEL[r.subestado] ||
                                  ESTADO_CORTO[r.estado]}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#263238]">
                            {r.manipulador || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[#55656D]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#2A9D8F]" />
                  <span>
                    Vista de solo consulta. Las mediciones se registran
                    únicamente desde la App MEEP.
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  <span>Compatible con exportación CSV para auditoría</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sección 5: Equipo */}
      <section id="equipo" className="py-12 sm:py-16 bg-white border-t border-[#E1E3DA]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2A9D8F]">
              05. Equipo creador · Proyecto PEMI 2026
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#17324D]">
              Instituto Comercial Bicentenario de Viña del Mar (INSUCO ABG)
            </h2>
            <p className="text-sm text-[#55656D]">
              Especialidad de Programación · Curso 4°E · XXXI Concurso Planes de
              Negocios 2026 · Fundación Educacional Comeduc.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ['Eva Caraballo Marcano', 'Documentación y prototipo'],
              ['Sofía Inzunza Oyarzo', 'Planes de negocio y análisis'],
              ['Catalina Díaz Flores', 'Presupuesto y prototipo 3D'],
              ['Alejandra Restrepo Henao', 'Planes de negocio y validación'],
              ['Neliad Abarca Amaro', 'Desarrollo web, app y sistema'],
            ].map(([member, role]) => (
              <div
                key={member}
                className="rounded-2xl border border-[#E1E3DA] bg-[#F7F7F2] p-4"
              >
                <div className="font-display text-sm font-bold text-[#17324D]">
                  {member}
                </div>
                <div className="text-xs text-[#55656D] mt-1">{role}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#55656D]">
            Profesores guía: Rodrigo Torres Rojas (Emprendimiento) y Brandon
            Baxter (Programación Orientada a Objetos).
          </p>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E1E3DA] bg-[#F7F7F2] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#55656D]">
          <div className="font-semibold text-[#17324D]">
            MEEP · Proyecto PEMI 2026 · INSUCO Alberto Blest Gana
          </div>
          <div className="flex items-center gap-4">
            <a href="#problema" className="hover:text-[#17324D]">
              El problema
            </a>
            <a href="#solucion" className="hover:text-[#17324D]">
              Solución
            </a>
            <a href="#portal" className="hover:text-[#17324D]">
              Portal
            </a>
            <button
              type="button"
              onClick={onOpenApp}
              className="font-bold text-[#2A9D8F] hover:underline"
            >
              Abrir App MEEP
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
