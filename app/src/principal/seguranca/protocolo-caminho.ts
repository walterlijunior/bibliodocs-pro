/**
 * Resolução segura de caminho do protocolo `app://` — item C-3 do checklist de endurecimento
 * (docs/relatorios/ETAPA4_REVISAO_SEGURANCA.md). Puro: usa só node:path; sem electron e sem acesso
 * a disco (testado em tests/seguranca-protocolo-caminho.test.ts).
 *
 * Regras:
 * - só `app://interface/...` (host diferente → 404); métodos GET e HEAD (outros → 405);
 * - recusa (400) barra invertida, `%5c`, `%2f`, `%00`, `:` (unidade do Windows/ADS), codificação
 *   dupla (`%25...`), segmentos `.`/`..` literais ou codificados (`%2e%2e`), segmento vazio (`//`),
 *   sequência `%` malformada e caminho que, depois de resolvido, saia da pasta raiz (`out/interface`);
 * - `/` (ou caminho terminado em `/`) → `index.html` da pasta;
 * - só extensões com tipo MIME conhecido (lista abaixo); outras → 404. Evita servir arquivo inesperado
 *   e permite `X-Content-Type-Options: nosniff`.
 */
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { HOST_APP, ESQUEMA_APP } from './politica-urls';

/** Tipos MIME servidos pelo protocolo. Extensão fora da lista → 404. */
export const TIPOS_MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

/** Resultado da resolução: arquivo a servir, ou recusa com status HTTP. */
export type ResolucaoProtocolo =
  | { readonly tipo: 'arquivo'; readonly caminho: string; readonly tipoMime: string }
  | { readonly tipo: 'recusa'; readonly status: 400 | 404 | 405; readonly motivo: string };

function recusa(status: 400 | 404 | 405, motivo: string): ResolucaoProtocolo {
  return { tipo: 'recusa', status, motivo };
}

/**
 * Converte a URL de uma requisição `app://` no caminho absoluto de um arquivo dentro de `raiz`.
 *
 * @param urlTexto URL completa recebida pelo `protocol.handle`.
 * @param raiz pasta absoluta servida (em produção, `out/interface`).
 * @param metodo método HTTP da requisição (padrão GET).
 */
export function resolverCaminhoProtocolo(urlTexto: string, raiz: string, metodo = 'GET'): ResolucaoProtocolo {
  if (metodo !== 'GET' && metodo !== 'HEAD') return recusa(405, `Método não permitido: ${metodo}.`);

  let url: URL;
  try {
    url = new URL(urlTexto);
  } catch {
    return recusa(400, 'URL malformada.');
  }
  if (url.protocol !== `${ESQUEMA_APP}:`) return recusa(404, 'Esquema diferente de app:.');
  if (url.host.toLowerCase() !== HOST_APP) return recusa(404, `Host não permitido: ${url.host}.`);
  if (url.username !== '' || url.password !== '') return recusa(400, 'Credenciais na URL.');

  const bruto = url.pathname;
  if (bruto.includes('\\') || /%5c/i.test(bruto)) return recusa(400, 'Barra invertida no caminho.');
  if (/%2f/i.test(bruto)) return recusa(400, 'Barra codificada no caminho.');

  let decodificado: string;
  try {
    decodificado = decodeURIComponent(bruto);
  } catch {
    return recusa(400, 'Codificação % malformada.');
  }
  // `%` que sobra depois de decodificar indica codificação dupla (ex.: %252e%252e): recusada.
  if (/[\0\\:%]/.test(decodificado)) {
    return recusa(400, 'Caractere proibido no caminho.');
  }

  const segmentos = decodificado.split('/');
  // pathname sempre começa com "/", então o primeiro segmento é vazio.
  const internos = segmentos.slice(1);
  if (internos.some((s) => s === '.' || s === '..')) return recusa(400, 'Segmento . ou .. no caminho.');
  if (internos.slice(0, -1).some((s) => s === '')) return recusa(400, 'Segmento vazio no caminho.');
  if (internos.length === 0 || internos[internos.length - 1] === '') {
    internos[internos.length === 0 ? 0 : internos.length - 1] = 'index.html';
  }

  const raizAbsoluta = resolve(raiz);
  const alvo = resolve(raizAbsoluta, ...internos);
  const rel = relative(raizAbsoluta, alvo);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return recusa(400, 'Caminho fora da raiz.');

  const tipoMime = TIPOS_MIME[extname(alvo).toLowerCase()];
  if (tipoMime === undefined) return recusa(404, 'Tipo de arquivo não servido.');
  return { tipo: 'arquivo', caminho: alvo, tipoMime };
}
