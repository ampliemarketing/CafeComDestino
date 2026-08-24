// Edge Function chamada pelo painel "Usuários & Permissões" para criar
// funcionários. Só quem já é admin (checado pelo profile do chamador,
// usando o JWT recebido) pode criar novas contas — a service role key
// nunca é exposta ao frontend, só existe aqui como secret da function.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ALL_PERMISSIONS } from '../../../src/lib/permissions.ts';

const VALID_ROLES = ['admin', 'gerente', 'caixa', 'garcom', 'cozinha', 'estoque', 'financeiro'];
const VALID_PERMISSIONS = new Set(ALL_PERMISSIONS);

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: 'Não autenticado.' }, 401);

  const { data: callerProfile, error: callerProfileError } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfileError || callerProfile?.role !== 'admin') {
    return json({ error: 'Apenas administradores podem criar usuários.' }, 403);
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const role = body?.role;
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
  const code = typeof body?.code === 'string' ? body.code.trim() : null;
  const cpf = typeof body?.cpf === 'string' ? body.cpf.trim() : null;
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.filter((p: unknown) => typeof p === 'string' && VALID_PERMISSIONS.has(p))
    : [];

  if (!name || !email || !password || !role) {
    return json({ error: 'Nome, email, senha e cargo são obrigatórios.' }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
  }
  if (!VALID_ROLES.includes(role)) {
    return json({ error: 'Cargo inválido.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Falha ao criar usuário.' }, 400);
  }

  // O trigger on_auth_user_created já criou o profile com role padrão
  // 'garcom'; aqui aplicamos o cargo e os dados extras escolhidos pelo admin.
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ role, phone, code, cpf, permissions })
    .eq('id', created.user.id);

  if (profileError) {
    return json({ error: profileError.message }, 500);
  }

  return json({ success: true, userId: created.user.id });
});
