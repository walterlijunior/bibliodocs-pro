/**
 * Modelo de congresso ou evento (Etapa 7 da especificação de atualização): do DOCX lido ao `ModeloEvento` do documento,
 * e a tabela do que foi reconhecido, do que o autor corrigiu e do que continua com o perfil. Puro.
 */
import { lerModeloDocx, type ModeloLido, type ResultadoLerModelo } from '../../importacao';
import { PERFIL_UFT_2022 } from '../perfil-padrao';
import type { ModeloEvento, RegrasModelo, Secao } from '../../dominio/modelo';
import type { Perfil } from '../../dominio/normas';
import { LIMITES_V1 } from '../../dominio/esquemas';

export { lerModeloDocx, type ResultadoLerModelo };

const corta = (s: string) => s.slice(0, LIMITES_V1.campoCurto);

/** O modelo a gravar no documento: o reconhecido também é o que vale, até o autor corrigir. */
export function modeloDoArquivo(nomeArquivo: string, bytes: Uint8Array, agora: Date): { ok: true; modelo: ModeloEvento } | { ok: false; mensagem: string } {
  const r = lerModeloDocx(bytes);
  if (!r.ok) return r;
  const nome = corta(nomeArquivo.replace(/\.docx$/i, '').trim() || 'Modelo do evento');
  const m = r.modelo;
  return {
    ok: true,
    modelo: {
      nome,
      importadoEm: agora.toISOString(),
      reconhecidas: m.regras,
      regras: m.regras,
      ...(m.instrucoes.length ? { instrucoes: m.instrucoes.slice(0, LIMITES_V1.instrucoesModelo).map(corta) } : {}),
      ...(m.secoes.length ? { secoes: m.secoes.slice(0, LIMITES_V1.secoesModelo).map((s) => ({ nivel: s.nivel, titulo: corta(s.titulo) })) } : {}),
      ...(m.avisos.length ? { avisos: m.avisos.slice(0, LIMITES_V1.instrucoesModelo).map(corta) } : {}),
    },
  };
}

export type ChaveAspecto =
  | 'larguraMm'
  | 'alturaMm'
  | 'margemSuperiorCm'
  | 'margemInferiorCm'
  | 'margemEsquerdaCm'
  | 'margemDireitaCm'
  | 'fonte'
  | 'corpoPt'
  | 'entrelinha'
  | 'alinhamento'
  | 'recuoPrimeiraLinhaCm';

export const ASPECTOS: readonly { chave: ChaveAspecto; rotulo: string; unidade?: string; tipo: 'numero' | 'texto' | 'entrelinha' | 'alinhamento' }[] = [
  { chave: 'larguraMm', rotulo: 'Largura da página', unidade: 'mm', tipo: 'numero' },
  { chave: 'alturaMm', rotulo: 'Altura da página', unidade: 'mm', tipo: 'numero' },
  { chave: 'margemSuperiorCm', rotulo: 'Margem superior', unidade: 'cm', tipo: 'numero' },
  { chave: 'margemInferiorCm', rotulo: 'Margem inferior', unidade: 'cm', tipo: 'numero' },
  { chave: 'margemEsquerdaCm', rotulo: 'Margem esquerda', unidade: 'cm', tipo: 'numero' },
  { chave: 'margemDireitaCm', rotulo: 'Margem direita', unidade: 'cm', tipo: 'numero' },
  { chave: 'fonte', rotulo: 'Fonte', tipo: 'texto' },
  { chave: 'corpoPt', rotulo: 'Tamanho do texto', unidade: 'pt', tipo: 'numero' },
  { chave: 'entrelinha', rotulo: 'Entrelinha do texto', tipo: 'entrelinha' },
  { chave: 'alinhamento', rotulo: 'Alinhamento do texto', tipo: 'alinhamento' },
  { chave: 'recuoPrimeiraLinhaCm', rotulo: 'Recuo da primeira linha', unidade: 'cm', tipo: 'numero' },
];

export type SituacaoAspecto = 'reconhecido' | 'corrigido' | 'perfil' | 'aproximado';

export interface LinhaAspecto {
  chave: ChaveAspecto;
  rotulo: string;
  noModelo: string | null;
  noTrabalho: string;
  situacao: SituacaoAspecto;
}

const NOMES_ENTRELINHA = { simples: 'simples', '1,5': '1,5', duplo: 'dupla' } as const;

export function textoDoValor(chave: ChaveAspecto, v: RegrasModelo[ChaveAspecto] | undefined): string | null {
  if (v === undefined) return null;
  const a = ASPECTOS.find((x) => x.chave === chave)!;
  if (a.tipo === 'entrelinha') return NOMES_ENTRELINHA[v as keyof typeof NOMES_ENTRELINHA];
  if (typeof v === 'number') return `${String(v).replace('.', ',')}${a.unidade ? ` ${a.unidade}` : ''}`;
  return String(v);
}

/** O que o perfil (sem modelo) usa em cada aspecto. */
export function valoresDoPerfil(perfil: Perfil): RegrasModelo {
  const v: Record<string, unknown> = {};
  for (const r of perfil.regras) {
    if (!r.propriedades) continue;
    if (r.alvo === 'pagina' || r.alvo === 'documento' || r.alvo === 'corpo.paragrafo') Object.assign(v, r.propriedades);
  }
  const fonte = perfil.parametros['fonte']?.valor;
  return {
    ...(typeof v['larguraMm'] === 'number' ? { larguraMm: v['larguraMm'] } : {}),
    ...(typeof v['alturaMm'] === 'number' ? { alturaMm: v['alturaMm'] } : {}),
    ...(typeof v['margemSuperiorCm'] === 'number' ? { margemSuperiorCm: v['margemSuperiorCm'] } : {}),
    ...(typeof v['margemInferiorCm'] === 'number' ? { margemInferiorCm: v['margemInferiorCm'] } : {}),
    ...(typeof v['margemEsquerdaCm'] === 'number' ? { margemEsquerdaCm: v['margemEsquerdaCm'] } : {}),
    ...(typeof v['margemDireitaCm'] === 'number' ? { margemDireitaCm: v['margemDireitaCm'] } : {}),
    ...(typeof fonte === 'string' ? { fonte } : {}),
    ...(typeof v['corpoPt'] === 'number' ? { corpoPt: v['corpoPt'] } : {}),
    ...(v['entrelinha'] === 'simples' || v['entrelinha'] === '1,5' ? { entrelinha: v['entrelinha'] } : {}),
    ...(typeof v['alinhamento'] === 'string' ? { alinhamento: v['alinhamento'] as RegrasModelo['alinhamento'] } : {}),
    ...(typeof v['recuoPrimeiraLinhaCm'] === 'number' ? { recuoPrimeiraLinhaCm: v['recuoPrimeiraLinhaCm'] } : {}),
  };
}

/** Tabela "aspecto, no modelo, no trabalho, situação" para o autor conferir e corrigir. */
export function aspectosDoModelo(modelo: ModeloEvento, perfil: Perfil): LinhaAspecto[] {
  const base = valoresDoPerfil(perfil);
  const aproximada = (modelo.avisos ?? []).some((a) => a.startsWith('Entrelinha'));
  return ASPECTOS.map((a) => {
    const lido = modelo.reconhecidas[a.chave];
    const vale = modelo.regras[a.chave];
    const situacao: SituacaoAspecto =
      vale === undefined ? 'perfil' : lido === undefined || lido !== vale ? 'corrigido' : a.chave === 'entrelinha' && aproximada ? 'aproximado' : 'reconhecido';
    return {
      chave: a.chave,
      rotulo: a.rotulo,
      noModelo: textoDoValor(a.chave, lido),
      noTrabalho: textoDoValor(a.chave, vale ?? base[a.chave]) ?? '—',
      situacao,
    };
  });
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/^\s*[\d.]+\s*/, '').trim().toLocaleLowerCase('pt-BR');

/** Seções de nível 1 do modelo que o trabalho ainda não tem (comparação sem número, acento nem maiúsculas). */
export function secoesQueFaltam(modelo: ModeloEvento, corpo: readonly Secao[]): string[] {
  const tem = new Set<string>();
  const visitar = (s: Secao) => {
    tem.add(normalizar(s.titulo.map((i) => i.texto).join('')));
    s.subsecoes.forEach(visitar);
  };
  corpo.forEach(visitar);
  const faltam: string[] = [];
  for (const s of modelo.secoes ?? []) {
    const k = normalizar(s.titulo);
    // Referências são geradas pelo aplicativo (elemento pós-textual), não uma seção do texto.
    if (s.nivel !== 1 || k === '' || tem.has(k) || /^referencias( bibliograficas)?$/.test(k)) continue;
    tem.add(k);
    faltam.push(s.titulo.replace(/^\s*[\d.]+\s*/, '').trim());
  }
  return faltam;
}

/** A tabela de aspectos com o perfil do aplicativo (para a tela, que não lê o perfil). */
export const aspectosComPerfilPadrao = (modelo: ModeloEvento): LinhaAspecto[] => aspectosDoModelo(modelo, PERFIL_UFT_2022);

export interface DiferencaExportado {
  aspecto: string;
  noModelo: string;
  noExportado: string;
}

const iguais = (a: unknown, b: unknown): boolean => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.06 : a === b);

const ROTULOS_TITULO: Record<string, string> = { corpoPt: 'tamanho', negrito: 'negrito', italico: 'itálico', maiusculas: 'maiúsculas', alinhamento: 'alinhamento', quebraPagina: 'página nova' };
const textoSimples = (v: unknown): string => (v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'sim' : 'não') : typeof v === 'number' ? String(v).replace('.', ',') : String(v));

/**
 * Etapa 7 (aceite): compara o DOCX exportado com o modelo original, aspecto por aspecto (o que o modelo definia), os
 * estilos de título e as seções de nível 1. Vazio = o exportado reproduz o que o modelo trazia.
 */
export function compararComExportado(modelo: ModeloEvento, exportado: ModeloLido): DiferencaExportado[] {
  const saida: DiferencaExportado[] = [];
  for (const a of ASPECTOS) {
    const original = modelo.reconhecidas[a.chave];
    if (original === undefined) continue;
    const obtido = exportado.regras[a.chave];
    if (!iguais(original, obtido)) saida.push({ aspecto: a.rotulo, noModelo: textoDoValor(a.chave, original) ?? '—', noExportado: textoDoValor(a.chave, obtido) ?? '—' });
  }
  for (const n of [1, 2, 3] as const) {
    const original = modelo.reconhecidas[`titulo${n}`];
    if (!original) continue;
    const obtido = exportado.regras[`titulo${n}`] ?? {};
    for (const [k, v] of Object.entries(original)) {
      const o = (obtido as Record<string, unknown>)[k];
      if (!iguais(v, o)) saida.push({ aspecto: `Título ${n}: ${ROTULOS_TITULO[k] ?? k}`, noModelo: textoSimples(v), noExportado: textoSimples(o) });
    }
  }
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/^\s*[\d.]+\s*/, '').trim().toLocaleLowerCase('pt-BR');
  const exportadas = new Set(exportado.secoes.filter((s) => s.nivel === 1).map((s) => norm(s.titulo)));
  for (const s of modelo.secoes ?? []) {
    if (s.nivel !== 1) continue;
    const k = norm(s.titulo);
    if (/^referencias( bibliograficas)?$/.test(k)) continue;
    if (!exportadas.has(k)) saida.push({ aspecto: `Seção “${s.titulo}”`, noModelo: 'presente', noExportado: 'ausente' });
  }
  return saida;
}

/** Lê o DOCX exportado e compara com o modelo do trabalho. */
export function conferirExportado(modelo: ModeloEvento, bytes: Uint8Array): { ok: true; diferencas: DiferencaExportado[] } | { ok: false; mensagem: string } {
  const r = lerModeloDocx(bytes);
  return r.ok ? { ok: true, diferencas: compararComExportado(modelo, r.modelo) } : r;
}
