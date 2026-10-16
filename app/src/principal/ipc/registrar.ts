/**
 * Liga os manipuladores da API `projetos` ao Electron: `ipcMain.handle`, diálogos nativos e o processo leitor.
 * As decisões ficam nos módulos puros desta pasta; aqui só se traduz o evento e se escolhe a implementação real.
 */
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, webContents, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { CANAIS_PROJETOS } from '../../aplicacao';
import { salvarProjeto } from '../../persistencia';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerIsolado } from './leitor-isolado';
import { criarManipuladoresProjetos, EXTENSAO_PROJETO } from './manipuladores-projetos';
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

function infoRemetente(evento: IpcMainInvokeEvent): InfoRemetente {
  const quadro = evento.senderFrame;
  return {
    idConteudo: evento.sender.id,
    urlQuadro: quadro ? quadro.url : null,
    // Sem pai = quadro principal; não depende da identidade do objeto WebFrameMain (revisão do M1-T08, S8-07).
    quadroPrincipal: quadro !== null && quadro.parent === null,
  };
}

const janelaDe = (idConteudo: number): BrowserWindow | null => {
  const conteudo = webContents.fromId(idConteudo);
  return conteudo ? BrowserWindow.fromWebContents(conteudo) : null;
};

/**
 * Registra os canais. `conteudosPermitidos` devolve os ids dos `webContents` das janelas do app; `vigiar` deve ser
 * chamado para cada janela criada, para que os identificadores dela morram com ela.
 */
export function registrarIpcProjetos(origem: OrigemPermitida, conteudosPermitidos: () => ReadonlySet<number>) {
  const entradaLeitor = join(__dirname, 'leitor-projeto.js');
  const pastaBackups = join(pastaDadosLocais(), 'backups');

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
    ler: (caminho) => lerIsolado(entradaLeitor, { caminho, pastaBackups }),
    salvar: (destino, pacote) => salvarProjeto(destino, pacote),
  });

  for (const [canal, manipulador] of Object.entries(manipuladores)) {
    ipcMain.handle(canal, (evento, ...argumentos: unknown[]) => manipulador(infoRemetente(evento), argumentos));
  }

  return {
    vigiar(conteudo: WebContents): void {
      const id = conteudo.id;
      conteudo.once('destroyed', () => registro.esquecerDono(id));
      conteudo.on('render-process-gone', () => registro.esquecerDono(id));
      // Recarga ou navegação para outro documento: a página nova não herda os arquivos abertos (S8-03).
      conteudo.on('did-start-navigation', (detalhes) => {
        if (detalhes.isMainFrame && !detalhes.isSameDocument) registro.esquecerDono(id);
      });
    },
    remover(): void {
      for (const canal of Object.values(CANAIS_PROJETOS)) ipcMain.removeHandler(canal);
    },
  };
}
