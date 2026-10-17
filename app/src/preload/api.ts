/**
 * API exposta em `window.bibliodocs` (C-10): funções nomeadas, cada uma presa a um canal fixo de `CANAIS_PROJETOS` ou
 * `CANAIS_BIBLIOTECA`. O renderer nunca recebe o `ipcRenderer` nem escolhe o canal; os argumentos seguem como vieram
 * e são validados no principal (C-11). Separada do `index.ts` para ser testada sem o Electron.
 */
import { CANAIS_BIBLIOTECA, type ApiBiblioteca } from '../aplicacao/portas/biblioteca';
import { CANAIS_PROJETOS, type ApiBiblioDocs } from '../aplicacao/portas/projetos';

/** `ipcRenderer.invoke`, recebido por injeção. */
export type Invocar = (canal: string, ...argumentos: unknown[]) => Promise<unknown>;

type RetornoBiblioteca<K extends keyof ApiBiblioteca> = ReturnType<ApiBiblioteca[K]>;

export function criarApiBiblioDocs(invocar: Invocar): ApiBiblioDocs {
  // As conversões de tipo confiam no contrato; o principal é quem valida o que recebe.
  const projetos: ApiBiblioDocs['projetos'] = {
    abrir: () => invocar(CANAIS_PROJETOS.abrir) as ReturnType<ApiBiblioDocs['projetos']['abrir']>,
    salvar: (identificador, pacote) =>
      invocar(CANAIS_PROJETOS.salvar, identificador, pacote) as ReturnType<ApiBiblioDocs['projetos']['salvar']>,
    salvarComo: (pacote) => invocar(CANAIS_PROJETOS.salvarComo, pacote) as ReturnType<ApiBiblioDocs['projetos']['salvarComo']>,
    fechar: async (identificador) => {
      await invocar(CANAIS_PROJETOS.fechar, identificador);
    },
  };
  const c = CANAIS_BIBLIOTECA;
  const biblioteca: ApiBiblioteca = {
    listar: () => invocar(c.listar) as RetornoBiblioteca<'listar'>,
    escolherPasta: () => invocar(c.escolherPasta) as RetornoBiblioteca<'escolherPasta'>,
    criar: () => invocar(c.criar) as RetornoBiblioteca<'criar'>,
    abrir: (item) => invocar(c.abrir, item) as RetornoBiblioteca<'abrir'>,
    renomear: (item, novoNome) => invocar(c.renomear, item, novoNome) as RetornoBiblioteca<'renomear'>,
    duplicar: (item) => invocar(c.duplicar, item) as RetornoBiblioteca<'duplicar'>,
    excluir: (item) => invocar(c.excluir, item) as RetornoBiblioteca<'excluir'>,
  };
  return Object.freeze({ projetos: Object.freeze(projetos), biblioteca: Object.freeze(biblioteca) });
}
