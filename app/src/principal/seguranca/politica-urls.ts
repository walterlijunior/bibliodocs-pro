/**
 * Política de URLs do processo principal — funções puras (sem electron, sem node:*), testadas em
 * tests/seguranca-politica-urls.test.ts. Itens do checklist (docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md):
 * - C-3: origem própria `app://interface` (constantes do protocolo);
 * - C-5: filtro de navegação (`will-navigate`, `will-redirect`, `will-frame-navigate`);
 * - C-6: validação de link externo antes de `shell.openExternal` (só `https:` de lista fixa);
 * - C-8: filtro de requisições de rede da sessão (`webRequest.onBeforeRequest`).
 *
 * Toda decisão compara protocolo e host já analisados pelo parser WHATWG (`URL`), nunca prefixo de
 * texto, para que `app://interface.evil` ou `https://exemplo.com.evil.com` não passem.
 */

/** Esquema do protocolo próprio da interface em produção (sem os dois-pontos). */
export const ESQUEMA_APP = 'app';

/** Host fixo do protocolo próprio: a UI é sempre `app://interface/...`. */
export const HOST_APP = 'interface';

/** URL inicial da interface em produção. */
export const URL_INICIAL_PRODUCAO = `${ESQUEMA_APP}://${HOST_APP}/index.html`;

/** Origem permitida para a interface: protocolo (com `:`) e host (com porta, se houver), em minúsculas. */
export interface OrigemPermitida {
  readonly protocolo: string;
  readonly host: string;
}

/** Origem de produção: `app://interface`. */
export const ORIGEM_PRODUCAO: OrigemPermitida = { protocolo: `${ESQUEMA_APP}:`, host: HOST_APP };

/**
 * Hosts para os quais `abrirLinkExterno` aceita abrir o navegador (C-6). Lista fixa, comparação exata
 * do nome de host (sem subdomínios implícitos). Começa vazia no M1: nenhum recurso do M1 abre link
 * externo. Cada inclusão futura deve citar o requisito que a exige (ex.: página de releases, manual).
 */
export const HOSTS_EXTERNOS_PERMITIDOS: readonly string[] = [];

/** Hosts aceitos como servidor de desenvolvimento (só loopback). */
const HOSTS_LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function analisar(urlTexto: string): URL | null {
  if (typeof urlTexto !== 'string' || urlTexto.length === 0 || urlTexto.length > 8192) return null;
  try {
    return new URL(urlTexto);
  } catch {
    return null;
  }
}

/** Host em minúsculas com porta. Necessário porque, em esquemas não especiais (`app:`), o parser não normaliza. */
function hostNormalizado(url: URL): string {
  return url.host.toLowerCase();
}

function temCredenciais(url: URL): boolean {
  return url.username !== '' || url.password !== '';
}

/**
 * Valida a URL do servidor de desenvolvimento (ELECTRON_RENDERER_URL) e devolve a origem dela.
 * Só aceita `http:` em loopback (localhost, 127.0.0.1, [::1]), sem credenciais. Qualquer outra coisa → `null`
 * (o chamador então cai no modo de produção, nunca carrega uma URL remota).
 */
export function origemDeDesenvolvimento(urlTexto: string | undefined): OrigemPermitida | null {
  if (urlTexto === undefined) return null;
  const url = analisar(urlTexto);
  if (!url || url.protocol !== 'http:' || temCredenciais(url)) return null;
  if (!HOSTS_LOOPBACK.has(url.hostname.toLowerCase())) return null;
  return { protocolo: 'http:', host: hostNormalizado(url) };
}

/** A URL pertence exatamente à origem dada (mesmo protocolo, host e porta; sem credenciais)? */
export function urlNaOrigem(urlTexto: string, origem: OrigemPermitida): boolean {
  const url = analisar(urlTexto);
  if (!url || temCredenciais(url)) return false;
  return url.protocol === origem.protocolo && hostNormalizado(url) === origem.host;
}

/**
 * Filtro de navegação (C-5). Permite navegar só dentro da origem da interface. Em desenvolvimento,
 * também permite `devtools:` (a própria janela de DevTools). Todo o resto é bloqueado, inclusive
 * `file:`, `javascript:`, `data:`, `about:` e qualquer `http(s):` externo.
 */
export function navegacaoPermitida(urlTexto: string, origem: OrigemPermitida, desenvolvimento: boolean): boolean {
  if (urlNaOrigem(urlTexto, origem)) return true;
  if (desenvolvimento) {
    const url = analisar(urlTexto);
    if (url?.protocol === 'devtools:') return true;
  }
  return false;
}

/**
 * Filtro de requisições da sessão (C-8). Rede bloqueada por padrão; passa só:
 * - a origem da interface (`app://interface` em produção; `http://` dev exato em desenvolvimento);
 * - `ws://` do mesmo host:porta do servidor dev (HMR), só em desenvolvimento;
 * - `devtools:`, só em desenvolvimento;
 * - `data:` só como imagem (segunda barreira além do `img-src` da CSP);
 * - `blob:` cuja origem interna é a origem da interface, só como imagem ou xhr/fetch.
 *
 * @param tipoRecurso `details.resourceType` do Electron (`image`, `script`, `subFrame`, `xhr`...).
 */
export function requisicaoPermitida(
  urlTexto: string,
  origem: OrigemPermitida,
  desenvolvimento: boolean,
  tipoRecurso?: string,
): boolean {
  const url = analisar(urlTexto);
  if (!url) return false;
  if (url.protocol === 'data:') return tipoRecurso === 'image';
  if (url.protocol === 'blob:') {
    if (tipoRecurso !== 'image' && tipoRecurso !== 'xhr') return false;
    // blob:app://interface/<uuid> → a parte interna precisa ser da origem permitida.
    return urlNaOrigem(url.pathname, origem);
  }
  if (urlNaOrigem(urlTexto, origem)) return true;
  if (!desenvolvimento) return false;
  if (url.protocol === 'devtools:') return true;
  if (url.protocol === 'ws:' && origem.protocolo === 'http:' && !temCredenciais(url)) {
    return hostNormalizado(url) === origem.host;
  }
  return false;
}

/**
 * Forma de uma URL segura para log: só `protocolo//host`, sem caminho, query, fragmento nem
 * credenciais, para que dados do usuário nunca cheguem ao console ou a um log em arquivo.
 */
export function urlParaLog(urlTexto: string): string {
  const url = analisar(urlTexto);
  if (!url) return '<URL inválida>';
  if (url.protocol === 'data:' || url.protocol === 'blob:' || url.host === '') return url.protocol;
  return `${url.protocol}//${url.host}`;
}

/** Resultado da validação de um link externo. */
export type ResultadoLinkExterno =
  | { readonly permitido: true; readonly url: string }
  | { readonly permitido: false; readonly motivo: string };

/**
 * Valida um link antes de `shell.openExternal` (C-6): só `https:`, porta padrão, sem credenciais e
 * com nome de host exatamente igual a um item da lista fixa. Devolve a URL serializada pelo parser
 * (é ela, e não o texto recebido, que deve ser aberta).
 */
export function validarLinkExterno(
  urlTexto: string,
  hostsPermitidos: readonly string[] = HOSTS_EXTERNOS_PERMITIDOS,
): ResultadoLinkExterno {
  const url = analisar(urlTexto);
  if (!url) return { permitido: false, motivo: 'URL inválida.' };
  if (url.protocol !== 'https:') return { permitido: false, motivo: 'Só links https são abertos.' };
  if (temCredenciais(url)) return { permitido: false, motivo: 'Link com usuário ou senha na URL.' };
  if (url.port !== '') return { permitido: false, motivo: 'Link com porta explícita.' };
  const host = url.hostname.toLowerCase();
  const lista = hostsPermitidos.map((h) => h.toLowerCase());
  if (!lista.includes(host)) return { permitido: false, motivo: `Endereço fora da lista permitida: ${host}.` };
  return { permitido: true, url: url.href };
}
