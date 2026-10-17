/**
 * Conteúdo fixo da casca (M1-T10), aprovado pelo usuário em 2026-10-16 (docs/GUIA_VISUAL.md): menus, abas e coleções.
 * Os itens que ainda não têm função ficam visíveis e desativados, com o marco em que chegam no código (não na tela).
 */

export type ComandoMenu =
  | 'novoTrabalho'
  | 'escolherPasta'
  | 'atualizarBiblioteca'
  | 'sair'
  | 'buscar';

export interface ItemMenu {
  rotulo: string;
  /** Texto do atalho como aparece no menu (ex.: "Ctrl+F"). */
  atalho?: string;
  /** Sem comando = desativado neste marco. */
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
      { rotulo: 'Abrir…', atalho: 'Ctrl+O' }, // M1-T11
      { rotulo: 'Salvar', atalho: 'Ctrl+S' }, // M1-T11
      'separador',
      { rotulo: 'Escolher pasta da biblioteca…', comando: 'escolherPasta' },
      { rotulo: 'Atualizar biblioteca', atalho: 'F5', comando: 'atualizarBiblioteca' },
      'separador',
      { rotulo: 'Fechar trabalho', atalho: 'Ctrl+W' }, // M1-T11
      { rotulo: 'Sair', atalho: 'Alt+F4', comando: 'sair' },
    ],
  },
  {
    rotulo: 'Editar',
    itens: [
      { rotulo: 'Desfazer', atalho: 'Ctrl+Z' }, // M2
      { rotulo: 'Refazer', atalho: 'Ctrl+Y' }, // M2
      'separador',
      { rotulo: 'Recortar', atalho: 'Ctrl+X' },
      { rotulo: 'Copiar', atalho: 'Ctrl+C' },
      { rotulo: 'Colar', atalho: 'Ctrl+V' },
      'separador',
      { rotulo: 'Buscar', atalho: 'Ctrl+F', comando: 'buscar' },
    ],
  },
  {
    rotulo: 'Trabalho',
    itens: [{ rotulo: 'Dados do trabalho…' }, { rotulo: 'Elementos pré-textuais…' }, { rotulo: 'Estrutura de seções…' }], // M2
  },
  {
    rotulo: 'Inserir',
    itens: [
      { rotulo: 'Citação…', atalho: 'Ctrl+Shift+C' }, // M6
      { rotulo: 'Tabela de planilha…' }, // M5
      { rotulo: 'Figura…' }, // M5
      { rotulo: 'Nota de rodapé' }, // M2
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
