/**
 * Sugestão de conformidade com IA (Etapa 9 da especificação revista): para uma ocorrência do relatório, a IA explica e
 * propõe a correção com base na regra (as RN do item) e no conteúdo do local. Puro: monta o pedido e lê a resposta.
 *
 * - Tabela ou quadro: a proposta pode trazer título, fonte e nota, aplicáveis pelo mesmo caminho da revisão de tabelas
 *   do assistente (`dadosComSugestao`, células nunca mudam), depois da revisão do autor.
 * - Demais: um texto sugerido para o autor conferir e aplicar à mão (o aplicativo não reescreve o texto sozinho).
 */
import type { BlocoTabela, InlineDeTitulo } from '../../dominio/modelo';
import type { NaoConformidade } from '../../dominio/verificador/conformidade';
import type { PedidoIA } from '../portas/ia';

export const TITULO_SUGESTAO_CONFORMIDADE = 'Sugestão de conformidade';

const SISTEMA = [
  'Você ajuda a corrigir não conformidades de trabalhos acadêmicos brasileiros (Manual de Normalização da UFT, ABNT e, nas tabelas, Norma de Apresentação Tabular do IBGE).',
  'Recebe a ocorrência apontada pelo verificador, a regra de origem e o conteúdo do local. Explique em uma ou duas frases e proponha a correção mínima.',
  'Não invente dados: se a correção depende de informação que não está no conteúdo (por exemplo, a fonte real dos dados), diga o que o autor precisa informar e deixe o campo nulo.',
  'Nunca proponha mudar células de tabela.',
  'Responda somente com um objeto JSON, sem texto fora dele: {"explicacao": string, "titulo": string ou null, "fonte": string ou null, "nota": string ou null, "textoSugerido": string ou null, "regras": [as RN em que se baseou]}.',
].join(' ');

const plano = (t: readonly InlineDeTitulo[] | undefined) => (t ?? []).map((i) => i.texto).join('').trim();

export interface ContextoSugestao {
  tabela?: { bloco: BlocoTabela; rotulo: string };
  trecho?: string;
}

export function pedidoSugestaoConformidade(item: NaoConformidade, contexto: ContextoSugestao): PedidoIA {
  const linhas = [
    `Ocorrência: ${item.gravidade === 'erro' ? 'pendência' : 'aviso'} ${item.codigo}`,
    `Regra de origem: ${item.origem.join(', ') || '(sem RN)'}`,
    `Local: ${item.rotuloLocal}`,
    `Mensagem do verificador: ${item.mensagem}`,
    `Sugestão do verificador: ${item.sugestao}`,
  ];
  const t = contexto.tabela;
  if (t) {
    const celulas = t.bloco.linhas.map((l) => l.map((c) => plano(c.conteudo)).join(' | '));
    linhas.push(
      '',
      `${t.bloco.especie === 'quadro' ? 'Quadro' : 'Tabela'} (${t.rotulo})`,
      `Título: ${plano(t.bloco.titulo) || '(vazio)'}`,
      `Fonte: ${plano(t.bloco.fonte) || '(vazia)'}`,
      `Nota: ${plano(t.bloco.nota) || '(vazia)'}`,
      `Linhas (as ${Math.min(celulas.length, 12)} primeiras de ${celulas.length}; cabeçalho: ${t.bloco.linhasCabecalho}):`,
      ...celulas.slice(0, 12),
    );
  } else if (contexto.trecho) linhas.push('', `Trecho: ${contexto.trecho.slice(0, 2000)}`);
  return { mensagens: [{ papel: 'sistema', texto: SISTEMA }, { papel: 'usuario', texto: linhas.join('\n') }], maxTokens: 800 };
}

export interface SugestaoConformidade {
  explicacao: string;
  titulo?: string;
  fonte?: string;
  nota?: string;
  textoSugerido?: string;
  regras: string[];
}

const curto = (v: unknown, max = 2000): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max);
};

export function lerSugestaoConformidade(resposta: string): SugestaoConformidade | null {
  const ini = resposta.indexOf('{');
  const fim = resposta.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(resposta.slice(ini, fim + 1)) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    j = v as Record<string, unknown>;
  } catch {
    return null;
  }
  const explicacao = curto(j['explicacao'], 1000);
  if (!explicacao) return null;
  const campos = Object.fromEntries((['titulo', 'fonte', 'nota', 'textoSugerido'] as const).flatMap((k) => (curto(j[k]) ? [[k, curto(j[k])!]] : [])));
  const regras = Array.isArray(j['regras']) ? j['regras'].flatMap((r) => (typeof r === 'string' && /^(RN|D)-[\w-]{1,20}$/.test(r.trim()) ? [r.trim()] : [])).slice(0, 10) : [];
  return { explicacao, ...campos, regras };
}
