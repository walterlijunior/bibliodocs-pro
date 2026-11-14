/**
 * Tarefas de IA (Etapa 8 da especificação de atualização). Puro: monta os pedidos, lê as sugestões e mantém o ponto de
 * retomada. Quem envia é a porta `ia` (processo principal), sempre depois da autorização do autor.
 *
 * - "Revisar tabelas e quadros" (Etapa 4): uma etapa por tabela ou quadro; manda título, fonte, nota, cabeçalho e até 5
 *   linhas; a sugestão só mexe em título, fonte e nota. As células nunca são alteradas.
 * - "Interpretar as instruções do modelo de evento" (Etapa 7): uma etapa; a sugestão traz valores para os aspectos do
 *   modelo (margens, fonte, tamanho, entrelinha, alinhamento, recuo), conferidos antes de aplicar.
 * - Ponto de retomada: cada etapa guarda a resposta e se o autor já aplicou ou descartou. Retomar envia só as
 *   pendentes; sugestão aplicada não se aplica de novo.
 */
import type { BlocoTabela, InlineDeTitulo, ModeloEvento, RegrasModelo } from '../../dominio/modelo';
import type { DadosTabela } from './tabelas';
import type { EtapaRetomada, LimitesInformados, OperacaoIA, PedidoIA, PontoRetomada, UsoInformado } from '../portas/ia';

/** Estimativa do aplicativo: 4 caracteres por token (aproximação comum para textos em português e inglês). */
export const estimarTokens = (texto: string): number => Math.ceil(texto.length / 4);
export const estimarPedido = (p: PedidoIA): number => p.mensagens.reduce((n, m) => n + estimarTokens(m.texto), 0) + (p.maxTokens ?? 0);

export const TITULOS_OPERACAO: Readonly<Record<OperacaoIA, string>> = {
  revisarTabelas: 'Revisar títulos, fontes e notas de tabelas e quadros',
  interpretarModelo: 'Interpretar as instruções do modelo de evento',
};

const plano = (t: readonly InlineDeTitulo[] | undefined) => (t ?? []).map((i) => i.texto).join('').trim();

// ---------- revisar tabelas e quadros ----------

const SISTEMA_TABELAS = [
  'Você revisa tabelas e quadros de trabalhos acadêmicos brasileiros formatados pelo Manual de Normalização da UFT, pela ABNT e, nas tabelas, pela Norma de Apresentação Tabular do IBGE.',
  'Avalie só o título, a fonte e a nota. O título não leva o rótulo ("Tabela 1"), não termina em ponto e diz o quê, onde e quando. A fonte identifica o responsável pelos dados (não só a sigla) e o ano.',
  'Nunca proponha mudar as células.',
  'Responda somente com um objeto JSON, sem texto fora dele: {"titulo": string ou null, "fonte": string ou null, "nota": string ou null, "observacoes": [strings curtas]}. Use null quando o campo já estiver adequado.',
].join(' ');

export function pedidoRevisarTabela(bloco: BlocoTabela, rotulo: string): PedidoIA {
  const linhas = bloco.linhas.map((l) => l.map((c) => plano(c.conteudo)).join(' | '));
  const cab = linhas.slice(0, bloco.linhasCabecalho);
  const corpo = linhas.slice(bloco.linhasCabecalho, bloco.linhasCabecalho + 5);
  const texto = [
    `Espécie: ${bloco.especie}`,
    `Rótulo: ${rotulo}`,
    `Título: ${plano(bloco.titulo) || '(vazio)'}`,
    `Fonte: ${plano(bloco.fonte) || '(vazia)'}`,
    `Nota: ${plano(bloco.nota) || '(vazia)'}`,
    `Cabeçalho: ${cab.join(' / ') || '(sem cabeçalho)'}`,
    `Primeiras linhas (${corpo.length} de ${bloco.linhas.length - bloco.linhasCabecalho}):`,
    ...corpo,
  ].join('\n');
  return { mensagens: [{ papel: 'sistema', texto: SISTEMA_TABELAS }, { papel: 'usuario', texto }], maxTokens: 600 };
}

export interface SugestaoTabela {
  titulo?: string;
  fonte?: string;
  nota?: string;
  observacoes: string[];
}

/** O primeiro objeto JSON do texto (a resposta pode vir entre crases). */
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

const curto = (v: unknown, max = 2000): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u0008\u000B-\u001F]/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max);
};

export function lerSugestaoTabela(texto: string): SugestaoTabela | null {
  const j = objetoJson(texto);
  if (!j) return null;
  const obs = Array.isArray(j['observacoes']) ? j['observacoes'].flatMap((o) => (curto(o, 500) ? [curto(o, 500)!] : [])).slice(0, 10) : [];
  const titulo = curto(j['titulo']);
  const fonte = curto(j['fonte']);
  const nota = curto(j['nota']);
  return { ...(titulo ? { titulo } : {}), ...(fonte ? { fonte } : {}), ...(nota ? { nota } : {}), observacoes: obs };
}

/** Os dados da tabela com os campos escolhidos da sugestão; as células são as mesmas. */
export function dadosComSugestao(bloco: BlocoTabela, s: SugestaoTabela, campos: readonly ('titulo' | 'fonte' | 'nota')[]): DadosTabela {
  const { id: _id, ...dados } = bloco;
  const trecho = (t: string): InlineDeTitulo[] => [{ tipo: 'texto', texto: t }];
  return {
    ...dados,
    ...(campos.includes('titulo') && s.titulo ? { titulo: trecho(s.titulo) } : {}),
    ...(campos.includes('fonte') && s.fonte ? { fonte: trecho(s.fonte) } : {}),
    ...(campos.includes('nota') && s.nota ? { nota: trecho(s.nota) } : {}),
  };
}

// ---------- interpretar o modelo de evento ----------

const SISTEMA_MODELO = [
  'Você lê instruções de formatação de modelos de artigos de congressos e eventos acadêmicos.',
  'Extraia apenas o que as instruções dizem explicitamente. Responda somente com um objeto JSON, sem texto fora dele, com as chaves que puder preencher:',
  '{"margemSuperiorCm": número, "margemInferiorCm": número, "margemEsquerdaCm": número, "margemDireitaCm": número, "fonte": string, "corpoPt": número, "entrelinha": "simples" | "1,5" | "duplo", "alinhamento": "esquerda" | "direita" | "centralizado" | "justificado", "recuoPrimeiraLinhaCm": número, "observacoes": [strings curtas com exigências que não cabem nessas chaves, como limite de páginas]}.',
].join(' ');

export function pedidoInterpretarModelo(modelo: ModeloEvento): PedidoIA {
  const texto = ['Instruções escritas no modelo:', ...(modelo.instrucoes ?? []).map((i) => `- ${i}`), '', `Formatação lida dos estilos do arquivo: ${JSON.stringify(modelo.reconhecidas)}`].join('\n');
  return { mensagens: [{ papel: 'sistema', texto: SISTEMA_MODELO }, { papel: 'usuario', texto }], maxTokens: 600 };
}

export interface SugestaoModelo {
  regras: Partial<Pick<RegrasModelo, 'margemSuperiorCm' | 'margemInferiorCm' | 'margemEsquerdaCm' | 'margemDireitaCm' | 'fonte' | 'corpoPt' | 'entrelinha' | 'alinhamento' | 'recuoPrimeiraLinhaCm'>>;
  observacoes: string[];
}

export function lerSugestaoModelo(texto: string): SugestaoModelo | null {
  const j = objetoJson(texto);
  if (!j) return null;
  const regras: SugestaoModelo['regras'] = {};
  const num = (k: string, min: number, max: number) => {
    const v = j[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined;
  };
  for (const k of ['margemSuperiorCm', 'margemInferiorCm', 'margemEsquerdaCm', 'margemDireitaCm'] as const) {
    const v = num(k, 0, 10);
    if (v !== undefined) regras[k] = v;
  }
  const corpo = num('corpoPt', 6, 72);
  if (corpo !== undefined) regras.corpoPt = corpo;
  const recuo = num('recuoPrimeiraLinhaCm', 0, 10);
  if (recuo !== undefined) regras.recuoPrimeiraLinhaCm = recuo;
  const fonte = curto(j['fonte'], 64);
  if (fonte && /^[\p{L}\p{N} ._-]+$/u.test(fonte)) regras.fonte = fonte;
  if (j['entrelinha'] === 'simples' || j['entrelinha'] === '1,5' || j['entrelinha'] === 'duplo') regras.entrelinha = j['entrelinha'];
  if (['esquerda', 'direita', 'centralizado', 'justificado'].includes(j['alinhamento'] as string)) regras.alinhamento = j['alinhamento'] as RegrasModelo['alinhamento'];
  const obs = Array.isArray(j['observacoes']) ? j['observacoes'].flatMap((o) => (curto(o, 500) ? [curto(o, 500)!] : [])).slice(0, 10) : [];
  return { regras, observacoes: obs };
}

// ---------- ponto de retomada ----------

export function novoPonto(trabalho: { id: string; nome: string }, operacao: OperacaoIA, etapas: readonly { chave: string; rotulo: string }[], agora: Date): PontoRetomada {
  const em = agora.toISOString();
  return {
    versao: 1,
    trabalho: { id: trabalho.id, nome: trabalho.nome.slice(0, 500) },
    operacao,
    titulo: TITULOS_OPERACAO[operacao],
    criadoEm: em,
    atualizadoEm: em,
    motivo: 'inicio',
    etapas: etapas.slice(0, 500).map((e) => ({ chave: e.chave, rotulo: e.rotulo.slice(0, 2000), estado: 'pendente' as const })),
  };
}

export function atualizarEtapa(ponto: PontoRetomada, chave: string, mudanca: Partial<EtapaRetomada>, motivo: PontoRetomada['motivo'], agora: Date): PontoRetomada {
  return { ...ponto, motivo, atualizadoEm: agora.toISOString(), etapas: ponto.etapas.map((e) => (e.chave === chave ? { ...e, ...mudanca } : e)) };
}

export const etapasPendentes = (p: PontoRetomada): EtapaRetomada[] => p.etapas.filter((e) => e.estado === 'pendente');
export const tarefaTerminada = (p: PontoRetomada): boolean => p.etapas.every((e) => e.estado === 'aplicada' || e.estado === 'descartada');

/**
 * Limite próximo: o provedor informou menos tokens restantes por minuto do que o próximo pedido estimado (com folga),
 * ou o uso do mês passou de 90% do limite que o autor definiu.
 */
export function limiteProximo(limites: LimitesInformados | null, proximaEstimativa: number, usoMes: number, limiteMes: number | undefined): string | null {
  if (limites?.tokensRestantes !== undefined && limites.tokensRestantes < proximaEstimativa * 1.2) {
    return `O provedor informou ${limites.tokensRestantes} tokens restantes neste minuto, menos do que a próxima etapa deve usar.`;
  }
  if (limiteMes !== undefined && usoMes >= limiteMes * 0.9) return `O uso do mês chegou a ${Math.round((usoMes / limiteMes) * 100)}% do limite que você definiu.`;
  return null;
}

export const somarUso = (a: UsoInformado, b: UsoInformado | null | undefined): UsoInformado => ({
  ...(a.entrada !== undefined || b?.entrada !== undefined ? { entrada: (a.entrada ?? 0) + (b?.entrada ?? 0) } : {}),
  ...(a.saida !== undefined || b?.saida !== undefined ? { saida: (a.saida ?? 0) + (b?.saida ?? 0) } : {}),
  ...(a.total !== undefined || b?.total !== undefined ? { total: (a.total ?? 0) + (b?.total ?? 0) } : {}),
});
