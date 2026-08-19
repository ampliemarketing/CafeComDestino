import React, { useState } from 'react';
import { Coffee, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) throw signUpError;
        setSignupDone(true);
      }
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
          <p className="text-xs text-stone-500">{mode === 'login' ? 'Entre com sua conta' : 'Criar conta de funcionário'}</p>
        </div>

        {signupDone ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-stone-700">
              Conta criada! Verifique seu email para confirmar o cadastro e depois faça login.
            </p>
            <button
              onClick={() => { setMode('login'); setSignupDone(false); }}
              className="w-full bg-amber-800 text-white rounded-xl py-2.5 text-sm font-bold"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Email</label>
              <input
                type="email"
                required
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
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
              className="w-full text-xs text-stone-500 font-medium py-1"
            >
              {mode === 'login' ? 'Não tem conta? Criar cadastro' : 'Já tem conta? Fazer login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
