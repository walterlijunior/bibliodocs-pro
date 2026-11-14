/** Lista de atalhos de Ajuda › Atalhos de teclado (F-E6-01). Os dos menus vêm de `MENUS`, para não divergir. */
import { MENUS } from './definicoes';

/** Atalhos que não estão nos menus: editor de texto, árvore de seções e navegação. */
export const ATALHOS_EXTRAS: readonly { grupo: string; itens: readonly [string, string][] }[] = [
  {
    grupo: 'No texto da seção',
    itens: [
      ['Ctrl+I', 'Itálico'],
      ['Ctrl+B', 'Negrito'],
      ['Ctrl+Shift+=', 'Sobrescrito'],
      ['Ctrl+=', 'Subscrito'],
      ['Ctrl+Shift+L', 'Alíneas (liga e desliga)'],
      ['Ctrl+Shift+Q', 'Citação longa (liga e desliga)'],
      ['Shift+Enter', 'Quebra de linha no mesmo parágrafo'],
    ],
  },
  {
    grupo: 'Na lista de seções',
    itens: [
      ['F2', 'Renomear a seção'],
      ['Delete', 'Excluir a seção'],
      ['Alt+Shift+↑ / ↓', 'Subir ou descer a seção'],
      ['Alt+Shift+→ / ←', 'Recuar ou promover a seção'],
    ],
  },
  {
    grupo: 'Navegação',
    itens: [
      ['Ctrl+Page Up / Page Down', 'Seção anterior ou próxima'],
      ['Alt+← / →', 'Voltar ou avançar entre as áreas'],
      ['Setas (nas abas)', 'Trocar de aba'],
    ],
  },
];

/** Atalhos dos menus, na ordem dos menus. */
export function atalhosDosMenus(): { grupo: string; itens: [string, string][] }[] {
  return MENUS.map((m) => ({
    grupo: `Menu ${m.rotulo}`,
    itens: m.itens.flatMap((i): [string, string][] => (i !== 'separador' && i.atalho ? [[i.atalho, i.rotulo.replace(/…$/, '')]] : [])),
  })).filter((g) => g.itens.length > 0);
}

