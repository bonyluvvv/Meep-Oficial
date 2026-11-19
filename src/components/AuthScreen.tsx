import React, {useState} from 'react';
import {AlertCircle, Eye, EyeOff, LogIn, UserPlus} from 'lucide-react';
import {
  isSupabaseConfigured,
  normalizeUsuario,
  registerEstablishment,
  signInEstablishment,
} from '../lib/supabase';
import type {EstablishmentProfile, EstablishmentType} from '../types/meep';
import {MeepLogo} from './MeepIcons';
import {PWAInstallButton} from './PWAInstallButton';

interface AuthScreenProps {
  onAuthenticated: (profile: EstablishmentProfile) => void;
  onContinueOffline?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  onContinueOffline,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registro
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [tipo, setTipo] = useState<EstablishmentType>('establecimiento');
  const [correoContacto, setCorreoContacto] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await signInEstablishment(identificador, password);
        onAuthenticated(res.profile);
      } else {
        const res = await registerEstablishment({
          nombre,
          usuario,
          tipo,
          correoContacto,
          password,
        });
        onAuthenticated(res.profile);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la operación. Intenta nuevamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-[#EFEFE8] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#E1E3DA] bg-[#F7F7F2] shadow-sm overflow-hidden">
        <header className="bg-[#17324D] px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MeepLogo size={36} />
            <div className="min-w-0">
              <div className="font-display text-xl font-bold tracking-[0.14em] leading-none">
                MEEP
              </div>
              <div className="text-xs font-semibold text-white/80 mt-1 truncate">
                Medidor de pH de alimentos
              </div>
            </div>
          </div>
          <PWAInstallButton variant="header" />
        </header>

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#17324D]">
              {mode === 'login'
                ? 'Acceso de establecimientos'
                : 'Registrar establecimiento'}
            </h1>
            <p className="mt-1 text-sm text-[#55656D]">
              {mode === 'login'
                ? 'Ingresa con la cuenta de tu institución o casino para registrar y consultar mediciones.'
                : 'Crea una cuenta compartida para que los manipuladores de tu entidad registren mediciones en el mismo historial.'}
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-1 rounded-2xl border border-[#E1E3DA] bg-white p-1"
            role="tablist"
            aria-label="Tipo de acceso"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`rounded-xl py-2.5 px-3 text-sm font-bold transition-colors whitespace-nowrap min-h-[44px] ${
                mode === 'login'
                  ? 'bg-[#17324D] text-white'
                  : 'text-[#55656D] hover:text-[#17324D]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`rounded-xl py-2.5 px-3 text-sm font-bold transition-colors whitespace-nowrap min-h-[44px] ${
                mode === 'register'
                  ? 'bg-[#17324D] text-white'
                  : 'text-[#55656D] hover:text-[#17324D]'
              }`}
            >
              Registrar nuevo
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div className="rounded-2xl border border-[#F4A261] bg-[#FDEEDF] p-3.5 text-sm text-[#263238] space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-[#C62828] mt-0.5" />
                <div>
                  <p className="font-bold">
                    Base de datos Supabase aún no vinculada en este entorno
                  </p>
                  <p className="mt-0.5 text-xs text-[#55656D]">
                    Configura <code className="font-mono">VITE_SUPABASE_URL</code>{' '}
                    y <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en
                    tu archivo <code className="font-mono">.env</code> o en los
                    Secrets del repositorio para activar el inicio de sesión en
                    la nube.
                  </p>
                </div>
              </div>
              {onContinueOffline && (
                <button
                  type="button"
                  onClick={onContinueOffline}
                  className="w-full rounded-xl border border-[#17324D] bg-white py-2.5 px-3 text-xs font-extrabold text-[#17324D] hover:bg-[#E0F1EF] min-h-[40px]"
                >
                  Continuar en modo local de este dispositivo
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-[#C62828]/40 bg-[#FAE8E8] p-3.5 text-sm text-[#263238]"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-[#C62828] mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label
                    htmlFor="reg-nombre"
                    className="block text-sm font-bold text-[#17324D] mb-1.5"
                  >
                    Nombre del establecimiento o entidad
                  </label>
                  <input
                    id="reg-nombre"
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. INSUCO ABG o Casino Viña del Mar"
                    className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-usuario"
                    className="block text-sm font-bold text-[#17324D] mb-1.5"
                  >
                    Usuario único de acceso
                  </label>
                  <input
                    id="reg-usuario"
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={usuario}
                    onChange={(e) =>
                      setUsuario(normalizeUsuario(e.target.value))
                    }
                    placeholder="Ej. institutodecomercioinsucoabg"
                    className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
                  />
                  <p className="mt-1 text-xs text-[#55656D]">
                    Sin espacios. Este usuario lo usarán los manipuladores de tu
                    establecimiento.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-tipo"
                    className="block text-sm font-bold text-[#17324D] mb-1.5"
                  >
                    Tipo de entidad
                  </label>
                  <select
                    id="reg-tipo"
                    value={tipo}
                    onChange={(e) =>
                      setTipo(e.target.value as EstablishmentType)
                    }
                    className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
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
                </div>

                <div>
                  <label
                    htmlFor="reg-correo"
                    className="block text-sm font-bold text-[#17324D] mb-1.5"
                  >
                    Correo de contacto (opcional)
                  </label>
                  <input
                    id="reg-correo"
                    type="email"
                    value={correoContacto}
                    onChange={(e) => setCorreoContacto(e.target.value)}
                    placeholder="encargado@establecimiento.cl"
                    className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
                  />
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label
                  htmlFor="login-id"
                  className="block text-sm font-bold text-[#17324D] mb-1.5"
                >
                  Usuario o correo del establecimiento
                </label>
                <input
                  id="login-id"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="Ej. institutodecomercioinsucoabg"
                  className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-bold text-[#17324D] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa la clave de tu establecimiento"
                  className="w-full rounded-2xl border border-[#E1E3DA] bg-white px-4 py-3 pr-12 text-base text-[#263238] focus:border-[#2A9D8F] focus:outline-none min-h-[48px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl text-[#55656D] hover:bg-[#E9ECEE]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17324D] px-5 py-3.5 text-base font-extrabold text-white transition-colors hover:bg-[#10253a] disabled:opacity-45 disabled:cursor-not-allowed min-h-[54px]"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="h-5 w-5 shrink-0" />
                  <span>{loading ? 'Verificando…' : 'Iniciar sesión'}</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 shrink-0" />
                  <span>
                    {loading
                      ? 'Registrando entidad…'
                      : 'Registrar establecimiento'}
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="pt-1">
            <PWAInstallButton variant="card" />
          </div>
        </div>
      </div>
    </div>
  );
};
