import React, { useState } from 'react';
import { Coffee, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LegalModal } from '../legal/LegalModal';

interface LoginScreenProps {
  banner?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ banner }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegal, setShowLegal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F1EA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-stone-200 p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-800 text-white flex items-center justify-center mb-3">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-stone-900">CAFÉ COM DESTINO</h1>
          <p className="text-xs text-stone-500">Entre com sua conta</p>
        </div>

        {banner && (
          <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center font-medium">
            {banner}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
              placeholder="voce@cafecomdestino.com.br"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-800 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>

          <p className="text-center text-[10px] text-stone-400 pt-1">
            Não tem uma conta? Entre em contato com o Administrador
          </p>

          <button
            type="button"
            onClick={() => setShowLegal(true)}
            className="w-full text-center text-[10px] text-stone-400 hover:text-stone-600 underline underline-offset-2"
          >
            Termos de Uso e Política de Privacidade
          </button>
        </form>
      </div>

      {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
    </div>
  );
};
