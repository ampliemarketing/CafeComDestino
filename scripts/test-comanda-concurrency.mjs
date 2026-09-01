// ============================================================================
// Teste de concorrência das RPCs de comanda (migration 0037).
//
// Dispara N chamadas EM PARALELO na mesma comanda e confere se todas entraram
// — é o "dois garçons clicando ao mesmo tempo", só que determinístico.
//
// Como rodar (staging, com a 0037 já aplicada):
//
//   1. Abra o app, abra UMA comanda numa mesa qualquer.
//   2. Rode:  node --env-file=.env scripts/test-comanda-concurrency.mjs \
//               --email SEU_LOGIN --senha SUA_SENHA
//      (sem --table/--comanda ele lista as mesas com comanda aberta e para)
//   3. Repita com a mesa/comanda/produto escolhidos:
//      node --env-file=.env scripts/test-comanda-concurrency.mjs \
//        --email ... --senha ... --table tb-123 --comanda cmd-456 --produto prod-789 --n 40
//
// Passa se: linhas add = N, canceladas = metade, subtotal recalculado bate.
// (No código ANTIGO isso perdia lançamentos — dá pra provar dando checkout no
//  commit anterior à 0037 e rodando de novo.)
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const email = arg('email');
const senha = arg('senha');
const tableId = arg('table');
const comandaId = arg('comanda');
const produtoId = arg('produto');
const N = Number(arg('n', '30'));

if (!URL || !ANON) { console.error('Faltou VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file=.env).'); process.exit(1); }
if (!email || !senha) { console.error('Passe --email e --senha de um usuário com permissão de lançar/cancelar item.'); process.exit(1); }

const sb = createClient(URL, ANON);

const { error: authErr } = await sb.auth.signInWithPassword({ email, password: senha });
if (authErr) { console.error('Login falhou:', authErr.message); process.exit(1); }

// --- Sem mesa/comanda: só lista o que está aberto e sai ---------------------
if (!tableId || !comandaId || !produtoId) {
  const { data: tables } = await sb.from('dining_tables').select('id, number, comandas');
  console.log('\nMesas com comanda aberta:\n');
  for (const t of tables ?? []) {
    for (const c of t.comandas ?? []) {
      console.log(`  mesa ${t.number}  --table ${t.id}  --comanda ${c.id}  (${c.personName}, ${c.items?.length ?? 0} itens)`);
    }
  }
  const { data: prods } = await sb.from('products').select('id, name').limit(5);
  console.log('\nAlguns produtos:\n');
  for (const p of prods ?? []) console.log(`  --produto ${p.id}  (${p.name})`);
  console.log('\nRode de novo passando --table, --comanda e --produto.');
  process.exit(0);
}

const mkItem = (i) => ({
  id: `test-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
  productId: produtoId,
  productName: 'TESTE CONCORRENCIA',
  quantity: 1,
  unitPrice: 1,
  additions: [],
  status: 'ativo',
});

const readComanda = async () => {
  const { data } = await sb.from('dining_tables').select('comandas').eq('id', tableId).single();
  return (data?.comandas ?? []).find((c) => c.id === comandaId);
};

const before = await readComanda();
if (!before) { console.error('Comanda não encontrada nessa mesa.'); process.exit(1); }
const baseCount = before.items?.length ?? 0;
console.log(`\nComanda começa com ${baseCount} itens. Disparando ${N} lançamentos em paralelo...`);

// --- 1. N lançamentos concorrentes ---------------------------------------------
const addResults = await Promise.allSettled(
  Array.from({ length: N }, (_, i) =>
    sb.rpc('comanda_add_items', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_items: [mkItem(i)],
      p_stock_items: [],
    })
  )
);
const addOk = addResults.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
const addErr = addResults.length - addOk;

const afterAdd = await readComanda();
const testItems = (afterAdd.items ?? []).filter((it) => it.productName === 'TESTE CONCORRENCIA');
console.log(`  RPC ok: ${addOk}/${N}   erros: ${addErr}`);
console.log(`  linhas de teste na comanda: ${testItems.length}  (esperado ${N})`);

// --- 2. cancela metade, em paralelo ------------------------------------------
const toCancel = testItems.slice(0, Math.floor(testItems.length / 2));
console.log(`\nCancelando ${toCancel.length} linhas em paralelo...`);
await Promise.allSettled(
  toCancel.map((it) =>
    sb.rpc('comanda_cancel_item', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_item_id: it.id,
      p_reason: 'teste de concorrência',
    })
  )
);

const afterCancel = await readComanda();
const testAfter = (afterCancel.items ?? []).filter((it) => it.productName === 'TESTE CONCORRENCIA');
const canceled = testAfter.filter((it) => it.status === 'cancelado').length;
const ativos = testAfter.filter((it) => it.status !== 'cancelado').length;

const expectedSubtotal = (afterCancel.items ?? [])
  .filter((it) => it.status !== 'cancelado')
  .reduce((s, it) => s + it.unitPrice * it.quantity, 0);

console.log(`  linhas canceladas: ${canceled}  (esperado ${toCancel.length})`);
console.log(`  subtotal da comanda: ${afterCancel.subtotal}  | recalculado: ${expectedSubtotal}`);

// --- veredito ---------------------------------------------------------------
const pass =
  testItems.length === N &&
  canceled === toCancel.length &&
  Math.abs((afterCancel.subtotal ?? 0) - expectedSubtotal) < 0.01;

console.log(`\n${pass ? 'PASSOU ✅' : 'FALHOU ❌'} — ${ativos} linhas de teste ativas restantes.`);
console.log('Limpe a comanda de teste no app antes de usar a mesa de verdade.\n');
process.exit(pass ? 0 : 1);
