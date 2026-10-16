/**
 * Mensagens entre o processo principal e o processo leitor (`utilityProcess`, `leitor-projeto.ts`).
 *
 * Por que um processo à parte (pendência da revisão do M1-T05, ADR-0004): o `.bdp` aberto pelo usuário pode vir de
 * qualquer lugar. Ler o ZIP, descomprimir e validar acontece fora do principal; uma falha nativa, falta de memória ou
 * laço longo derruba só o leitor, e o principal responde "não foi possível ler o arquivo".
 *
 * A resposta já vem na forma do contrato (`PacoteTransferivel`, sem `Map`) e com o backup reduzido ao nome do arquivo
 * (revisão M6-11). O leitor é código do próprio app: o principal confere o envelope da resposta, não refaz a validação
 * profunda (o conteúdo volta a ser validado por inteiro antes de qualquer gravação).
 */
import { basename, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { AvisoProjeto, ErroProjeto, PacoteSomenteLeituraTransferivel, PacoteTransferivel } from '../../aplicacao';
import { LIMITES_V1, PADRAO_ID } from '../../dominio/esquemas';
import type { ResultadoAbertura } from '../../persistencia';
import { paraTransferivel, paraTransferivelSomenteLeitura } from './argumentos';

export interface PedidoLeitor {
  caminho: string;
  pastaBackups: string;
}

export type RespostaLeitor =
  | { ok: true; pacote: PacoteTransferivel; avisos: AvisoProjeto[]; migracao: number[]; nomeBackup: string | null }
  | {
      ok: false;
      erros: ErroProjeto[];
      versaoFutura?: {
        versaoFormato: number;
        leitura: { pacote: PacoteSomenteLeituraTransferivel; avisos: AvisoProjeto[] } | null;
      };
    };

const caminhoAbsoluto = z.string().min(1).max(32_767).refine((c) => isAbsolute(c) && !c.includes('\0'));

const esquemaPedido = z.strictObject({ caminho: caminhoAbsoluto, pastaBackups: caminhoAbsoluto });

export function lerPedidoLeitor(valor: unknown): PedidoLeitor | null {
  const r = esquemaPedido.safeParse(valor);
  return r.success ? r.data : null;
}

export function paraRespostaLeitor(r: ResultadoAbertura): RespostaLeitor {
  if (r.ok) {
    return {
      ok: true,
      pacote: paraTransferivel(r.pacote),
      avisos: r.avisos,
      migracao: r.migracao,
      nomeBackup: r.backupMigracao === null ? null : basename(r.backupMigracao),
    };
  }
  if (!r.versaoFutura) return { ok: false, erros: r.erros };
  const { versaoFormato, leitura } = r.versaoFutura;
  return {
    ok: false,
    erros: r.erros,
    versaoFutura: {
      versaoFormato,
      leitura: leitura && { pacote: paraTransferivelSomenteLeitura(leitura.pacote), avisos: leitura.avisos },
    },
  };
}

const TEXTO_MAXIMO = 2_000;
const esquemaMensagem = z.strictObject({ caminho: z.string().max(TEXTO_MAXIMO), mensagem: z.string().max(TEXTO_MAXIMO) });
const listaMensagens = z.array(esquemaMensagem).max(LIMITES_V1.errosRelatados * 100);
// Manifesto e documento: só o envelope (a validação profunda é a do leitor e, antes de gravar, a do salvamento).
const esquemaPacoteRecebido = z.strictObject({
  manifesto: z.looseObject({ id: z.string().regex(PADRAO_ID), versaoFormato: z.int() }),
  documento: z.looseObject({}),
  midias: z.array(z.strictObject({ sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.instanceof(Uint8Array) })),
  miniatura: z.instanceof(Uint8Array).optional(),
});
const nomeArquivo = z.string().min(1).max(255).refine((n) => basename(n) === n && !/[\\/]/.test(n));
const esquemaResposta = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    pacote: esquemaPacoteRecebido,
    avisos: listaMensagens,
    migracao: z.array(z.int()).max(1_000),
    nomeBackup: nomeArquivo.nullable(),
  }),
  z.strictObject({
    ok: z.literal(false),
    erros: listaMensagens,
    versaoFutura: z
      .strictObject({
        versaoFormato: z.int(),
        leitura: z.strictObject({ pacote: esquemaPacoteRecebido, avisos: listaMensagens }).nullable(),
      })
      .optional(),
  }),
]);

/**
 * Confere o envelope da resposta do leitor; `null` se não for uma resposta reconhecível. Campos extras fora do
 * manifesto e do documento recusam a resposta (revisão do M1-T08, S8-05).
 */
export function lerRespostaLeitor(valor: unknown): RespostaLeitor | null {
  return esquemaResposta.safeParse(valor).success ? (valor as RespostaLeitor) : null;
}

/** Resposta usada quando o leitor falha, demora demais ou responde fora do protocolo. */
export const RESPOSTA_FALHA_LEITOR: RespostaLeitor = {
  ok: false,
  erros: [{ caminho: 'arquivo', mensagem: 'não foi possível ler o arquivo' }],
};
