/**
 * Logotipo da instituição no catálogo (Etapa 3 da especificação de atualização): guardado em base64 no próprio catálogo
 * e copiado como imagem para as mídias do trabalho ao escolher a instituição (o brasão da capa, RN-118).
 */
import type { Instituicao } from '../../aplicacao';

/** Bytes do logotipo guardado no catálogo. */
export function bytesDoLogotipo(dados: string): Uint8Array {
  const binario = atob(dados);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Base64 dos bytes (para guardar no catálogo). */
export function base64DosBytes(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

export const hexDoHash = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** O que a escolha da instituição leva ao trabalho: o logotipo dela ou, sem logotipo, nenhum (`null` tira o anterior). */
export function logotipoParaAplicar(inst: Instituicao | undefined): { sha256: string; bytes: Uint8Array } | null {
  return inst?.logotipo ? { sha256: inst.logotipo.sha256, bytes: bytesDoLogotipo(inst.logotipo.dados) } : null;
}

/** PNG ou JPEG pelos primeiros bytes; `null` para outro formato. */
export function tipoDaImagem(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Tamanho máximo do logotipo (cabe no catálogo em base64). */
export const BYTES_MAX_LOGOTIPO = 2 * 1024 * 1024;
