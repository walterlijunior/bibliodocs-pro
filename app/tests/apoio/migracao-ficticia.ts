/**
 * Migração fictícia v0 → v1, só para os testes do M1-T07 (o formato v0 nunca existiu; ver
 * `tests/fixtures/migracoes/v0-para-v1/LEIAME.md`). Escrita como uma migração real: pura, sem alterar a entrada.
 */
import type { JsonProjeto, Migracao } from '../../src/dominio/esquemas';

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => v !== null && typeof v === 'object' && !Array.isArray(v);
const paraInline = (v: unknown) => (typeof v === 'string' ? (v === '' ? [] : [{ tipo: 'texto', texto: v }]) : v);

export const MIGRACAO_FICTICIA_V0_V1: Migracao = {
  de: 0,
  migrar(json: Readonly<JsonProjeto>): JsonProjeto {
    if (!ehObjeto(json.manifesto) || !ehObjeto(json.documento)) throw new Error('JSON v0 sem objeto na raiz');
    const manifesto: Objeto = { ...json.manifesto, versaoFormato: 1 };
    if (typeof manifesto.perfil === 'string') {
      const [id, versao] = manifesto.perfil.split('@');
      manifesto.perfil = { id, versao };
    }
    const documento: Objeto = { ...json.documento };
    if (ehObjeto(documento.metadados)) {
      const metadados: Objeto = { ...documento.metadados, titulo: paraInline(documento.metadados.titulo) };
      if ('subtitulo' in metadados) metadados.subtitulo = paraInline(metadados.subtitulo);
      documento.metadados = metadados;
    }
    return { manifesto, documento };
  },
};
