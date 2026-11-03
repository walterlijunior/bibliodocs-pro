/**
 * API exposta em `window.bibliodocs` (C-10): funções nomeadas, cada uma presa a um canal fixo de `CANAIS_PROJETOS`,
 * `CANAIS_BIBLIOTECA`, `CANAIS_RECUPERACAO` ou `CANAIS_EDICAO`. O renderer nunca recebe o `ipcRenderer` nem escolhe o canal; os argumentos seguem como vieram
 * e são validados no principal (C-11). Separada do `index.ts` para ser testada sem o Electron.
 */
import { CANAIS_BIBLIOTECA, type ApiBiblioteca } from '../aplicacao/portas/biblioteca';
import { CANAIS_EDICAO, type ApiEdicao } from '../aplicacao/portas/edicao';
import { CANAIS_EXPORTACAO, type ApiExportacao } from '../aplicacao/portas/exportacao';
import { CANAIS_PROJETOS, type ApiBiblioDocs } from '../aplicacao/portas/projetos';
import { CANAIS_RECUPERACAO, type ApiRecuperacao } from '../aplicacao/portas/recuperacao';

/** `ipcRenderer.invoke`, recebido por injeção. */
export type Invocar = (canal: string, ...argumentos: unknown[]) => Promise<unknown>;

type RetornoBiblioteca<K extends keyof ApiBiblioteca> = ReturnType<ApiBiblioteca[K]>;

/**
 * `gestoDoUsuario`: há ativação do usuário em curso (`navigator.userActivation.isActive`). Sem ela, `edicao.executar`
 * não chega ao principal: o `paste()` do principal não exige gesto, e uma página comprometida poderia colar num campo
 * oculto e ler a área de transferência (revisão do M2-T06, B1). Os itens do menu sempre rodam num clique ou tecla.
 */
export function criarApiBiblioDocs(invocar: Invocar, gestoDoUsuario: () => boolean = () => false): ApiBiblioDocs {
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
    criar: (tipo) => invocar(c.criar, tipo) as RetornoBiblioteca<'criar'>,
    abrir: (item) => invocar(c.abrir, item) as RetornoBiblioteca<'abrir'>,
    renomear: (item, novoNome) => invocar(c.renomear, item, novoNome) as RetornoBiblioteca<'renomear'>,
    duplicar: (item) => invocar(c.duplicar, item) as RetornoBiblioteca<'duplicar'>,
    excluir: (item) => invocar(c.excluir, item) as RetornoBiblioteca<'excluir'>,
  };
  const cr = CANAIS_RECUPERACAO;
  type RetornoRecuperacao<K extends keyof ApiRecuperacao> = ReturnType<ApiRecuperacao[K]>;
  const recuperacao: ApiRecuperacao = {
    instantaneo: (identificador, pacote) => invocar(cr.instantaneo, identificador, pacote) as RetornoRecuperacao<'instantaneo'>,
    listar: () => invocar(cr.listar) as RetornoRecuperacao<'listar'>,
    recuperar: (oferta) => invocar(cr.recuperar, oferta) as RetornoRecuperacao<'recuperar'>,
    abrirSalvo: (oferta) => invocar(cr.abrirSalvo, oferta) as RetornoRecuperacao<'abrirSalvo'>,
    listarDescartadas: () => invocar(cr.listarDescartadas) as RetornoRecuperacao<'listarDescartadas'>,
    abrirDescartada: (versao) => invocar(cr.abrirDescartada, versao) as RetornoRecuperacao<'abrirDescartada'>,
    listarBackups: () => invocar(cr.listarBackups) as RetornoRecuperacao<'listarBackups'>,
    abrirBackup: (copia) => invocar(cr.abrirBackup, copia) as RetornoRecuperacao<'abrirBackup'>,
    fecharSemArquivo: async (copia, salvo) => {
      await invocar(cr.fecharSemArquivo, copia, salvo);
    },
  };
  const edicao: ApiEdicao = {
    executar: async (acao) => {
      if (!gestoDoUsuario()) return;
      await invocar(CANAIS_EDICAO.executar, acao);
    },
  };
  const exportacao: ApiExportacao = {
    docx: (pacote, opcoes) => invocar(CANAIS_EXPORTACAO.docx, pacote, opcoes) as ReturnType<ApiExportacao['docx']>,
  };
  return Object.freeze({
    projetos: Object.freeze(projetos),
    biblioteca: Object.freeze(biblioteca),
    recuperacao: Object.freeze(recuperacao),
    edicao: Object.freeze(edicao),
    exportacao: Object.freeze(exportacao),
  });
}
