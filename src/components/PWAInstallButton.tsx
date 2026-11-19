import React, {useState} from 'react';
import {Download, Share, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const {isInstallable, isInstalled, isIOS, isInAppBrowser, install} =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuide(true);
  };

  const label = isInstallable
    ? 'Instalar app'
    : isIOS
      ? 'Instalar en iPhone'
      : 'Instalar app';

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleAction}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2A9D8F] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#23867a] whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#17324D] bg-white px-4 py-3.5 text-[15px] font-extrabold text-[#17324D] transition-colors hover:bg-[#E0F1EF] whitespace-nowrap shrink-0 min-h-[52px]"
        >
          <Download className="h-5 w-5 shrink-0" />
          <span>Descargar / Instalar en celular</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#E1E3DA] bg-white p-6 text-[#263238] shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3
                id="install-guide-title"
                className="font-display text-lg font-bold text-[#17324D]"
              >
                Instalar MEEP en tu celular
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar instrucciones"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#55656D] hover:bg-[#E9ECEE]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isInAppBrowser && (
              <div className="mt-3 rounded-2xl border border-[#F4A261] bg-[#FDEEDF] p-3 text-xs font-semibold text-[#263238]">
                Abriste el enlace desde una app (WhatsApp, Instagram, etc.).
                Toca el menú <strong>⋮</strong> o compartir y elige{' '}
                <strong>Abrir en Chrome / Safari</strong> para poder instalar
                MEEP.
              </div>
            )}

            {isIOS ? (
              <ol className="mt-4 space-y-3 text-sm text-[#263238]">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    1
                  </span>
                  <span>
                    Asegúrate de estar en <strong>Safari</strong> y toca el
                    botón{' '}
                    <strong className="inline-flex items-center gap-1">
                      Compartir <Share className="h-3.5 w-3.5" />
                    </strong>{' '}
                    en la barra inferior.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    2
                  </span>
                  <span>
                    Desliza hacia abajo y selecciona{' '}
                    <strong>Agregar a inicio</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    3
                  </span>
                  <span>
                    Para usar Bluetooth en iPhone, abre esta misma dirección en
                    el navegador <strong>Bluefy</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-[#263238]">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    1
                  </span>
                  <span>
                    Abre esta página directamente en{' '}
                    <strong>Google Chrome</strong> en tu celular Android.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    2
                  </span>
                  <span>
                    Toca el menú <strong>⋮</strong> (arriba a la derecha) y
                    selecciona <strong>Instalar aplicación</strong> o{' '}
                    <strong>Agregar a pantalla principal</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17324D] text-xs font-extrabold text-white">
                    3
                  </span>
                  <span>
                    Se descargará en tu teléfono con el ícono de{' '}
                    <strong>MEEP</strong> y abrirá directo la App Bluetooth.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-2xl bg-[#17324D] py-3 text-sm font-extrabold text-white hover:bg-[#10253a] min-h-[44px]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
