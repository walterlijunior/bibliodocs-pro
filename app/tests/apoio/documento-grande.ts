/**
 * Gerador do "documento grande" (M2-T01; RNF-06/RNF-07): trabalho de cerca de 150 páginas com 25 MiB de mídia, para
 * medir abrir, digitar, instantâneo de recuperação e salvamento. Reaproveitável no M3 (exportação de 150 páginas) e na
 * Etapa 6 (corpus de desempenho).
 *
 * Determinístico: a mesma semente gera os mesmos bytes (texto e mídias por PRNG próprio, sem `Math.random`).
 *
 * Páginas [HIPÓTESE até o M3 paginar de verdade]: A4 com Times 12, espaço 1,5 e margens 3/2 cm dá cerca de 30 linhas
 * de 80 caracteres; descontados recuos, títulos e linhas incompletas, `CARACTERES_POR_PAGINA` = 2 200.
 *
 * Mídias: o modelo do M1 ainda não tem figura no texto, então elas entram só no manifesto e no pacote — é o que pesa
 * no IPC, no ZIP e no disco. Os bytes depois da assinatura PNG são aleatórios (incompressíveis, como um PNG real).
 */
import { createHash } from 'node:crypto';
import { IDENTIFICADOR_FORMATO, VERSAO_FORMATO_ATUAL, type Manifesto } from '../../src/dominio/esquemas';
import type { Bloco, Documento, InlineTexto, Secao } from '../../src/dominio/modelo';
import type { PacoteProjeto } from '../../src/persistencia';

export const CARACTERES_POR_PAGINA = 2_200;

export interface OpcoesDocumentoGrande {
  /** Id do projeto (`PADRAO_ID`). */
  id?: string;
  titulo?: string;
  paginas?: number;
  midias?: number;
  bytesPorMidia?: number;
  semente?: number;
}

export interface DocumentoGrande {
  pacote: PacoteProjeto;
  /** Caracteres de texto do corpo (títulos e parágrafos). */
  caracteres: number;
  paginasEstimadas: number;
  paragrafos: number;
  secoes: number;
  bytesMidias: number;
}

const PALAVRAS = (
  'análise dados pesquisa resultado método estudo região cerrado Tocantins universidade amostra variável ' +
  'comunidade território política pública educação ambiental desenvolvimento processo sistema modelo ' +
  'avaliação produção conhecimento científico campo social econômico histórico cultural período ' +
  'população indicador tabela figura discussão conclusão hipótese teoria autor fonte relação ' +
  'de da do das dos em no na para com por que uma um os as se mais entre sobre como também quando'
).split(' ');

/** xorshift32: rápido e reprodutível. */
function gerador(semente: number) {
  let x = semente >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function midiaPng(bytes: number, proximo: () => number): Uint8Array {
  const dados = new Uint8Array(bytes);
  dados.set(ASSINATURA_PNG);
  const corpo = new Uint32Array(dados.buffer, 0, Math.floor(bytes / 4));
  for (let i = 2; i < corpo.length; i++) corpo[i] = proximo();
  return dados;
}

export function gerarDocumentoGrande(opcoes: OpcoesDocumentoGrande = {}): DocumentoGrande {
  const id = opcoes.id ?? 'prj_DocumentoGrande1';
  const paginas = opcoes.paginas ?? 150;
  const quantasMidias = opcoes.midias ?? 25;
  const bytesPorMidia = opcoes.bytesPorMidia ?? 1024 * 1024;
  const proximo = gerador(opcoes.semente ?? 2026);
  const alvo = paginas * CARACTERES_POR_PAGINA;

  let caracteres = 0;
  let paragrafos = 0;
  let secoes = 0;
  let blocos = 0;
  const novoId = (prefixo: string) => `${prefixo}_${(++blocos).toString(36).padStart(6, '0')}`;
  const palavra = () => PALAVRAS[proximo() % PALAVRAS.length]!;

  const frase = (minimo: number) => {
    const p: string[] = [];
    let n = 0;
    while (n < minimo) {
      const w = palavra();
      p.push(w);
      n += w.length + 1;
    }
    const s = p.join(' ');
    return `${s[0]!.toUpperCase()}${s.slice(1)}.`;
  };

  /** Parágrafo de ~700 caracteres; um em cada quatro com trecho em itálico e um em cada sete com negrito. */
  const paragrafo = (): Bloco => {
    const conteudo: InlineTexto[] = [{ tipo: 'texto', texto: `${frase(300)} ` }];
    if (paragrafos % 4 === 0) conteudo.push({ tipo: 'texto', texto: 'Caryocar brasiliense', marcas: ['italico'] });
    if (paragrafos % 7 === 0) conteudo.push({ tipo: 'texto', texto: ' resultado principal', marcas: ['negrito'] });
    conteudo.push({ tipo: 'texto', texto: ` ${frase(380)}` });
    paragrafos++;
    for (const i of conteudo) caracteres += i.texto.length;
    return { tipo: 'paragrafo', id: novoId('blc'), conteudo };
  };

  const secao = (nivel: number, ordem: number[]): Secao => {
    secoes++;
    const titulo = `${nivel === 1 ? 'Capítulo' : 'Seção'} ${ordem.join('.')} — ${frase(30).slice(0, -1)}`;
    caracteres += titulo.length;
    const s: Secao = { id: novoId('sec'), titulo: [{ tipo: 'texto', texto: titulo }], blocos: [], subsecoes: [] };
    return s;
  };

  // 6 capítulos × 4 secundárias × 2 terciárias; o texto é distribuído pelas folhas até chegar ao alvo.
  const corpo: Secao[] = [];
  const folhas: Secao[] = [];
  for (let c = 1; c <= 6; c++) {
    const cap = secao(1, [c]);
    for (let s = 1; s <= 4; s++) {
      const sec = secao(2, [c, s]);
      for (let t = 1; t <= 2; t++) {
        const ter = secao(3, [c, s, t]);
        sec.subsecoes.push(ter);
        folhas.push(ter);
      }
      cap.subsecoes.push(sec);
    }
    corpo.push(cap);
  }
  for (let i = 0; caracteres < alvo; i++) folhas[i % folhas.length]!.blocos.push(paragrafo());
  for (const cap of corpo.slice(1)) cap.blocos.unshift({ tipo: 'quebraPagina', id: novoId('blc') });

  const midias = new Map<string, Uint8Array>();
  const declaradas: Manifesto['midias'] = [];
  for (let i = 0; i < quantasMidias; i++) {
    const dados = midiaPng(bytesPorMidia, proximo);
    const sha256 = createHash('sha256').update(dados).digest('hex');
    midias.set(sha256, dados);
    declaradas.push({ caminho: `midias/${sha256}.png`, sha256, bytes: dados.length, tipo: 'image/png' });
  }

  const agora = '2026-10-17T09:00:00.000Z';
  const titulo = opcoes.titulo ?? 'Documento grande de medição';
  const documento: Documento = { id, tipoTrabalho: 'generico', metadados: { titulo: [{ tipo: 'texto', texto: titulo }] }, corpo };
  const manifesto: Manifesto = {
    formato: IDENTIFICADOR_FORMATO,
    versaoFormato: VERSAO_FORMATO_ATUAL,
    appVersao: '0.1.0',
    id,
    criadoEm: agora,
    atualizadoEm: agora,
    perfil: { id: 'uft-2022', versao: '1.0.0' },
    tipoTrabalho: 'generico',
    midias: declaradas,
  };
  return {
    pacote: { manifesto, documento, midias },
    caracteres,
    paginasEstimadas: Math.round(caracteres / CARACTERES_POR_PAGINA),
    paragrafos,
    secoes,
    bytesMidias: quantasMidias * bytesPorMidia,
  };
}
