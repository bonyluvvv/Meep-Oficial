import React, {useCallback, useEffect, useState} from 'react';
import {
  ArrowLeft,
  Clock,
  Globe,
  HelpCircle,
  LogOut,
  Building2,
} from 'lucide-react';
import {AuthScreen} from './components/AuthScreen';
import {HelpView} from './components/HelpView';
import {HistoryView} from './components/HistoryView';
import {
  MeasureFlow,
  type MeasureViewStep,
} from './components/MeasureFlow';
import {MeepLogo, ProbeIcon} from './components/MeepIcons';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {WebLandingPortal} from './components/WebLandingPortal';
import {meepBluetooth, type BleReading} from './lib/bluetooth';
import {DEFAULT_ALIMENTOS, interpretarPh} from './lib/meepCore';
import {
  deleteMedicion,
  fetchAlimentos,
  fetchMediciones,
  insertMedicion,
  isSupabaseConfigured,
  restoreSession,
  signOutEstablishment,
} from './lib/supabase';
import type {
  BluetoothConnectionState,
  EstablishmentProfile,
  FoodDefinition,
  FoodKey,
  MeasurementRecord,
} from './types/meep';

type MainTab = 'medir' | 'historial' | 'ayuda';
type AppSurface = 'web' | 'app';

const LOCAL_HISTORY_KEY = 'meep.local.mediciones.v1';
const LOCAL_HANDLER_KEY = 'meep.manipulador.v1';

function detectInitialSurface(): AppSurface {
  if (typeof window === 'undefined') return 'web';
  if (
    window.location.hash.startsWith('#/app') ||
    window.location.search.includes('app=1')
  ) {
    return 'app';
  }
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as {standalone?: boolean}).standalone === true;
  return isStandalone ? 'app' : 'web';
}

export default function App() {
  const [surface, setSurface] = useState<AppSurface>(detectInitialSurface);
  const [authReady, setAuthReady] = useState(false);
  const [webProfile, setWebProfile] = useState<EstablishmentProfile | null>(
    null,
  );
  const [appProfile, setAppProfile] = useState<EstablishmentProfile | null>(
    null,
  );
  const [localOnlyMode, setLocalOnlyMode] = useState(false);

  const [tab, setTab] = useState<MainTab>('medir');
  const [measureStep, setMeasureStep] = useState<MeasureViewStep>('home');

  const [alimentos, setAlimentos] =
    useState<FoodDefinition[]>(DEFAULT_ALIMENTOS);
  const [selectedFood, setSelectedFood] = useState<FoodKey | null>(null);

  const [btState, setBtState] = useState<BluetoothConnectionState>('off');
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [btError, setBtError] = useState('');
  const [liveReading, setLiveReading] = useState<BleReading | null>(null);

  const [manipulador, setManipulador] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_HANDLER_KEY) || '';
    } catch {
      return '';
    }
  });

  const [webRegistros, setWebRegistros] = useState<MeasurementRecord[]>([]);
  const [loadingWebHistory, setLoadingWebHistory] = useState(false);
  const [appRegistros, setAppRegistros] = useState<MeasurementRecord[]>([]);
  const [loadingAppHistory, setLoadingAppHistory] = useState(false);
  const [lastResult, setLastResult] = useState<MeasurementRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedToCloud, setSavedToCloud] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? '' : prev));
    }, 2600);
  }, []);

  const openSurface = useCallback((next: AppSurface) => {
    setSurface(next);
    if (typeof window !== 'undefined') {
      const targetHash = next === 'app' ? '#/app' : '#/';
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
      window.scrollTo({top: 0, behavior: 'auto'});
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash.startsWith('#/app')) {
        setSurface('app');
      } else if (window.location.hash === '#/' || window.location.hash === '') {
        setSurface('web');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadLocalHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MeasurementRecord[]) : [];
    } catch {
      return [];
    }
  }, []);

  const saveLocalHistory = useCallback((items: MeasurementRecord[]) => {
    try {
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const syncWebHistory = useCallback(async () => {
    setLoadingWebHistory(true);
    try {
      const items = await fetchMediciones('web');
      setWebRegistros(items);
    } catch {
      setWebRegistros([]);
    } finally {
      setLoadingWebHistory(false);
    }
  }, []);

  const syncAppHistory = useCallback(async () => {
    setLoadingAppHistory(true);
    try {
      const items = await fetchMediciones('app');
      setAppRegistros(items);
      saveLocalHistory(items);
    } catch {
      setAppRegistros(loadLocalHistory());
    } finally {
      setLoadingAppHistory(false);
    }
  }, [loadLocalHistory, saveLocalHistory]);

  // Carga inicial de sesiones (web admin y app manipuladores) y catálogo de alimentos
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const foods = await fetchAlimentos();
        if (active) setAlimentos(foods);
      } catch {
        // usa DEFAULT_ALIMENTOS
      }

      if (!isSupabaseConfigured) {
        if (active) setAuthReady(true);
        return;
      }

      try {
        const [webP, appP] = await Promise.all([
          restoreSession('web'),
          restoreSession('app'),
        ]);
        if (active) {
          if (webP) {
            setWebProfile(webP);
            await syncWebHistory();
          }
          if (appP) {
            setAppProfile(appP);
            await syncAppHistory();
          }
        }
      } catch {
        // sin sesión activa
      } finally {
        if (active) setAuthReady(true);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [syncAppHistory, syncWebHistory]);

  // Escucha eventos Bluetooth en vivo
  useEffect(() => {
    meepBluetooth.setOnDisconnect(() => {
      setBtState('off');
      setBtDeviceName(null);
      showToast('Dispositivo MEEP desconectado');
    });
    meepBluetooth.setOnReading((reading) => {
      setLiveReading(reading);
    });
    return () => {
      meepBluetooth.setOnDisconnect(null);
      meepBluetooth.setOnReading(null);
    };
  }, [showToast]);

  const handleChangeManipulador = (val: string) => {
    setManipulador(val);
    try {
      localStorage.setItem(LOCAL_HANDLER_KEY, val);
    } catch {
      // ignore
    }
  };

  const handleConnectBt = async (scanAll = false) => {
    setBtState('connecting');
    setBtError('');
    try {
      const {deviceName} = await meepBluetooth.connect({
        scanAllDevices: scanAll,
      });
      setBtDeviceName(deviceName);
      setBtState('connected');
      showToast(`Conectado a ${deviceName}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con MEEP por Bluetooth.';
      // Si el usuario cerró el selector del navegador sin elegir, vuelve a estado off limpio
      if (
        message.toLowerCase().includes('cancelled') ||
        message.toLowerCase().includes('canceled')
      ) {
        setBtState('off');
        return;
      }
      setBtError(message);
      setBtState('error');
    }
  };

  const handleDisconnectBt = () => {
    meepBluetooth.disconnect();
    setBtState('off');
    setBtDeviceName(null);
    setLiveReading(null);
  };

  const handleReadBtMeasurement = async () => {
    const reading = await meepBluetooth.readMeasurement(5500);
    setLiveReading(reading);
    return {ph: reading.ph, temperatura: reading.temperatura};
  };

  const handleCommitMeasurement = async (data: {
    ph: number | null;
    temperatura: number | null;
    origen: 'bluetooth' | 'demo';
  }) => {
    if (!selectedFood) return;

    const interpretation = interpretarPh(selectedFood, data.ph, alimentos);
    const draftRecord: MeasurementRecord = {
      id: `local-${Date.now()}`,
      establecimiento_id: appProfile?.id,
      alimento_clave: selectedFood,
      ph: data.ph,
      temperatura: data.temperatura,
      estado: interpretation.estado,
      subestado: interpretation.subestado,
      led_color: interpretation.led_color,
      motivo: interpretation.motivo,
      manipulador: manipulador.trim() || null,
      dispositivo_codigo:
        data.origen === 'bluetooth' ? btDeviceName || 'MEEP-BLE' : null,
      origen: data.origen,
      medido_at: new Date().toISOString(),
    };

    setLastResult(draftRecord);
    setSavedToCloud(false);
    setSaveError('');

    if (appProfile && isSupabaseConfigured) {
      setSaving(true);
      try {
        const saved = await insertMedicion(
          {
            establecimiento_id: appProfile.id,
            alimento_clave: draftRecord.alimento_clave,
            ph: draftRecord.ph,
            temperatura: draftRecord.temperatura,
            estado: draftRecord.estado,
            subestado: draftRecord.subestado,
            led_color: draftRecord.led_color,
            motivo: draftRecord.motivo,
            manipulador: draftRecord.manipulador,
            dispositivo_codigo: draftRecord.dispositivo_codigo,
            origen: draftRecord.origen,
            medido_at: draftRecord.medido_at,
          },
          'app',
        );
        setLastResult(saved);
        const updated = [saved, ...appRegistros];
        setAppRegistros(updated);
        saveLocalHistory(updated);
        setSavedToCloud(true);
        if (webProfile && webProfile.id === appProfile.id) {
          void syncWebHistory();
        }
      } catch (err) {
        const updated = [draftRecord, ...appRegistros];
        setAppRegistros(updated);
        saveLocalHistory(updated);
        setSaveError(
          err instanceof Error
            ? `Guardado localmente, pero no se pudo sincronizar con Supabase: ${err.message}`
            : 'No se pudo sincronizar con Supabase en este momento.',
        );
      } finally {
        setSaving(false);
      }
    } else {
      const updated = [draftRecord, ...appRegistros];
      setAppRegistros(updated);
      saveLocalHistory(updated);
    }
  };

  const handleRetrySave = async () => {
    if (!lastResult || !appProfile || !isSupabaseConfigured) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await insertMedicion(
        {
          establecimiento_id: appProfile.id,
          alimento_clave: lastResult.alimento_clave,
          ph: lastResult.ph,
          temperatura: lastResult.temperatura,
          estado: lastResult.estado,
          subestado: lastResult.subestado,
          led_color: lastResult.led_color,
          motivo: lastResult.motivo,
          manipulador: lastResult.manipulador,
          dispositivo_codigo: lastResult.dispositivo_codigo,
          origen: lastResult.origen,
          medido_at: lastResult.medido_at,
        },
        'app',
      );
      setLastResult(saved);
      const updated = [
        saved,
        ...appRegistros.filter((r) => r.id !== lastResult.id),
      ];
      setAppRegistros(updated);
      saveLocalHistory(updated);
      setSavedToCloud(true);
      if (webProfile && webProfile.id === appProfile.id) {
        void syncWebHistory();
      }
      showToast('Medición sincronizada con Supabase');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Error al sincronizar.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (appProfile && isSupabaseConfigured && !id.startsWith('local-')) {
      await deleteMedicion(id, 'app');
    }
    const updated = appRegistros.filter((r) => r.id !== id);
    setAppRegistros(updated);
    saveLocalHistory(updated);
    if (webProfile && appProfile && webProfile.id === appProfile.id) {
      void syncWebHistory();
    }
    showToast('Registro eliminado');
  };

  const handleWebLogout = async () => {
    await signOutEstablishment('web');
    setWebProfile(null);
    setWebRegistros([]);
  };

  const handleAppLogout = async () => {
    handleDisconnectBt();
    await signOutEstablishment('app');
    setAppProfile(null);
    setLocalOnlyMode(false);
    setAppRegistros([]);
    setLastResult(null);
    setMeasureStep('home');
    setTab('medir');
  };

  if (!authReady) {
    return (
      <div className="min-h-full bg-[#EFEFE8] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <MeepLogo size={48} />
          <p className="font-display text-base font-bold text-[#17324D]">
            Iniciando MEEP…
          </p>
        </div>
      </div>
    );
  }

  if (surface === 'web') {
    return (
      <>
        <OfflineIndicator />
        <WebLandingPortal
          profile={webProfile}
          alimentos={alimentos}
          registros={webRegistros}
          loadingHistory={loadingWebHistory}
          onAuthenticated={async (est) => {
            setWebProfile(est);
            await syncWebHistory();
          }}
          onLogout={handleWebLogout}
          onRefreshHistory={() => {
            if (webProfile) void syncWebHistory();
          }}
          onOpenApp={() => openSurface('app')}
        />
      </>
    );
  }

  if (!appProfile && !localOnlyMode) {
    return (
      <AuthScreen
        onAuthenticated={async (est) => {
          setAppProfile(est);
          setMeasureStep('home');
          setTab('medir');
          await syncAppHistory();
        }}
        onContinueOffline={() => {
          setLocalOnlyMode(true);
          setAppRegistros(loadLocalHistory());
        }}
        onBackToWeb={() => openSurface('web')}
        onGoRequestAccess={() => {
          openSurface('web');
          window.setTimeout(() => {
            document
              .getElementById('portal')
              ?.scrollIntoView({behavior: 'smooth'});
          }, 80);
        }}
      />
    );
  }

  const showBackInHeader = tab === 'medir' && measureStep !== 'home';
  const headerTitle =
    tab === 'medir'
      ? measureStep === 'food'
        ? 'Selecciona el alimento'
        : measureStep === 'measure'
          ? 'Medición de pH'
          : measureStep === 'result'
            ? 'Resultado'
            : null
      : null;

  const handleHeaderBack = () => {
    if (measureStep === 'food') setMeasureStep('home');
    else if (measureStep === 'measure') setMeasureStep('food');
    else if (measureStep === 'result') setMeasureStep('measure');
  };

  return (
    <div className="min-h-full bg-[#EFEFE8] flex flex-col">
      {/* Barra superior compacta */}
      <header className="sticky top-0 z-30 bg-[#17324D] text-white border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {showBackInHeader ? (
              <button
                type="button"
                onClick={handleHeaderBack}
                aria-label="Volver"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <MeepLogo size={32} />
            )}

            {headerTitle ? (
              <span className="font-display text-base sm:text-lg font-semibold truncate">
                {headerTitle}
              </span>
            ) : (
              <div className="min-w-0">
                <span className="font-display text-lg font-bold tracking-[0.14em] leading-none block">
                  MEEP
                </span>
                <span className="text-[11px] font-semibold text-white/75 truncate block">
                  {appProfile ? appProfile.nombre : 'Modo local'}
                </span>
              </div>
            )}
          </div>

          {/* Navegación desktop limpia */}
          <nav
            aria-label="Navegación principal escritorio"
            className="hidden md:flex items-center gap-6 text-sm font-bold"
          >
            {(
              [
                ['medir', 'Medir'],
                ['historial', 'Historial'],
                ['ayuda', 'Ayuda'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  if (key === 'medir' && measureStep === 'result') {
                    setMeasureStep('home');
                  }
                }}
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                  tab === key
                    ? 'border-[#2A9D8F] text-white'
                    : 'border-transparent text-white/75 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openSurface('web')}
              title="Ir a la página web"
              aria-label="Ir a la página web"
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white/12 px-3 text-xs font-bold text-white hover:bg-white/20 whitespace-nowrap shrink-0"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Web</span>
            </button>
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={handleAppLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white/12 px-3 text-xs font-bold text-white hover:bg-white/20 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
        <OfflineIndicator />
      </header>

      {/* Contenido principal responsive (móvil nativo + escritorio limpio) */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-4 pb-24 md:pb-10">
        <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
          {/* Columna principal (en móvil ocupa todo el ancho, en desktop 7/12 o centrado) */}
          <div className="md:col-span-7 lg:col-span-7">
            <div className="rounded-3xl bg-[#F7F7F2] md:border md:border-[#E1E3DA] md:p-5">
              {tab === 'medir' && (
                <MeasureFlow
                  step={measureStep}
                  onChangeStep={setMeasureStep}
                  btState={btState}
                  btDeviceName={btDeviceName}
                  btError={btError}
                  liveReading={liveReading}
                  onConnectBt={handleConnectBt}
                  onDisconnectBt={handleDisconnectBt}
                  onReadBtMeasurement={handleReadBtMeasurement}
                  alimentos={alimentos}
                  selectedFood={selectedFood}
                  onSelectFood={setSelectedFood}
                  manipulador={manipulador}
                  onChangeManipulador={handleChangeManipulador}
                  onCommitMeasurement={handleCommitMeasurement}
                  lastResult={lastResult}
                  saving={saving}
                  savedToCloud={savedToCloud}
                  saveError={saveError}
                  onRetrySave={handleRetrySave}
                  onGoHistory={() => setTab('historial')}
                  onGoHelp={() => setTab('ayuda')}
                />
              )}

              {tab === 'historial' && (
                <HistoryView
                  registros={appRegistros}
                  alimentos={alimentos}
                  loading={loadingAppHistory}
                  onRefresh={() => {
                    if (appProfile) void syncAppHistory();
                  }}
                  onDelete={handleDeleteRecord}
                  onGoMeasure={() => {
                    setTab('medir');
                    setMeasureStep('food');
                  }}
                />
              )}

              {tab === 'ayuda' && (
                <HelpView
                  onGoMeasure={() => {
                    setTab('medir');
                    setMeasureStep('food');
                  }}
                />
              )}
            </div>
          </div>

          {/* Panel lateral en escritorio: resumen de establecimiento e historial reciente */}
          <aside className="hidden md:block md:col-span-5 lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-[#E1E3DA] bg-white p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E0F1EF] text-[#2A9D8F]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#55656D]">
                    Sesión de manipuladores
                  </div>
                  <div className="font-display text-base font-bold text-[#17324D] truncate">
                    {appProfile ? appProfile.nombre : 'Modo local'}
                  </div>
                  {appProfile && (
                    <div className="text-xs text-[#55656D] truncate">
                      @{appProfile.usuario}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E1E3DA] text-center">
                <div className="rounded-2xl bg-[#F7F7F2] p-2.5">
                  <div className="font-display text-xl font-bold text-[#17324D] tabular-nums">
                    {appRegistros.length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#55656D]">
                    Registros
                  </div>
                </div>
                <div className="rounded-2xl bg-[#E5F0E6] p-2.5">
                  <div className="font-display text-xl font-bold text-[#2E7D32] tabular-nums">
                    {appRegistros.filter((r) => r.estado === 'in').length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#2E7D32]">
                    En rango
                  </div>
                </div>
                <div className="rounded-2xl bg-[#FAE8E8] p-2.5">
                  <div className="font-display text-xl font-bold text-[#C62828] tabular-nums">
                    {appRegistros.filter((r) => r.estado === 'out').length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#C62828]">
                    Alerta
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E1E3DA] bg-white p-5 space-y-2.5 text-sm text-[#55656D]">
              <h3 className="font-display text-sm font-bold text-[#17324D]">
                Rangos de referencia lácteos
              </h3>
              <ul className="space-y-1.5 text-xs">
                <li className="flex justify-between">
                  <span className="font-semibold text-[#263238]">Leche</span>
                  <span className="font-bold tabular-nums">6,60 – 6,80 pH</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-[#263238]">Yogur</span>
                  <span className="font-bold tabular-nums">4,00 – 4,50 pH</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-[#263238]">Queso</span>
                  <span className="font-bold tabular-nums">5,20 – 5,40 pH</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* Toast flotante */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-[#17324D] px-4 py-2.5 text-sm font-bold text-white shadow-lg whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}

      {/* Barra inferior fija en móvil */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 border-t border-[#E1E3DA] bg-white/95 backdrop-blur-md px-2 py-1"
      >
        {(
          [
            ['medir', 'Medir', ProbeIcon],
            ['historial', 'Historial', Clock],
            ['ayuda', 'Ayuda', HelpCircle],
          ] as const
        ).map(([key, label, IconComp]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                setTab(key);
                if (key === 'medir' && measureStep === 'result') {
                  setMeasureStep('home');
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-xs font-bold min-h-[48px] transition-colors ${
                active
                  ? 'bg-[#E0F1EF] text-[#17324D]'
                  : 'text-[#55656D] hover:text-[#17324D]'
              }`}
            >
              <IconComp
                size={22}
                className={active ? 'text-[#2A9D8F]' : 'text-[#55656D]'}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
