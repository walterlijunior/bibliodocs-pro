/**
 * Cliente da API de chat no formato da OpenAI (Etapa 8 da especificação de atualização). Única parte do aplicativo que
 * faz requisição de rede (ADR-0005, regra 8, adendo da Etapa 8), e só para o endereço configurado pelo autor.
 *
 * - Endereço: `https:` para qualquer servidor; `http:` só para o próprio computador (Ollama). Sem usuário e senha na
 *   URL, sem parâmetros. O pedido vai para `<url>/chat/completions`.
 * - A chave vai só no cabeçalho `Authorization: Bearer`; nunca em log nem na resposta.
 * - Tempo limite de 120 s; resposta lida até 2 MB; só o texto da primeira escolha, o `usage` e os cabeçalhos
 *   `x-ratelimit-*` saem daqui.
 */
import type { ConfigIA, LimitesInformados, PedidoIA, ResultadoIA, UsoInformado } from '../../aplicacao/portas/ia';

export const TEMPO_LIMITE_MS = 120_000;
export const LIMITE_RESPOSTA_BYTES = 2 * 1024 * 1024;

export type Buscar = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(nome: string): string | null };
  text(): Promise<string>;
}>;

const LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A URL base aceita (normalizada, sem barra final), ou `null`. */
export function urlBaseValida(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.username || u.password || u.search || u.hash) return null;
  if (u.protocol === 'http:' && !LOCAIS.has(u.hostname)) return null;
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

const inteiro = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
const cabecalho = (h: { get(n: string): string | null }, nome: string): number | undefined => {
  const v = h.get(nome);
  return v !== null && /^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined;
};

export type RespostaCliente = Exclude<ResultadoIA, { ok: true }> | { ok: true; texto: string; uso: UsoInformado | null; limites: LimitesInformados | null };

export async function enviarChat(config: Pick<ConfigIA, 'url' | 'modelo'>, chave: string | null, pedido: PedidoIA, buscar: Buscar, tempoMs = TEMPO_LIMITE_MS): Promise<RespostaCliente> {
  const base = urlBaseValida(config.url);
  if (base === null) return { ok: false, motivo: 'CONFIG', mensagem: 'O endereço do serviço de IA não é válido: use https:// (ou http:// só no próprio computador).' };
  if (config.modelo.trim() === '') return { ok: false, motivo: 'CONFIG', mensagem: 'Informe o nome do modelo do serviço de IA.' };
  const corpo = JSON.stringify({
    model: config.modelo.trim(),
    messages: pedido.mensagens.map((m) => ({ role: m.papel === 'sistema' ? 'system' : 'user', content: m.texto })),
    ...(pedido.maxTokens ? { max_tokens: pedido.maxTokens } : {}),
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (chave) headers['Authorization'] = `Bearer ${chave}`;
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), tempoMs);
  let r: Awaited<ReturnType<Buscar>>;
  let texto: string;
  try {
    r = await buscar(`${base}/chat/completions`, { method: 'POST', headers, body: corpo, signal: controle.signal });
    texto = await r.text();
  } catch {
    return controle.signal.aborted
      ? { ok: false, motivo: 'TEMPO', mensagem: 'O serviço de IA não respondeu a tempo. O que já foi feito está guardado; tente retomar mais tarde.' }
      : { ok: false, motivo: 'REDE', mensagem: 'Não foi possível falar com o serviço de IA. Confira a internet e o endereço configurado.' };
  } finally {
    clearTimeout(relogio);
  }
  if (texto.length > LIMITE_RESPOSTA_BYTES) return { ok: false, motivo: 'RESPOSTA', mensagem: 'A resposta do serviço de IA é grande demais.' };
  if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'CHAVE_RECUSADA', mensagem: 'O serviço recusou a chave de API. Confira a chave na configuração.' };
  if (r.status === 429) {
    const cota = /insufficient_quota|quota/i.test(texto);
    return { ok: false, motivo: 'LIMITE', mensagem: cota ? 'O serviço informou que a cota da conta acabou.' : 'O serviço pediu para esperar: limite de uso por minuto atingido.' };
  }
  if (!r.ok) return { ok: false, motivo: 'PROVEDOR', mensagem: `O serviço de IA respondeu com erro (${r.status}).` };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'RESPOSTA', mensagem: 'A resposta do serviço de IA não pôde ser lida.' };
  }
  const j = json as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } };
  const conteudo = j.choices?.[0]?.message?.content;
  if (typeof conteudo !== 'string') return { ok: false, motivo: 'RESPOSTA', mensagem: 'A resposta do serviço de IA veio sem texto.' };
  const u = j.usage;
  const uso: UsoInformado = {
    ...(inteiro(u?.prompt_tokens) !== undefined ? { entrada: inteiro(u?.prompt_tokens)! } : {}),
    ...(inteiro(u?.completion_tokens) !== undefined ? { saida: inteiro(u?.completion_tokens)! } : {}),
    ...(inteiro(u?.total_tokens) !== undefined ? { total: inteiro(u?.total_tokens)! } : {}),
  };
  const limites: LimitesInformados = {
    ...(cabecalho(r.headers, 'x-ratelimit-remaining-tokens') !== undefined ? { tokensRestantes: cabecalho(r.headers, 'x-ratelimit-remaining-tokens')! } : {}),
    ...(cabecalho(r.headers, 'x-ratelimit-limit-tokens') !== undefined ? { tokensLimite: cabecalho(r.headers, 'x-ratelimit-limit-tokens')! } : {}),
    ...(cabecalho(r.headers, 'x-ratelimit-remaining-requests') !== undefined ? { pedidosRestantes: cabecalho(r.headers, 'x-ratelimit-remaining-requests')! } : {}),
    ...(cabecalho(r.headers, 'x-ratelimit-limit-requests') !== undefined ? { pedidosLimite: cabecalho(r.headers, 'x-ratelimit-limit-requests')! } : {}),
  };
  return {
    ok: true,
    texto: conteudo.slice(0, 100_000),
    uso: Object.keys(uso).length > 0 ? uso : null,
    limites: Object.keys(limites).length > 0 ? limites : null,
  };
}

/** O `fetch` do Node (fora da sessão do navegador e do filtro de requisições dela). */
export const buscarNode: Buscar = (url, init) => fetch(url, init);
