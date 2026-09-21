// Interpretação da resposta do endpoint `Fiscal/EnviarNotaFiscal` da Brasil
// NFe. Módulo puro e sem imports (nem de `../types`) de propósito: é
// importado tanto pelo frontend/Vitest (Node) quanto pela Edge Function
// `supabase/functions/emit-nfce/index.ts` (Deno) — o Deno só resolve um
// import relativo direto quando o próprio arquivo não tem imports que
// dependam da resolução "estilo Vite" (ver comentário no topo do index.ts).
//
// Confirmado por teste ponta-a-ponta em 2026-09-20 (nota real autorizada em
// homologação): `Base64Xml`/`Base64File` vêm no nível raiz da resposta, não
// dentro de `ReturnNF`; e o número da nota (`Numero`) é um campo diferente do
// protocolo de autorização (`NumeroProtocolo`) — os dois já foram trocados
// aqui por engano numa versão anterior.

/** Getter case-insensitive — a Brasil NFe responde em PascalCase, os SDKs em camelCase. */
export function pickField(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(rec)) lower[k.toLowerCase()] = rec[k];
  for (const k of keys) {
    const hit = lower[k.toLowerCase()];
    if (hit !== undefined && hit !== null) return hit;
  }
  return undefined;
}

export interface ParsedNfceResponse {
  /** `true` quando a Sefaz autorizou o uso da NFC-e (cStat 100). */
  authorized: boolean;
  /** Código de status da Sefaz (cStat), como string (ex.: "100", "462"). */
  cStat: string;
  /** Motivo/mensagem da Sefaz (xMotivo). */
  xMotivo: string;
  chave: string | null;
  /** Protocolo de autorização — NÃO é o número da nota. */
  protocolo: string | null;
  numero: number | null;
  /** XML autorizado, em base64 (como veio do provedor — não decodificado). */
  xml: string | null;
  /** DANFCE (PDF), em base64. */
  danfe: string | null;
}

export function parseEnviarNotaFiscalResponse(body: unknown): ParsedNfceResponse {
  const ret = pickField(body, 'returnNF', 'ReturnNF') ?? body;

  const okFlag = pickField(ret, 'ok') === true || pickField(body, 'ok') === true;
  const cStat = String(pickField(ret, 'codStatusRespostaSefaz', 'CodStatusRespostaSefaz') ?? '');
  const xMotivo = String(
    pickField(ret, 'dsStatusRespostaSefaz', 'DsStatusRespostaSefaz', 'mensagem', 'message') ?? '',
  );
  const chave = String(pickField(ret, 'chaveNf', 'ChaveNF', 'chaveNF', 'chave') ?? '') || null;
  // NumeroProtocolo é o protocolo de autorização da Sefaz; Numero é o número da NFC-e.
  const protocolo = String(pickField(ret, 'numeroProtocolo', 'NumeroProtocolo', 'protocolo', 'Protocolo') ?? '') || null;
  const numero = Number(pickField(ret, 'numero', 'Numero', 'numeroNota', 'NumeroNota', 'nnf', 'nNF')) || null;
  // Base64Xml/Base64File vêm no nível raiz da resposta, não dentro de ReturnNF.
  const xml = (pickField(body, 'base64Xml', 'Base64Xml', 'xml') as string | undefined) ?? null;
  const danfe = (pickField(body, 'base64File', 'Base64File', 'danfe', 'pdf') as string | undefined) ?? null;

  const authorized = (okFlag && (cStat === '' || cStat === '100')) || cStat === '100';

  return { authorized, cStat, xMotivo, chave, protocolo, numero, xml, danfe };
}
