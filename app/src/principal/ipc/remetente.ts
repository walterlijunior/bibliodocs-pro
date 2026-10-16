/**
 * Verificação do remetente de uma chamada IPC (C-11) — função pura, testada em tests/ipc-projetos.test.ts.
 *
 * Uma chamada só é aceita quando vem:
 * - de um `webContents` criado pelo app (a janela principal), e não de outro conteúdo qualquer;
 * - do quadro principal desse conteúdo (um iframe nunca chama a API);
 * - de um quadro cuja URL está exatamente na origem da interface (`app://interface` ou a origem dev exata).
 */
import { urlNaOrigem, type OrigemPermitida } from '../seguranca/politica-urls';

/** Dados do remetente tirados do `IpcMainInvokeEvent` (em `registrar.ts`). */
export interface InfoRemetente {
  /** `event.sender.id`. */
  idConteudo: number;
  /** `event.senderFrame.url`, ou `null` se o quadro já foi destruído ou navegou. */
  urlQuadro: string | null;
  /** O quadro remetente é o `mainFrame` do `webContents`. */
  quadroPrincipal: boolean;
}

export function remetentePermitido(
  remetente: InfoRemetente,
  origem: OrigemPermitida,
  conteudosPermitidos: ReadonlySet<number>,
): boolean {
  if (!conteudosPermitidos.has(remetente.idConteudo)) return false;
  if (!remetente.quadroPrincipal || remetente.urlQuadro === null) return false;
  return urlNaOrigem(remetente.urlQuadro, origem);
}
