// ============================================================================
// Gerador do relatório de auditoria de segurança (PDF).
//
// Uso:   node docs/security-audit/gerar-relatorio.mjs
// Saída: docs/security-audit/relatorio-auditoria-seguranca.pdf
//        docs/security-audit/relatorio-auditoria-seguranca.html  (intermediário)
//        docs/security-audit/_preview-p1.png / _preview-p2.png    (rasterização p/ conferência)
//
// Sem dependências: monta o HTML e imprime via Chrome headless (CDP over WebSocket,
// WebSocket global do Node >= 22). Procura o Chrome/Edge instalado.
// ============================================================================
import { FINDINGS, META, PONTOS_FORTES, CATEGORIAS, RECOMENDACOES } from './dados-auditoria.mjs';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_HTML = join(HERE, 'relatorio-auditoria-seguranca.html');
const OUT_PDF = join(HERE, 'relatorio-auditoria-seguranca.pdf');

const COR = {
  critica: '#B91C1C', alta: '#EA580C', media: '#D97706',
  baixa: '#2563EB', informativa: '#6B7280', forte: '#059669',
};
const ROTULO = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa', informativa: 'Informativa',
};
const ORDEM = ['critica', 'alta', 'media', 'baixa', 'informativa'];

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

// ---------------------------------------------------------------------------
// Contagens
// ---------------------------------------------------------------------------
const porSeveridade = Object.fromEntries(ORDEM.map((s) => [s, 0]));
for (const f of FINDINGS) porSeveridade[f.severidade]++;

const porCategoria = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (const f of FINDINGS) {
  porCategoria[f.categoria]++;
  if (f.categoriaExtra) porCategoria[f.categoriaExtra]++;
}
const totalAcionaveis = FINDINGS.filter((f) => f.severidade !== 'informativa').length;

// ---------------------------------------------------------------------------
// Gráfico de rosca (SVG puro)
// ---------------------------------------------------------------------------
function donut(counts) {
  const entries = ORDEM.map((s) => [s, counts[s]]).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0) || 1;
  const cx = 90, cy = 90, r = 66, sw = 34;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = entries.map(([s, n]) => {
    const frac = n / total;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COR[s]}" stroke-width="${sw}"
      stroke-dasharray="${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}"
      stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += frac;
    return seg;
  }).join('');
  const leg = entries.map(([s, n]) =>
    `<div class="leg-item"><span class="dot" style="background:${COR[s]}"></span>${ROTULO[s]} <b>${n}</b></div>`
  ).join('');
  return `<div class="chart-wrap">
    <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Achados por severidade">
      ${segs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-num">${FINDINGS.length}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-lbl">achados</text>
    </svg>
    <div class="legend">${leg}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Gráfico de barras por categoria (SVG puro)
// ---------------------------------------------------------------------------
function barras(counts) {
  const cats = [1, 2, 3, 4, 5];
  const max = Math.max(1, ...cats.map((c) => counts[c]));
  const W = 470, rowH = 40, padL = 250, padR = 40, h = cats.length * rowH + 10;
  const barCorPorCat = { 1: COR.media, 2: COR.critica, 3: COR.alta, 4: COR.informativa, 5: COR.baixa };
  const rows = cats.map((c, i) => {
    const n = counts[c];
    const bw = (W - padL - padR) * (n / max);
    const y = i * rowH + 8;
    return `
      <text x="8" y="${y + 16}" class="bar-cat">${esc(CATEGORIAS[c])}</text>
      <rect x="${padL}" y="${y}" width="${Math.max(bw, n > 0 ? 4 : 0)}" height="22" rx="4" fill="${barCorPorCat[c]}"/>
      <text x="${padL + Math.max(bw, 4) + 8}" y="${y + 16}" class="bar-num">${n}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${h}" width="100%" height="${h}" role="img" aria-label="Achados por categoria">
    ${rows}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Chip de severidade
// ---------------------------------------------------------------------------
const chip = (sev) =>
  `<span class="chip" style="background:${COR[sev]}1a;color:${COR[sev]};border-color:${COR[sev]}55">${ROTULO[sev]}</span>`;

// ---------------------------------------------------------------------------
// Blocos de achado detalhado
// ---------------------------------------------------------------------------
function achadoDetalhado(f) {
  const arqs = f.arquivos.map(([a, l]) => `<code>${esc(a)}:${esc(l)}</code>`).join('<br>');
  const cats = [f.categoria, f.categoriaExtra].filter(Boolean)
    .map((c) => `Categoria ${c} — ${esc(CATEGORIAS[c])}`).join(' &nbsp;·&nbsp; ');
  return `<section class="finding">
    <h3>#${f.id} · ${esc(f.titulo)} ${chip(f.severidade)}</h3>
    <p class="finding-cat">${cats}</p>
    <table class="kv">
      <tr><th>Arquivo:linha</th><td>${arqs}</td></tr>
      <tr><th>Por que é explorável</th><td>${esc(f.porque).replaceAll('\n', '<br>')}</td></tr>
    </table>
    <div class="code-label">Evidência</div>
    <pre class="code">${esc(f.trecho)}</pre>
    <div class="code-label">Correção sugerida</div>
    <pre class="code fix">${esc(f.correcao)}</pre>
  </section>`;
}

// ---------------------------------------------------------------------------
// Issues para o GitHub
// ---------------------------------------------------------------------------
function issueMarkdown(f) {
  const labels = `security, ${f.severidade}`;
  const arqs = f.arquivos.map(([a, l]) => `- \`${a}:${l}\``).join('\n');
  const cats = [f.categoria, f.categoriaExtra].filter(Boolean)
    .map((c) => `Categoria ${c} (${CATEGORIAS[c]})`).join(' + ');
  const aceite = f.aceite.map((a) => `- [ ] ${a}`).join('\n');
  return `## [Segurança] ${f.titulo}

**Labels:** ${labels}
**Classificação:** ${ROTULO[f.severidade]} · ${cats}

### Problema e por que é explorável
${f.porque}

### Evidência
${arqs}

\`\`\`
${f.trecho}
\`\`\`

### Impacto
${f.impacto || f.titulo}

### Sugestão de correção
${f.correcao}

### Critérios de aceite
${aceite}
`;
}

function issuesSection() {
  const blocos = FINDINGS.map((f, i) => {
    const n = i + 1;
    return `<pre class="issue">--- ISSUE ${n} ---\n\n${esc(issueMarkdown(f))}\n--- FIM ISSUE ${n} ---</pre>`;
  }).join('\n');
  return `<h2>Issues para o GitHub</h2>
  <p class="muted">Um bloco por achado, pronto para copiar e colar. Achados triviais do mesmo tema estão agrupados.</p>
  ${blocos}`;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------
const css = `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1c1917; margin: 0; }
  h1,h2,h3 { color: #292524; line-height: 1.25; }
  h2 { font-size: 17px; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e7e5e4; }
  h3 { font-size: 13.5px; margin: 0 0 4px; }
  code { font-family: "SF Mono", "Cascadia Code", Consolas, monospace; font-size: 10.5px;
         background: #f5f5f4; padding: 1px 4px; border-radius: 3px; color: #44403c; }
  pre.code { font-family: "SF Mono", "Cascadia Code", Consolas, monospace; font-size: 9.5px;
             line-height: 1.45; background: #1c1917; color: #e7e5e4; padding: 10px 12px;
             border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
             margin: 4px 0 10px; }
  pre.code.fix { background: #052e16; color: #d1fae5; }
  .muted { color: #78716c; }
  .chip { display: inline-block; font-size: 9.5px; font-weight: 700; padding: 1px 8px;
          border-radius: 999px; border: 1px solid; vertical-align: middle; margin-left: 4px;
          letter-spacing: .3px; text-transform: uppercase; }

  /* ---- Capa ---- */
  .cover { height: 247mm; display: flex; flex-direction: column; justify-content: space-between;
           page-break-after: always; }
  .cover-top { border-left: 6px solid ${COR.critica}; padding-left: 18px; margin-top: 40mm; }
  .cover h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.5px; }
  .cover .sub { font-size: 14px; color: #57534e; }
  .cover .meta { margin-top: 26px; font-size: 12px; color: #44403c; }
  .cover .meta b { color: #1c1917; }
  .cover-method { font-size: 10.5px; color: #57534e; border-top: 1px solid #e7e5e4; padding-top: 12px; }
  .cover-method h4 { margin: 0 0 6px; font-size: 11px; color: #292524; text-transform: uppercase; letter-spacing: .5px; }
  .cover-method ul { margin: 0; padding-left: 16px; }
  .cover-method li { margin-bottom: 5px; }

  /* ---- Tabelas ---- */
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  table.kv th { text-align: left; width: 150px; vertical-align: top; color: #57534e;
                font-weight: 600; padding: 4px 8px 4px 0; }
  table.kv td { padding: 4px 0; vertical-align: top; }
  table.grid { margin: 8px 0 4px; }
  table.grid th { background: #f5f5f4; text-align: left; padding: 6px 8px; border: 1px solid #e7e5e4;
                  font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #57534e; }
  table.grid td { padding: 6px 8px; border: 1px solid #e7e5e4; vertical-align: top; }
  table.grid tr { page-break-inside: avoid; }

  .stack-strength { border-left: 3px solid ${COR.forte}; padding: 2px 0 2px 10px; margin-bottom: 9px; }
  .stack-strength b { color: ${COR.forte}; }
  .weak { border-left: 3px solid ${COR.alta}; padding: 2px 0 2px 10px; margin-bottom: 9px; }

  .cards { display: flex; gap: 8px; margin: 10px 0 4px; }
  .card { flex: 1; border: 1px solid #e7e5e4; border-radius: 8px; padding: 10px 12px; text-align: center; }
  .card .n { font-size: 22px; font-weight: 800; display: block; }
  .card .l { font-size: 9.5px; text-transform: uppercase; letter-spacing: .4px; color: #78716c; }

  .chart-wrap { display: flex; align-items: center; gap: 22px; margin: 6px 0 4px; }
  .donut-num { font-size: 30px; font-weight: 800; fill: #1c1917; }
  .donut-lbl { font-size: 10px; fill: #78716c; }
  .legend { display: flex; flex-direction: column; gap: 5px; font-size: 11px; }
  .leg-item { display: flex; align-items: center; gap: 7px; }
  .leg-item .dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  .bar-cat { font-size: 10px; fill: #44403c; }
  .bar-num { font-size: 11px; font-weight: 700; fill: #1c1917; }

  .finding { page-break-inside: avoid; margin: 14px 0; padding-top: 6px; border-top: 1px solid #f0eeec; }
  .finding-cat { font-size: 10px; color: #78716c; margin: 0 0 6px; }
  .code-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; color: #78716c; margin-top: 6px; }

  pre.issue { white-space: pre-wrap; word-break: break-word; font-family: "SF Mono", Consolas, monospace;
              font-size: 9px; line-height: 1.5; background: #fafaf9; border: 1px solid #e7e5e4;
              border-radius: 6px; padding: 12px 14px; margin: 10px 0; page-break-inside: avoid; }
  .rec-p { font-weight: 800; }
  section, h2 { page-break-after: avoid; }
`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de Auditoria de Segurança — ${esc(META.projeto)}</title>
<style>${css}</style></head><body>

<div class="cover">
  <div>
    <div class="cover-top">
      <h1>Relatório de Auditoria de Segurança</h1>
      <div class="sub">${esc(META.projeto)}</div>
    </div>
    <div class="meta">
      <p><b>Data:</b> ${esc(META.data)} &nbsp;·&nbsp; <b>Commit:</b> ${esc(META.commit)} (${esc(META.branch)})</p>
      <p><b>Escopo auditado:</b> aplicação SPA (<code>src/</code>), esquema e migrations do banco
      (<code>supabase/schema.sql</code>, <code>supabase/migrations/0002–0045</code>), Edge Functions
      (<code>supabase/functions/</code>), artefatos de deploy (<code>Dockerfile</code>, <code>nginx.conf</code>,
      <code>.env*</code>, <code>.dockerignore</code>) e arquivos versionados (<code>git ls-files</code> / histórico).</p>
    </div>
    <div class="meta">
      <table class="grid"><tbody>
      ${META.stack.map(([k, v]) => `<tr><th style="width:170px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>
  <div class="cover-method">
    <h4>Nota metodológica — como cada categoria foi mapeada para a stack</h4>
    <ul>${META.metodologia.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>
  </div>
</div>

<h2>Resumo executivo</h2>
<div class="cards">
  ${ORDEM.map((s) => `<div class="card"><span class="n" style="color:${COR[s]}">${porSeveridade[s]}</span><span class="l">${ROTULO[s]}</span></div>`).join('')}
</div>
<p class="muted">${FINDINGS.length} achados no total — ${totalAcionaveis} acionáveis + ${FINDINGS.length - totalAcionaveis} informativo.
Nenhuma falha de XSS e nenhum segredo real no código-fonte (ver Pontos fortes).</p>

<h3>Distribuição por severidade</h3>
${donut(porSeveridade)}

<h3>Achados por categoria</h3>
${barras(porCategoria)}

<h2>Pontos fortes (o que está protegido)</h2>
${PONTOS_FORTES.map(([t, d]) => `<div class="stack-strength"><b>${esc(t)}.</b> ${esc(d)}</div>`).join('')}

<h2>Pontos fracos (riscos centrais)</h2>
<div class="weak"><b>Camada de autorização em duas velocidades.</b> A escrita passou por um endurecimento sério (RPCs security definer com <code>has_any_permission</code>, triggers de imutabilidade, validação de preço no servidor), mas sobraram <b>ilhas que só checam <code>auth.role() = 'authenticated'</code></b>: a escrita de <code>company_profile</code> (Achado 1), o UPDATE de <code>orders</code> (Achado 2) e duas RPCs de venda sem guard (Achado 4). Como o front esconde essas ações por permissão, a diferença só aparece para quem chama a API direto.</div>
<div class="weak"><b>Leitura sem escopo de papel.</b> Quase todos os SELECT financeiros e a PII de clientes em <code>orders.customer</code> são visíveis a qualquer funcionário logado (Achado 3). <code>audit_log</code> e <code>financial_entries</code> mostram que o padrão permission-aware era conhecido — só não foi aplicado de forma consistente.</div>
<div class="weak"><b>Storage sem dono.</b> As policies do bucket <code>product-images</code> não amarram update/delete ao autor nem a permissão (Achado 5) — qualquer conta apaga a mídia do cardápio público.</div>

<h2>Achados detalhados</h2>
${['critica', 'alta', 'media', 'baixa', 'informativa'].map((sev) => {
  const grupo = FINDINGS.filter((f) => f.severidade === sev);
  if (!grupo.length) return '';
  return `<h3 style="color:${COR[sev]}">${ROTULO[sev]} (${grupo.length})</h3>` + grupo.map(achadoDetalhado).join('');
}).join('')}

<h2>Tabela de achados por categoria</h2>
${[1, 2, 3, 4, 5].map((cat) => {
  const grupo = FINDINGS.filter((f) => f.categoria === cat || f.categoriaExtra === cat);
  if (!grupo.length) return `<h3>Categoria ${cat} — ${esc(CATEGORIAS[cat])}</h3><p class="muted">Sem achados nesta categoria${cat === 5 ? ' — o frontend não possui sinks de HTML/JS dinâmico (verificado).' : '.'}</p>`;
  return `<h3>Categoria ${cat} — ${esc(CATEGORIAS[cat])}</h3>
  <table class="grid"><thead><tr><th style="width:78px">Severidade</th><th style="width:38%">Arquivo:linha</th><th>Descrição</th></tr></thead><tbody>
  ${grupo.map((f) => `<tr><td>${chip(f.severidade)}</td><td>${f.arquivos.map(([a, l]) => `<code>${esc(a)}:${esc(l)}</code>`).join('<br>')}</td><td><b>#${f.id}</b> ${esc(f.titulo)}</td></tr>`).join('')}
  </tbody></table>`;
}).join('')}

<h2>Recomendações priorizadas</h2>
<table class="grid"><thead><tr><th style="width:44px">Prio</th><th style="width:70px">Sev.</th><th style="width:30%">Ação</th><th>Detalhe</th></tr></thead><tbody>
${RECOMENDACOES.map(([p, s, a, d]) => `<tr><td class="rec-p">${p}</td><td>${ROTULO[s] ? chip(s) : esc(s)}</td><td><b>${esc(a)}</b></td><td>${esc(d)}</td></tr>`).join('')}
</tbody></table>

${issuesSection()}

</body></html>`;

writeFileSync(OUT_HTML, html, 'utf8');
console.log('HTML:', OUT_HTML);

// ---------------------------------------------------------------------------
// HTML -> PDF via Chrome headless (CDP / WebSocket)
// ---------------------------------------------------------------------------
function acharChrome() {
  const cands = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return cands.find((p) => existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cliente CDP minimalista sobre o WebSocket global do Node (EventTarget, não EventEmitter).
function makeCdp(ws) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method) {
      for (const fn of listeners) fn(m);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
  const onEvent = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  return { send, onEvent };
}

async function gerarPdf() {
  const chrome = acharChrome();
  if (!chrome) { console.error('Chrome/Edge não encontrado. Defina CHROME_PATH. HTML gerado; PDF não.'); process.exit(2); }
  console.log('Browser:', chrome);

  const profile = mkdtempSync(join(tmpdir(), 'audit-chrome-'));
  const port = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  ], { stdio: 'ignore' });

  try {
    let version = null;
    for (let i = 0; i < 60 && !version; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (r.ok) version = await r.json();
      } catch { await sleep(250); }
    }
    if (!version) throw new Error('DevTools não respondeu.');

    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = makeCdp(ws);

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);

    await send('Page.enable', {});
    const loaded = new Promise((res) => {
      const off = cdp.onEvent((m) => {
        if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) { off(); res(); }
      });
    });
    await send('Page.navigate', { url: pathToFileURL(OUT_HTML).href });
    await loaded;
    await sleep(400); // fontes/layout

    const footer = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#78716c;display:flex;justify-content:space-between;">
      <span>Relatório de Auditoria de Segurança — ${esc(META.projeto)}</span>
      <span>Página <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
    const header = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#a8a29e;text-align:right;">${esc(META.data)}</div>`;

    const { data } = await send('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: false,
      paperWidth: 8.27, paperHeight: 11.69,
      marginTop: 0.8, marginBottom: 0.7, marginLeft: 0.8, marginRight: 0.8,
      displayHeaderFooter: true, headerTemplate: header, footerTemplate: footer,
    });
    writeFileSync(OUT_PDF, Buffer.from(data, 'base64'));

    // rasterização para conferência visual (vai para a pasta temporária do SO)
    for (const [nome, y] of [[join(tmpdir(), 'audit-preview-p1.png'), 0], [join(tmpdir(), 'audit-preview-p2.png'), 1120]]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 794, height: 1123, deviceScaleFactor: 1, mobile: false,
        screenOrientation: { type: 'portraitPrimary', angle: 0 },
      });
      await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` });
      await sleep(150);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(nome, Buffer.from(shot.data, 'base64'));
    }

    ws.close();
    console.log('PDF :', OUT_PDF);
  } finally {
    proc.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

await gerarPdf();

// ---------------------------------------------------------------------------
// Verificação: nº de páginas do PDF
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
const pdfBuf = readFileSync(OUT_PDF);
const txt = pdfBuf.latin1Slice(0, pdfBuf.length);
const counts = [...txt.matchAll(/\/Type\s*\/Page[^s]/g)].length;
const rootCount = Math.max(0, ...[...txt.matchAll(/\/Count\s+(\d+)/g)].map((m) => +m[1]));
const kbSize = (pdfBuf.length / 1024).toFixed(0);
console.log(`Verificação: ${rootCount || counts} páginas (${counts} MediaBox), ${kbSize} KB.`);
console.log(`Previews de conferência: ${join(tmpdir(), 'audit-preview-p1.png')} / -p2.png`);
