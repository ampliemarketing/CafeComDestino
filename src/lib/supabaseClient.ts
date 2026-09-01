import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos no .env');
}

// Modelo de sessão: UM OPERADOR POR NAVEGADOR (decisão do item #13 do checklist
// de go-live). A sessão vive no localStorage (padrão do supabase-js), que é
// compartilhado entre todas as abas da mesma origem — então todas as abas
// mostram sempre o mesmo usuário logado, e o supabase-js sincroniza login/logout
// entre abas sozinho. Não há caminho de sessionStorage por aba (que era o que
// permitia duas abas com usuários diferentes divergirem).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
