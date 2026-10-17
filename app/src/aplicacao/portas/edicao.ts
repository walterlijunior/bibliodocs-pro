/**
 * Porta `edicao` — contrato da API `window.bibliodocs.edicao.*` (M2-T06): os itens Desfazer, Refazer, Recortar, Copiar
 * e Colar do menu Editar. A página não lê nem escreve a área de transferência: o principal pede ao Chromium o mesmo
 * comando das teclas (`webContents.paste()` etc.), que age no campo em foco e dispara os eventos `cut`/`copy`/`paste`
 * de sempre. Assim a colagem pelo menu passa pelo mesmo tratamento da de Ctrl+V (`interface/editor/colagem.ts`, R40),
 * e nenhuma permissão de área de transferência é dada à página.
 *
 * Um argumento, conferido no principal contra `ACOES_EDICAO`; nada volta além do fim do pedido.
 */

export const CANAIS_EDICAO = {
  executar: 'bibliodocs:edicao:executar',
} as const;

export type CanalEdicao = (typeof CANAIS_EDICAO)[keyof typeof CANAIS_EDICAO];

export const ACOES_EDICAO = ['desfazer', 'refazer', 'recortar', 'copiar', 'colar'] as const;

export type AcaoEdicao = (typeof ACOES_EDICAO)[number];

export interface ApiEdicao {
  /** Executa o comando de edição no campo em foco da janela que pediu. */
  executar(acao: AcaoEdicao): Promise<void>;
}
