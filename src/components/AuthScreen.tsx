import React, {useState} from 'react';
import {AlertCircle, ArrowLeft, Eye, EyeOff} from 'lucide-react';
import {isSupabaseConfigured, signInEstablishment} from '../lib/supabase';
import type {EstablishmentProfile} from '../types/meep';
import {PWAInstallButton} from './PWAInstallButton';

interface AuthScreenProps {
  onAuthenticated: (profile: EstablishmentProfile) => void;
  onContinueOffline?: () => void;
  onBackToWeb?: () => void;
  onGoRequestAccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  onContinueOffline,
  onBackToWeb,
  onGoRequestAccess,
}) => {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signInEstablishment(identificador, password, 'app');
      onAuthenticated(res.profile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión. Verifica los datos de tu institución.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-[#E8E9E1] flex flex-col items-center justify-center p-4 sm:p-6">
      {onBackToWeb && (
        <div className="w-full max-w-[430px] mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToWeb}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE2DC] bg-white px-3 py-2 text-xs font-bold text-[#17324D] hover:bg-[#E0F1EF] min-h-[40px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la página web</span>
          </button>
          <PWAInstallButton variant="header" />
        </div>
      )}

      <section
        aria-label="Acceso App MEEP para manipuladores"
        className="w-full max-w-[430px] rounded-[24px] border border-[#DDE2DC] bg-[#F7F7F2] shadow-[0_14px_40px_rgba(23,50,77,0.12)] overflow-hidden"
      >
        <header className="bg-[#17324D] text-white text-center px-5 py-7">
          <strong className="font-display text-sm tracking-[0.16em]">
            MEEP · APP DE MEDICIÓN
          </strong>
          <h1 className="font-display text-[28px] font-bold mt-2 mb-0.5 leading-tight">
            Iniciar sesión
          </h1>
          <p className="text-sm text-white/80">
            Ingresa con el usuario de manipuladores de tu institución para medir
            con MEEP
          </p>
        </header>

        <main className="p-5 sm:p-6">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-xl border border-[#F4A261] bg-[#FDEEDF] p-3 text-xs text-[#263238] space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#C62828] mt-0.5" />
                <div>
                  <p className="font-bold">
                    Base de datos Supabase aún no vinculada en este entorno
                  </p>
                  <p className="mt-0.5 text-[#55656D]">
                    Configura{' '}
                    <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
                    <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en
                    tu <code className="font-mono">.env</code> o Secrets de
                    GitHub.
                  </p>
                </div>
              </div>
              {onContinueOffline && (
                <button
                  type="button"
                  onClick={onContinueOffline}
                  className="w-full rounded-xl border border-[#17324D] bg-white py-2.5 px-3 text-xs font-extrabold text-[#17324D] hover:bg-[#E0F1EF] min-h-[40px]"
                >
                  Entrar en modo local de este dispositivo
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-[#E3A8A8] bg-[#FAE8E8] px-3 py-2.5 text-sm text-[#C62828] font-semibold"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <label className="flex flex-col gap-1 text-sm font-extrabold text-[#263238]">
              <span>Usuario de manipulador</span>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="comeducalimentos"
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
                    showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
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

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full min-h-[52px] rounded-[14px] bg-[#17324D] text-white text-base font-extrabold hover:bg-[#10253a] disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando…' : 'Ingresar a medir'}
            </button>
          </form>

          {onGoRequestAccess && (
            <div className="mt-4 rounded-xl border border-[#DDE2DC] bg-white px-3.5 py-3 text-center text-xs text-[#55656D]">
              ¿Tu institución aún no tiene credenciales MEEP?{' '}
              <button
                type="button"
                onClick={onGoRequestAccess}
                className="font-extrabold text-[#2A9D8F] hover:underline"
              >
                Solicitar integración en la web
              </button>
            </div>
          )}

          {onContinueOffline && (
            <button
              type="button"
              onClick={onContinueOffline}
              className="mt-2.5 w-full min-h-[50px] rounded-[14px] border-2 border-[#17324D] bg-white text-[#17324D] text-sm font-extrabold hover:bg-[#E0F1EF]"
            >
              Entrar sin cuenta (solo Bluetooth local)
            </button>
          )}
        </main>
      </section>
    </div>
  );
};
