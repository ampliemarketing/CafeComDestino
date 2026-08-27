import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos no .env');
}

// Controla se a sessão sobrevive ao fechar a aba ("Manter conectado" no login).
// Chamado antes do signIn; a leitura sempre olha os dois storages para não
// derrubar sessões já existentes no localStorage de antes desta mudança.
let keepConnected = true;
export function setKeepConnected(value: boolean) {
  keepConnected = value;
}

const authStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    (keepConnected ? localStorage : sessionStorage).setItem(key, value);
    (keepConnected ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
});
