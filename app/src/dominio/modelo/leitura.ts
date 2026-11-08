/** Ordem de leitura do conteúdo editável: corpo e, depois, apêndices/anexos (M6-T05). */
import type { Documento, Secao } from './tipos';

export type DocumentoDeLeitura = Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'posTextuais'>>;
export type EntradaDeLeitura = readonly Secao[] | DocumentoDeLeitura;

/** Projeção para os serviços que já trabalham com seções; não cria títulos ou números no documento persistido. */
export function secoesDeLeitura(doc: DocumentoDeLeitura): readonly Secao[] {
  const pos = (doc.posTextuais ?? []).flatMap((e): Secao[] => e.tipo === 'apendice' || e.tipo === 'anexo'
    ? [{ id: e.id, titulo: e.titulo ? [{ tipo: 'texto', texto: e.titulo }] : [], blocos: e.blocos ?? [], subsecoes: [] }]
    : []);
  return pos.length === 0 ? doc.corpo : [...doc.corpo, ...pos];
}

/** Compatibilidade com chamadas que só dispõem do corpo, anteriores ao M6. */
export function secoesDaEntrada(entrada: EntradaDeLeitura): readonly Secao[] {
  return 'corpo' in entrada ? secoesDeLeitura(entrada) : entrada;
}
