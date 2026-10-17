/**
 * Conteúdo fixo da casca (M1-T10), aprovado pelo usuário em 2026-10-16 (docs/GUIA_VISUAL.md): menus, abas e coleções.
 * Os itens que ainda não têm função ficam visíveis e desativados, com o marco em que chegam no código (não na tela).
 */
import type { TrabalhoDaSessao } from '../../aplicacao';

export type ComandoMenu =
  | 'novoTrabalho'
  | 'abrir'
  | 'salvar'
  | 'salvarComo'
  | 'fecharTrabalho'
  | 'escolherPasta'
  | 'atualizarBiblioteca'
  | 'sair'
  | 'buscar'
  // M2-T06: menu Editar e Inserir › Nota de rodapé.
  | 'desfazer'
  | 'refazer'
  | 'recortar'
  | 'copiar'
  | 'colar'
  | 'colarSemFormatacao'
  | 'inserirNota'
  // M2-T07: Trabalho › Estrutura de seções… (foco na árvore) e os botões de seção da barra superior.
  | 'estruturaSecoes'
  | 'secaoAnterior'
  | 'proximaSecao';

export interface ItemMenu {
  rotulo: string;
  /** Texto do atalho como aparece no menu (ex.: "Ctrl+F"). */
  atalho?: string;
  /** Sem comando = desativado neste marco (ou desativado agora, pela lista `desativados` da barra de menus). */
  comando?: ComandoMenu;
}

export type EntradaMenu = ItemMenu | 'separador';

export interface Menu {
  rotulo: string;
  itens: readonly EntradaMenu[];
}

export const MENUS: readonly Menu[] = [
  {
    rotulo: 'Arquivo',
    itens: [
      { rotulo: 'Novo trabalho', atalho: 'Ctrl+N', comando: 'novoTrabalho' },
      { rotulo: 'Abrir…', atalho: 'Ctrl+O', comando: 'abrir' },
      { rotulo: 'Salvar', atalho: 'Ctrl+S', comando: 'salvar' },
      // Saída do ADR-0004 para arquivo em uso ou sem .bdp (M1-T11).
      { rotulo: 'Salvar como…', atalho: 'Ctrl+Shift+S', comando: 'salvarComo' },
      'separador',
      { rotulo: 'Escolher pasta da biblioteca…', comando: 'escolherPasta' },
      { rotulo: 'Atualizar biblioteca', atalho: 'F5', comando: 'atualizarBiblioteca' },
      'separador',
      { rotulo: 'Fechar trabalho', atalho: 'Ctrl+W', comando: 'fecharTrabalho' },
      { rotulo: 'Sair', atalho: 'Alt+F4', comando: 'sair' },
    ],
  },
  {
    rotulo: 'Editar',
    itens: [
      { rotulo: 'Desfazer', atalho: 'Ctrl+Z', comando: 'desfazer' },
      { rotulo: 'Refazer', atalho: 'Ctrl+Y', comando: 'refazer' },
      'separador',
      { rotulo: 'Recortar', atalho: 'Ctrl+X', comando: 'recortar' },
      { rotulo: 'Copiar', atalho: 'Ctrl+C', comando: 'copiar' },
      { rotulo: 'Colar', atalho: 'Ctrl+V', comando: 'colar' },
      // Cola só o texto, sem itálico, listas ou notas (B5 da revisão do M2-T05).
      { rotulo: 'Colar sem formatação', atalho: 'Ctrl+Shift+V', comando: 'colarSemFormatacao' },
      'separador',
      { rotulo: 'Buscar', atalho: 'Ctrl+F', comando: 'buscar' },
    ],
  },
  {
    rotulo: 'Trabalho',
    itens: [
      { rotulo: 'Dados do trabalho…' }, // M2
      { rotulo: 'Elementos pré-textuais…' }, // M2
      { rotulo: 'Estrutura de seções…', comando: 'estruturaSecoes' },
    ],
  },
  {
    rotulo: 'Inserir',
    itens: [
      { rotulo: 'Citação…', atalho: 'Ctrl+Shift+C' }, // M6
      { rotulo: 'Tabela de planilha…' }, // M5
      { rotulo: 'Figura…' }, // M5
      { rotulo: 'Nota de rodapé', atalho: 'Ctrl+Alt+F', comando: 'inserirNota' },
      { rotulo: 'Sigla…' }, // M2
    ],
  },
  {
    rotulo: 'Verificar',
    itens: [
      { rotulo: 'Verificar conformidade', atalho: 'F7' }, // M4
      { rotulo: 'Ir para a próxima não conformidade', atalho: 'F8' }, // M4
    ],
  },
  {
    rotulo: 'Exportar',
    itens: [{ rotulo: 'Exportar DOCX…', atalho: 'Ctrl+E' }], // M3 (PDF fica para depois do M7, ADR-0003)
  },
  {
    rotulo: 'Ajuda',
    itens: [{ rotulo: 'Guia rápido', atalho: 'F1' }, { rotulo: 'Atalhos de teclado' }, { rotulo: 'Sobre o BiblioDocs Pro' }],
  },
];

/**
 * Comandos que não se aplicam ao trabalho aberto agora (M1-T11): sem trabalho não há o que salvar nem fechar; versão
 * futura não grava. Num arquivo sem `.bdp`, "Salvar" continua ativo para mostrar o aviso que leva ao "Salvar como…".
 * Os itens de edição (Desfazer, Copiar, Colar…) ficam sempre ativos: valem também nos campos de texto da casca.
 */
export function comandosDesativados(trabalho: Pick<TrabalhoDaSessao, 'podeSalvar' | 'somenteLeitura'> | null): ReadonlySet<ComandoMenu> {
  const d = new Set<ComandoMenu>();
  if (trabalho === null || trabalho.somenteLeitura) d.add('salvarComo');
  if (trabalho === null || trabalho.somenteLeitura) d.add('salvar');
  if (trabalho === null) d.add('fecharTrabalho');
  if (trabalho === null || trabalho.somenteLeitura) d.add('inserirNota');
  if (trabalho === null) {
    d.add('estruturaSecoes');
    d.add('secaoAnterior');
    d.add('proximaSecao');
  }
  return d;
}

/** "Ctrl+Shift+C" → "Control+Shift+C" (formato de `aria-keyshortcuts`). */
export function atalhoAria(atalho: string): string {
  return atalho.replace(/\bCtrl\b/g, 'Control');
}

export const ABAS = [
  { id: 'biblioteca', rotulo: 'Biblioteca' },
  { id: 'escrever', rotulo: 'Escrever' },
  { id: 'elementos', rotulo: 'Elementos' },
  { id: 'referencias', rotulo: 'Referências' },
  { id: 'conformidade', rotulo: 'Conformidade' },
] as const;

export type IdAba = (typeof ABAS)[number]['id'];

export const COLECOES = [
  { id: 'trabalhos', rotulo: 'Trabalhos' },
  { id: 'referencias', rotulo: 'Referências' },
  { id: 'visuais', rotulo: 'Figuras e Tabelas' },
  { id: 'siglas', rotulo: 'Siglas' },
  { id: 'modelos', rotulo: 'Modelos' },
] as const;

export type IdColecao = (typeof COLECOES)[number]['id'];
