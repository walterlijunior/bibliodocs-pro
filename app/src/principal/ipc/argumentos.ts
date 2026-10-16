/**
 * Validação dos argumentos que chegam do renderer (C-11) e conversão entre o `PacoteProjeto` da persistência e o
 * `PacoteTransferivel` do contrato.
 *
 * Os argumentos chegam já desserializados pelo Electron (não há como limitar o tamanho antes); aqui se confere a forma
 * exata, a quantidade e o tamanho das mídias, e o manifesto e o documento passam pelos validadores estritos do v1.
 * O `empacotarProjeto` ainda confere a coerência entre eles ao salvar.
 */
import { z } from 'zod';
import type { MidiaTransferivel, PacoteSomenteLeituraTransferivel, PacoteTransferivel } from '../../aplicacao';
import { validarDocumentoV1, validarManifestoV1, type ErroValidacao } from '../../dominio/esquemas';
import { LIMITES_CONTEINER, type PacoteProjeto, type PacoteSomenteLeitura } from '../../persistencia';

/** 16 bytes aleatórios em base64url. */
export const PADRAO_IDENTIFICADOR = /^[A-Za-z0-9_-]{22}$/;

const esquemaIdentificador = z.string().regex(PADRAO_IDENTIFICADOR);

const esquemaPacote = z.strictObject({
  manifesto: z.unknown(),
  documento: z.unknown(),
  midias: z
    .array(
      z.strictObject({
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.instanceof(Uint8Array).refine((b) => b.byteLength >= 1 && b.byteLength <= LIMITES_CONTEINER.bytesMidia),
      }),
    )
    .max(LIMITES_CONTEINER.entradas),
  miniatura: z.instanceof(Uint8Array).refine((b) => b.byteLength <= LIMITES_CONTEINER.bytesMidia).optional(),
});

/**
 * `recusado: true` — forma errada ou limite estourado: é defeito ou ataque, não erro do usuário (o manipulador rejeita a
 * chamada); `recusado: false` — manifesto ou documento inválidos, com os erros dos validadores para o visor.
 */
export type ResultadoArgumento<T> =
  | { ok: true; valor: T }
  | { ok: false; recusado: true; motivo: string }
  | { ok: false; recusado: false; erros: ErroValidacao[] };

const recusa = (motivo: string) => ({ ok: false, recusado: true, motivo }) as const;

export function lerIdentificador(valor: unknown): string | null {
  const r = esquemaIdentificador.safeParse(valor);
  return r.success ? r.data : null;
}

/** Pacote vindo do renderer, já convertido para o `PacoteProjeto` da persistência. */
export function lerPacoteTransferivel(valor: unknown): ResultadoArgumento<PacoteProjeto> {
  const forma = esquemaPacote.safeParse(valor);
  if (!forma.success) return recusa('forma do pacote');
  const p = forma.data;

  let total = p.miniatura?.byteLength ?? 0;
  const midias = new Map<string, Uint8Array>();
  for (const m of p.midias) {
    if (midias.has(m.sha256)) return recusa('mídia repetida');
    total += m.bytes.byteLength;
    if (total > LIMITES_CONTEINER.bytesArquivo) return recusa('tamanho total das mídias');
    midias.set(m.sha256, m.bytes);
  }

  const manifesto = validarManifestoV1(p.manifesto);
  const documento = validarDocumentoV1(p.documento);
  const erros = [...(manifesto.ok ? [] : manifesto.erros), ...(documento.ok ? [] : documento.erros)];
  if (!manifesto.ok || !documento.ok) return { ok: false, recusado: false, erros };

  const pacote: PacoteProjeto = { manifesto: manifesto.valor, documento: documento.valor, midias };
  if (p.miniatura) pacote.miniatura = p.miniatura;
  return { ok: true, valor: pacote };
}

const listaMidias = (midias: ReadonlyMap<string, Uint8Array>): MidiaTransferivel[] =>
  [...midias].map(([sha256, bytes]) => ({ sha256, bytes }));

export function paraTransferivel(pacote: PacoteProjeto): PacoteTransferivel {
  const t: PacoteTransferivel = { manifesto: pacote.manifesto, documento: pacote.documento, midias: listaMidias(pacote.midias) };
  if (pacote.miniatura) t.miniatura = pacote.miniatura;
  return t;
}

export function paraTransferivelSomenteLeitura(pacote: PacoteSomenteLeitura): PacoteSomenteLeituraTransferivel {
  const t: PacoteSomenteLeituraTransferivel = {
    manifesto: pacote.manifesto,
    documento: pacote.documento,
    midias: listaMidias(pacote.midias),
  };
  if (pacote.miniatura) t.miniatura = pacote.miniatura;
  return t;
}
