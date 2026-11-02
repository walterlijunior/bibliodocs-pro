/**
 * Regras puras da grade da biblioteca (M1-T10): filtros da barra lateral, busca, ordenação, contagens e textos.
 * Sem React e sem DOM, para ser testado em Node (tests/interface-biblioteca.test.ts).
 */
import type { ItemBiblioteca } from '../../aplicacao';
import type { TipoTrabalhoId, TipoTrabalhoUft } from '../../dominio/modelo';

export type Filtro = { tipo: 'todos' } | { tipo: 'recentes' } | { tipo: 'tipoTrabalho'; id: string };

export const FILTRO_TODOS: Filtro = { tipo: 'todos' };

/** "Recentes" = os trabalhos modificados por último. [HIPÓTESE de uso] 10 basta para a barra lateral. */
export const LIMITE_RECENTES = 10;

/**
 * Nome de cada tipo de trabalho na interface (M2-T02; RF-02). `generico` é o tipo dos trabalhos criados no M1. Tipo
 * desconhecido (arquivo de versão futura) aparece pelo próprio id.
 */
export const ROTULOS_TIPO: Readonly<Record<TipoTrabalhoId, string>> = {
  generico: 'Genérico',
  monografia: 'TCC (monografia)',
  'artigo-tcc': 'Artigo como TCC',
  dissertacao: 'Dissertação',
  tese: 'Tese',
  'relatorio-tecnico': 'Relatório técnico',
  'projeto-pesquisa': 'Projeto de pesquisa',
};

/**
 * Tipos oferecidos em "Novo trabalho", na ordem de `TIPOS_TRABALHO_UFT` (a interface só importa tipos do domínio, e
 * `tests/tipos-trabalho.test.ts` confere que as listas são iguais), com o que cada um traz pronto.
 */
export const TIPOS_NOVO_TRABALHO: readonly { id: TipoTrabalhoUft; descricao: string }[] = [
  { id: 'monografia', descricao: 'Graduação ou especialização. Elementos exigidos pelo Manual da UFT (Quadro 5).' },
  { id: 'artigo-tcc', descricao: 'TCC em formato de artigo. Capa, folha de rosto e referências conforme o Manual da UFT; seções sugeridas.' },
  { id: 'dissertacao', descricao: 'Mestrado. Elementos exigidos pelo Manual da UFT (Quadro 5).' },
  { id: 'tese', descricao: 'Doutorado. Elementos exigidos pelo Manual da UFT (Quadro 5).' },
  { id: 'relatorio-tecnico', descricao: 'O Manual da UFT não fixa a estrutura; você pode ajustar os elementos sugeridos pelo modelo da UFT.' },
  { id: 'projeto-pesquisa', descricao: 'O Manual da UFT não fixa a estrutura; você pode ajustar os elementos sugeridos pelo modelo da UFT.' },
];

export function rotuloTipo(id: string | null): string {
  if (id === null) return 'Tipo desconhecido';
  return Object.hasOwn(ROTULOS_TIPO, id) ? ROTULOS_TIPO[id as TipoTrabalhoId] : id;
}

const EXTENSAO = /\.bdp$/i;

/** Título do trabalho; sem título (ou ilegível), o nome do arquivo sem a extensão. */
export function tituloExibido(item: ItemBiblioteca): string {
  const titulo = item.titulo.trim();
  if (titulo !== '') return titulo;
  return item.nomeArquivo.replace(EXTENSAO, '');
}

/** Minúsculas e sem acentos, para a busca não depender de "Educação" × "educacao". */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

const COLADOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Ordem alfabética do título exibido; empate pelo nome do arquivo (único na pasta). */
export function ordenarPorTitulo(itens: readonly ItemBiblioteca[]): ItemBiblioteca[] {
  return [...itens].sort(
    (a, b) => COLADOR.compare(tituloExibido(a), tituloExibido(b)) || COLADOR.compare(a.nomeArquivo, b.nomeArquivo),
  );
}

/** Modificados por último primeiro; empate pelo título. */
export function recentes(itens: readonly ItemBiblioteca[]): ItemBiblioteca[] {
  return [...itens]
    .sort((a, b) => b.modificadoEm - a.modificadoEm || COLADOR.compare(tituloExibido(a), tituloExibido(b)))
    .slice(0, LIMITE_RECENTES);
}

export function aplicarFiltro(itens: readonly ItemBiblioteca[], filtro: Filtro): ItemBiblioteca[] {
  switch (filtro.tipo) {
    case 'todos':
      return ordenarPorTitulo(itens);
    case 'recentes':
      return recentes(itens);
    case 'tipoTrabalho':
      return ordenarPorTitulo(itens.filter((i) => i.tipoTrabalho === filtro.id));
  }
}

/** Busca no título exibido e no nome do arquivo; todas as palavras precisam aparecer. */
export function buscar(itens: readonly ItemBiblioteca[], termo: string): ItemBiblioteca[] {
  const palavras = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [...itens];
  return itens.filter((i) => {
    const alvo = normalizarBusca(`${tituloExibido(i)} ${i.nomeArquivo}`);
    return palavras.every((p) => alvo.includes(p));
  });
}

export interface ContagemTipo {
  id: string;
  rotulo: string;
  quantidade: number;
}

export interface Contagens {
  todos: number;
  recentes: number;
  /** Só os tipos presentes na pasta, em ordem alfabética do rótulo. Itens sem tipo (ilegíveis) ficam fora. */
  porTipo: ContagemTipo[];
}

export function contar(itens: readonly ItemBiblioteca[]): Contagens {
  const porTipo = new Map<string, number>();
  for (const i of itens) {
    if (i.tipoTrabalho !== null) porTipo.set(i.tipoTrabalho, (porTipo.get(i.tipoTrabalho) ?? 0) + 1);
  }
  return {
    todos: itens.length,
    recentes: Math.min(itens.length, LIMITE_RECENTES),
    porTipo: [...porTipo]
      .map(([id, quantidade]) => ({ id, rotulo: rotuloTipo(id), quantidade }))
      .sort((a, b) => COLADOR.compare(a.rotulo, b.rotulo)),
  };
}

export function tituloDaLista(filtro: Filtro): string {
  switch (filtro.tipo) {
    case 'todos':
      return 'Todos os trabalhos';
    case 'recentes':
      return 'Recentes';
    case 'tipoTrabalho':
      return `Trabalhos do tipo ${rotuloTipo(filtro.id)}`;
  }
}

export function mesmoFiltro(a: Filtro, b: Filtro): boolean {
  if (a.tipo !== b.tipo) return false;
  return a.tipo !== 'tipoTrabalho' || a.id === (b as typeof a).id;
}

/** Texto curto do estado do arquivo para o cartão; `null` quando está tudo bem. */
export function avisoDoItem(item: ItemBiblioteca): string | null {
  switch (item.estado) {
    case 'ok':
      return null;
    case 'versaoFutura':
      return 'Criado por versão mais nova';
    case 'invalido':
      return 'Não pôde ser lido';
  }
}

/** Nome acessível do cartão (o leitor de tela não vê a capa). */
export function rotuloDoCartao(item: ItemBiblioteca): string {
  const partes = [tituloExibido(item)];
  if (item.estado === 'ok') partes.push(rotuloTipo(item.tipoTrabalho));
  const aviso = avisoDoItem(item);
  if (aviso !== null) partes.push(aviso);
  partes.push(`modificado em ${formatarData(item.modificadoEm)}`);
  return partes.join(', ');
}

/** Data curta pt-BR (dd/mm/aaaa) no fuso do computador. */
export function formatarData(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Data e hora pt-BR (dd/mm/aaaa hh:mm); texto ISO inválido volta como veio. */
export function formatarDataHora(valor: string | number): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Ano para a capa em miniatura (criação do trabalho; sem manifesto, a data do arquivo). */
export function anoDoItem(item: ItemBiblioteca): number {
  const data = item.criadoEm === null ? new Date(item.modificadoEm) : new Date(item.criadoEm);
  return Number.isNaN(data.getTime()) ? new Date(item.modificadoEm).getFullYear() : data.getFullYear();
}

/** Tamanho em KB/MB com vírgula decimal. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
  return `${(kb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
