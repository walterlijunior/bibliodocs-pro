/**
 * Liga os manipuladores das APIs `projetos`, `biblioteca`, `recuperacao` e `edicao` ao Electron: `ipcMain.handle`, diálogos nativos, Lixeira e
 * o processo leitor. As decisões ficam nos módulos puros desta pasta; aqui só se traduz o evento e se escolhe a
 * implementação real.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell, webContents, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { PERFIL_UFT_2022 } from '../../aplicacao/perfil-padrao';
import { CANAIS_BIBLIOTECA, CANAIS_EDICAO, CANAIS_EXPORTACAO, CANAIS_PROJETOS, CANAIS_RECUPERACAO, type AcaoEdicao } from '../../aplicacao';
import { arquivar, conciliarBackupsExcluidos, fazerBackupRotativo, marcarBackupsExcluidos, salvarProjeto, type PacoteProjeto } from '../../persistencia';
import { ehArtefatoDeFumaca } from '../seguranca/fumaca';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { blindar } from './chamada';
import { criarEmpacotador } from './empacotador-isolado';
import { exportarIsolado } from './exportador-isolado';
import { lerIsolado, resumirIsolado } from './leitor-isolado';
import { criarManipuladoresExportacao, gravarExportacao } from './manipuladores-exportacao';
import { criarManipuladoresBiblioteca } from './manipuladores-biblioteca';
import { criarManipuladoresEdicao } from './manipuladores-edicao';
import { criarManipuladoresProjetos, EXTENSAO_PROJETO } from './manipuladores-projetos';
import { criarManipuladoresRecuperacao, pastasRecuperacao } from './manipuladores-recuperacao';
import type { InfoRemetente } from './remetente';

const FILTROS = [{ name: 'Trabalho do BiblioDocs Pro', extensions: [EXTENSAO_PROJETO.slice(1)] }];

/**
 * `%LOCALAPPDATA%\BiblioDocsPro`: dados locais da máquina (backups, recuperação, índice da biblioteca; ADR-0004).
 * Fora do Windows, a pasta de dados do Electron.
 */
export function pastaDadosLocais(): string {
  const local = process.platform === 'win32' ? process.env['LOCALAPPDATA'] : undefined;
  return local ? join(local, 'BiblioDocsPro') : app.getPath('userData');
}

/** Pasta padrão da biblioteca (ADR-0004, seção 5): `Documentos\BiblioDocs Pro\Trabalhos`. */
export const pastaPadraoBiblioteca = (): string => join(app.getPath('documents'), 'BiblioDocs Pro', 'Trabalhos');

/** Id de projeto novo: `prj_` + 16 caracteres base64url (dentro do `PADRAO_ID`). */
const gerarIdProjeto = (): string => `prj_${randomBytes(12).toString('base64url')}`;

function infoRemetente(evento: IpcMainInvokeEvent): InfoRemetente {
  const quadro = evento.senderFrame;
  return {
    idConteudo: evento.sender.id,
    urlQuadro: quadro ? quadro.url : null,
    // Sem pai = quadro principal; não depende da identidade do objeto WebFrameMain (revisão do M1-T08, S8-07).
    quadroPrincipal: quadro !== null && quadro.parent === null,
  };
}

/** Comando do Chromium para cada item do menu Editar (os mesmos das teclas). */
const COMANDOS_EDICAO: Readonly<Record<AcaoEdicao, (c: WebContents) => void>> = {
  desfazer: (c) => c.undo(),
  refazer: (c) => c.redo(),
  recortar: (c) => c.cut(),
  copiar: (c) => c.copy(),
  colar: (c) => c.paste(),
};

const janelaDe = (idConteudo: number): BrowserWindow | null => {
  const conteudo = webContents.fromId(idConteudo);
  return conteudo ? BrowserWindow.fromWebContents(conteudo) : null;
};

/**
 * Registra os canais das duas APIs. `conteudosPermitidos` devolve os ids dos `webContents` das janelas do app;
 * `vigiar` deve ser chamado para cada janela criada, para que os identificadores dela morram com ela.
 */
export function registrarIpcProjetos(origem: OrigemPermitida, conteudosPermitidos: () => ReadonlySet<number>) {
  const entradaLeitor = join(__dirname, 'leitor-projeto.js');
  const dadosLocais = pastaDadosLocais();
  const pastaBackups = join(dadosLocais, 'backups');
  const ler = (caminho: string) => lerIsolado(entradaLeitor, { caminho, pastaBackups });
  // Empacotar (SHA-256, ZIP, releitura) fora da thread do principal, que também encaminha o teclado (M2-T01, R36).
  const empacotador = criarEmpacotador(join(__dirname, 'empacotador.js'));
  const salvar = (destino: string, pacote: PacoteProjeto) => salvarProjeto(destino, pacote, { empacotar: empacotador.empacotar });
  // Criada depois (precisa do registro dos projetos e da pasta da biblioteca); os ganchos só rodam depois disso.
  let recuperacao: ReturnType<typeof criarManipuladoresRecuperacao> | null = null;

  const { manipuladores, registro } = criarManipuladoresProjetos({
    origem,
    conteudosPermitidos,
    escolherArquivoParaAbrir: async (id) => {
      const janela = janelaDe(id);
      if (!janela) return null;
      const r = await dialog.showOpenDialog(janela, {
        title: 'Abrir trabalho',
        defaultPath: app.getPath('documents'),
        filters: FILTROS,
        properties: ['openFile'],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    escolherDestino: async (id, nome) => {
      const janela = janelaDe(id);
      if (!janela) return null;
      const r = await dialog.showSaveDialog(janela, {
        title: 'Salvar trabalho como',
        defaultPath: join(app.getPath('documents'), nome),
        filters: FILTROS,
        properties: ['showOverwriteConfirmation'],
      });
      return r.canceled || !r.filePath ? null : r.filePath;
    },
    ler,
    salvar,
    antesDeGravar: (idProjeto) => recuperacao?.antesDeGravar(idProjeto) ?? 0,
    aoGravar: async (caminho, idProjeto, dono, marca) => recuperacao?.aoGravar(caminho, idProjeto, dono, marca),
    antesDeSobrescrever: async (caminho, idProjeto) => {
      // Falha no backup nunca impede de salvar; o registro técnico não leva caminho.
      const b = await fazerBackupRotativo(caminho, pastaBackups, idProjeto);
      if (!b.feito && b.motivo === 'FALHOU') console.warn(`[backups] cópia falhou: ${b.codigo}`);
      if (b.feito && b.avisos.length > 0) console.warn(`[backups] rotação incompleta: ${b.avisos.join(', ')}`);
    },
    antesDeSubstituir: async (caminho) => recuperacao?.guardarSubstituido(caminho),
    aoFechar: async (caminho, dono) => recuperacao?.aoFechar(caminho, dono),
  });

  const biblioteca = criarManipuladoresBiblioteca({
    origem,
    conteudosPermitidos,
    pastaPadrao: pastaPadraoBiblioteca(),
    arquivoIndice: join(dadosLocais, 'biblioteca.json'),
    arquivoPreferencias: join(dadosLocais, 'preferencias.json'),
    ambiente: process.env,
    guardarBakAlheio: (caminho, nome) => arquivar(pastasRecuperacao(dadosLocais), caminho, nome, Date.now()),
    aoExcluir: (idProjeto) => marcarBackupsExcluidos(pastaBackups, idProjeto, Date.now()),
    aoListar: (ids) => conciliarBackupsExcluidos(pastaBackups, ids, Date.now()),
    escolherPasta: async (id) => {
      const janela = janelaDe(id);
      if (!janela) return null;
      const r = await dialog.showOpenDialog(janela, {
        title: 'Escolher a pasta da biblioteca',
        defaultPath: app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory'],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    confirmarExclusao: async (id, nomeArquivo) => {
      const janela = janelaDe(id);
      if (!janela) return false;
      const r = await dialog.showMessageBox(janela, {
        type: 'warning',
        title: 'Excluir trabalho',
        message: `Mover “${nomeArquivo}” para a Lixeira?`,
        detail: 'O arquivo pode ser restaurado pela Lixeira do Windows.',
        buttons: ['Mover para a Lixeira', 'Cancelar'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      return r.response === 0;
    },
    enviarParaLixeira: (caminho) => shell.trashItem(caminho),
    resumir: (caminhos) => resumirIsolado(entradaLeitor, caminhos),
    ler,
    salvar,
    projetos: registro,
    gerarIdProjeto,
    agora: () => new Date(),
    appVersao: app.getVersion(),
  });

  recuperacao = criarManipuladoresRecuperacao({
    origem,
    conteudosPermitidos,
    pastas: pastasRecuperacao(dadosLocais),
    pastaBackups,
    projetos: registro,
    pastaBiblioteca: () => biblioteca.pastaAtual(),
    ler,
    resumir: (caminhos) => resumirIsolado(entradaLeitor, caminhos),
    salvar,
    empacotar: empacotador.empacotar,
    pid: process.pid,
    agora: () => new Date(),
  });
  const rec = recuperacao;

  const log = (m: string) => console.warn(m);
  const edicao = criarManipuladoresEdicao({
    origem,
    conteudosPermitidos,
    executar: (id, acao) => {
      const conteudo = webContents.fromId(id);
      if (conteudo && !conteudo.isDestroyed()) COMANDOS_EDICAO[acao](conteudo);
    },
  });

  const exportacao = criarManipuladoresExportacao({
    origem,
    conteudosPermitidos,
    perfil: PERFIL_UFT_2022,
    escolherDestino: async (id, nome) => {
      // Só o artefato de fumaça, que não tem como responder ao diálogo nativo (`ferramentas/fumaca-exportar.mjs`).
      const destinoFumaca = process.env['BIBLIODOCS_FUMACA_DESTINO_DOCX'];
      if (destinoFumaca && app.isPackaged && ehArtefatoDeFumaca()) return destinoFumaca;
      const janela = janelaDe(id);
      if (!janela) return null;
      const r = await dialog.showSaveDialog(janela, {
        title: 'Exportar DOCX',
        defaultPath: join(app.getPath('documents'), nome),
        filters: [{ name: 'Documento do Word', extensions: ['docx'] }],
        properties: ['showOverwriteConfirmation'],
      });
      return r.canceled || !r.filePath ? null : r.filePath;
    },
    exportar: (f) => exportarIsolado(join(__dirname, 'exportador-docx.js'), f),
    gravar: gravarExportacao,
  });

  const todos = [
    ...Object.entries(exportacao),
    ...Object.entries(manipuladores),
    ...Object.entries(biblioteca.manipuladores),
    ...Object.entries(rec.manipuladores),
    ...Object.entries(edicao),
  ];
  for (const [canal, manipulador] of todos) {
    const protegido = blindar(canal, manipulador, log);
    ipcMain.handle(canal, (evento, ...argumentos: unknown[]) => protegido(infoRemetente(evento), argumentos));
  }

  return {
    vigiar(conteudo: WebContents): void {
      const id = conteudo.id;
      // `limpo`: a janela fechou normalmente (o renderer já gravou ou o usuário descartou); senão, a página caiu ou
      // recarregou com o trabalho na memória, e os instantâneos ficam para a recuperação (M1-T12).
      const esquecer = (limpo: boolean) => {
        void rec.encerrarDono(id, limpo);
        registro.esquecerDono(id);
        biblioteca.itens.esquecerDono(id);
      };
      conteudo.once('destroyed', () => esquecer(true));
      conteudo.on('render-process-gone', () => esquecer(false));
      // Recarga ou navegação para outro documento: a página nova não herda os arquivos abertos (S8-03).
      conteudo.on('did-start-navigation', (detalhes) => {
        if (detalhes.isMainFrame && !detalhes.isSameDocument) esquecer(false);
      });
    },
    /**
     * A janela fechou normalmente (evento `closed`, que vem antes do `window-all-closed`): termina as sessões de
     * recuperação dela já aqui, para a limpeza entrar na fila antes de `aguardarRecuperacao` (revisão do M1-T12, B1).
     */
    encerrarJanela: (idConteudo: number): void => void rec.encerrarDono(idConteudo, true),
    /** Espera as gravações da recuperação terminarem (antes de o app sair). */
    aguardarRecuperacao: (): Promise<void> => rec.aguardar(),
    remover(): void {
      const canais = [CANAIS_PROJETOS, CANAIS_BIBLIOTECA, CANAIS_RECUPERACAO, CANAIS_EDICAO, CANAIS_EXPORTACAO].flatMap((c) => Object.values(c));
      for (const canal of canais) {
        ipcMain.removeHandler(canal);
      }
    },
  };
}
