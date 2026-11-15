/**
 * Tabela ou quadro editável a partir de uma imagem ou de um trecho de texto, com IA (Etapa 9 da especificação revista).
 * Puro: monta o pedido e converte a resposta numa planilha lida (`PlanilhaLida`), que entra pela mesma prévia da colagem
 * de planilha (números, datas, cabeçalho, relatório) e só troca a grade da janela com "Usar estes dados".
 *
 * Células que a IA não leu com segurança entram com o marcador `MARCADOR_CONFERIR` ("[?] ") diante do texto sugerido;
 * a janela da tabela não insere enquanto houver célula marcada (`celulasAConferir`): o autor confere e apaga o marcador.
 * Nada é preenchido como certo sem a revisão.
 */
import type { CelulaRascunho } from './tabelas';
import type { PlanilhaLida } from './planilha';
import type { MensagemIA, PedidoIA } from '../portas/ia';

export const MARCADOR_CONFERIR = '[?] ';
export const TITULO_GERAR_TABELA = 'Gerar tabela ou quadro';
/** Texto enviado no máximo (cerca de 7.500 tokens pela estimativa do aplicativo). */
export const LIMITE_TEXTO_TABELA_IA = 30_000;

const SISTEMA = [
  'Você transcreve tabelas e quadros de trabalhos acadêmicos brasileiros a partir de uma imagem ou de um texto.',
  'Transcreva exatamente o que está escrito: não calcule, não complete, não traduza e não invente valores. Mantenha os números como aparecem (vírgula decimal, pontos de milhar).',
  'Quando uma célula estiver ilegível, cortada ou ambígua, escreva a melhor leitura e marque "incerta": true; se não houver leitura possível, use texto vazio e "incerta": true.',
  'Células mescladas: a célula aparece uma vez, com "colunas" e/ou "linhas" maiores que 1, e as posições cobertas não aparecem na linha.',
  'Responda somente com um objeto JSON, sem texto fora dele:',
  '{"titulo": string ou null (sem "Tabela 1 –"), "fonte": string ou null (o texto depois de "Fonte:"), "linhasCabecalho": número, "linhas": [[{"texto": string, "colunas": número, "linhas": número, "incerta": boolean}]], "observacoes": [strings curtas]}.',
].join(' ');

export interface EntradaTabelaIA {
  especie: 'tabela' | 'quadro';
  texto?: string;
  imagem?: NonNullable<MensagemIA['imagem']>;
}

export function pedidoGerarTabela(e: EntradaTabelaIA): PedidoIA {
  const pedido = `Gere ${e.especie === 'quadro' ? 'um quadro (informação textual)' : 'uma tabela (dados numéricos)'} ${e.imagem ? 'a partir da imagem anexa' : 'a partir do texto abaixo'}.`;
  const texto = e.texto?.trim() ? `${pedido}\n\n${e.texto.slice(0, LIMITE_TEXTO_TABELA_IA)}` : pedido;
  return { mensagens: [{ papel: 'sistema', texto: SISTEMA }, { papel: 'usuario', texto, ...(e.imagem ? { imagem: e.imagem } : {}) }], maxTokens: 4000 };
}

export interface TabelaSugerida {
  lida: PlanilhaLida;
  titulo?: string;
  fonte?: string;
  /** Posições ("linha 2, coluna 3") das células marcadas para conferir. */
  incertas: string[];
  observacoes: string[];
}

function objetoJson(texto: string): Record<string, unknown> | null {
  const ini = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    const v = JSON.parse(texto.slice(ini, fim + 1)) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const umaLinha = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max);
};
const textoCelula = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').replace(/\r\n?/g, '\n').trim().slice(0, 2000) : typeof v === 'number' ? String(v) : '');
const inteiro = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v > 1 && v <= 63 ? v : undefined);

/** Converte a resposta; `null` quando não é uma tabela. Até 500 linhas e 63 colunas (o resto entra no relatório). */
export function lerTabelaSugerida(resposta: string): TabelaSugerida | null {
  const j = objetoJson(resposta);
  if (!j || !Array.isArray(j['linhas'])) return null;
  const incertas: string[] = [];
  let camposNaoLidos = 0;
  const brutas = (j['linhas'] as unknown[]).filter(Array.isArray) as unknown[][];
  const linhas = brutas.slice(0, 500).map((linha, l) =>
    linha.flatMap((c, k) => {
      if (k >= 63) {
        camposNaoLidos++;
        return [];
      }
      const o = typeof c === 'object' && c !== null && !Array.isArray(c) ? (c as Record<string, unknown>) : { texto: c };
      const texto = textoCelula(o['texto']);
      const incerta = o['incerta'] === true;
      if (incerta) incertas.push(`linha ${l + 1}, coluna ${k + 1}`);
      const colunas = inteiro(o['colunas']);
      const linhasMescladas = inteiro(o['linhas']);
      return [{ texto: incerta ? `${MARCADOR_CONFERIR}${texto}` : texto, ...(colunas ? { colunas } : {}), ...(linhasMescladas ? { linhas: linhasMescladas } : {}) }];
    }),
  );
  if (linhas.length === 0 || linhas.every((l) => l.length === 0)) return null;
  const cab = typeof j['linhasCabecalho'] === 'number' && Number.isInteger(j['linhasCabecalho']) && j['linhasCabecalho'] >= 0 && j['linhasCabecalho'] <= 10 ? j['linhasCabecalho'] : undefined;
  const avisos = incertas.length > 0 ? [`A IA marcou ${incertas.length === 1 ? 'uma célula' : `${incertas.length} células`} para conferir (“${MARCADOR_CONFERIR.trim()}”): ${incertas.slice(0, 8).join('; ')}${incertas.length > 8 ? '…' : ''}. Confira na origem e apague o marcador.`] : [];
  const titulo = umaLinha(j['titulo'], 1000);
  const fonte = umaLinha(j['fonte'], 1000);
  const observacoes = Array.isArray(j['observacoes']) ? j['observacoes'].flatMap((o) => (umaLinha(o, 300) ? [umaLinha(o, 300)!] : [])).slice(0, 10) : [];
  return {
    lida: { linhas, ...(cab !== undefined ? { linhasCabecalho: cab } : {}), avisos: [...avisos, ...observacoes.map((o) => `Observação da IA: ${o}`)], ...(brutas.length > 500 ? { linhasNaoLidas: brutas.length - 500 } : {}), ...(camposNaoLidos > 0 ? { camposNaoLidos } : {}) },
    ...(titulo ? { titulo } : {}),
    ...(fonte ? { fonte } : {}),
    incertas,
    observacoes,
  };
}

/** Células da grade ainda com o marcador de conferência ("linha 2, coluna 3"). */
export function celulasAConferir(grade: readonly (readonly (CelulaRascunho | null)[])[]): string[] {
  const r: string[] = [];
  grade.forEach((linha, l) => linha.forEach((c, k) => c && c.campo.texto.startsWith(MARCADOR_CONFERIR.trim()) && r.push(`linha ${l + 1}, coluna ${k + 1}`)));
  return r;
}
