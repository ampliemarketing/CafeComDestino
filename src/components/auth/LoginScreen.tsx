import React, { useState } from 'react';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase, setKeepConnected } from '../../lib/supabaseClient';
import { LegalModal } from '../legal/LegalModal';
import { isValidEmail, MAXLEN } from '../../lib/validation';

interface LoginScreenProps {
  banner?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ banner }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnectedState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);

    if (!isValidEmail(email)) {
      setError('Digite um email válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('secure-login', {
        body: { email: email.trim(), password },
      });

      if (invokeError) {
        let message = 'Não foi possível entrar. Tente novamente.';
        const context = (invokeError as { context?: Response }).context;
        if (context) {
          const body = await context.json().catch(() => null);
          if (body?.error) message = body.error;
        }
        throw new Error(message);
      }

      setKeepConnected(keepConnected);
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetMessage(null);

    if (!isValidEmail(email)) {
      setError('Digite um email válido para recuperar a senha.');
      return;
    }

    setResetLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      setResetMessage('Enviamos um link de recuperação para o seu email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o email de recuperação.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <img
        src="/login-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-stone-950/30" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1
            className="text-white text-4xl font-bold"
            style={{ fontFamily: '"Lora", Georgia, "Times New Roman", serif' }}
          >
            AmplieChef
          </h1>
          <p className="flex items-center gap-3.5 text-white/80 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <span className="w-8 h-px bg-white/50" />
            Gestão completa do seu restaurante
            <span className="w-8 h-px bg-white/50" />
          </p>
        </div>

        <div className="w-full bg-[#FBF7F1] rounded-[26px] shadow-2xl p-8 sm:p-9">
          <h2 className="text-stone-900 font-bold text-xl mb-5">Entre com sua conta</h2>

          {banner && (
            <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center font-medium">
              {banner}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-600">Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  maxLength={MAXLEN.email}
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, MAXLEN.email))}
                  className="w-full border border-stone-200 bg-white rounded-xl pl-10 pr-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder="voce@ampliechefe.com.br"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-600">Senha</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 72))}
                  className="w-full border border-stone-200 bg-white rounded-xl pl-10 pr-11 py-3 text-sm text-stone-900 outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/15"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 text-xs text-stone-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepConnected}
                  onChange={(e) => setKeepConnectedState(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-800"
                />
                Manter conectado
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 disabled:opacity-60"
              >
                {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
              </button>
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            {resetMessage && <p className="text-xs text-emerald-700 font-medium">{resetMessage}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-amber-800 to-amber-900 text-white rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 disabled:opacity-60 mt-1"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Entrar
            </button>

            <p className="text-center text-xs text-stone-500 pt-0.5">
              Não tem uma conta? <strong className="text-stone-700 font-bold">Entre em contato com o Administrador</strong>
            </p>
          </form>
        </div>

        <button
          type="button"
          onClick={() => setShowLegal(true)}
          className="text-center text-[11px] text-white/75 hover:text-white underline underline-offset-2"
        >
          Termos de Uso e Política de Privacidade
        </button>
      </div>

      {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
    </div>
  );
};
