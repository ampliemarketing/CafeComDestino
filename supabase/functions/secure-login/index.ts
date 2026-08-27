// Edge Function que centraliza o login por senha para poder aplicar
// bloqueio por tentativas erradas (proteção contra força bruta). O
// frontend não chama mais supabase.auth.signInWithPassword direto —
// chama esta function, que fala com o GoTrue usando a service role
// pra ler/escrever a tabela login_attempts (bloqueada por RLS pro
// cliente) antes de validar a senha.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return json({ error: 'Email e senha são obrigatórios.' }, 400);
  }

  // Validação de formato antes de bater no GoTrue — payload malformado é
  // rejeitado com erro claro em vez de virar "credenciais inválidas".
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailOk || email.length > 150) {
    return json({ error: 'Email inválido.' }, 400);
  }
  if (password.length < 6 || password.length > 72) {
    return json({ error: 'A senha precisa ter entre 6 e 72 caracteres.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: attempt } = await adminClient
    .from('login_attempts')
    .select('failed_count, locked_until')
    .eq('email', email)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const remainingMs = new Date(attempt.locked_until).getTime() - Date.now();
    const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
    return json(
      { error: `Muitas tentativas erradas. Tente novamente em ${remainingMin} minuto(s).`, lockedUntil: attempt.locked_until },
      429
    );
  }

  // Autentica chamando o GoTrue diretamente com a anon key — é o mesmo
  // endpoint que supabase-js usa por baixo dos panos no signInWithPassword.
  const authResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const authData = await authResp.json().catch(() => null);

  if (!authResp.ok || !authData?.access_token) {
    const nextFailedCount = (attempt?.failed_count ?? 0) + 1;
    const shouldLock = nextFailedCount >= MAX_ATTEMPTS;

    await adminClient.from('login_attempts').upsert({
      email,
      failed_count: shouldLock ? 0 : nextFailedCount,
      locked_until: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });

    if (shouldLock) {
      return json({ error: `Muitas tentativas erradas. Sua conta foi bloqueada por ${LOCKOUT_MINUTES} minutos.` }, 429);
    }

    const remaining = MAX_ATTEMPTS - nextFailedCount;
    return json({ error: `Email ou senha incorretos. Restam ${remaining} tentativa(s).` }, 401);
  }

  // Login certo: zera o contador.
  if (attempt) {
    await adminClient.from('login_attempts').delete().eq('email', email);
  }

  return json({
    access_token: authData.access_token,
    refresh_token: authData.refresh_token,
  });
});
