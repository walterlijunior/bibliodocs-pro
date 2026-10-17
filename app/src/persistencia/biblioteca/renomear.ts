/**
 * Renomear um trabalho sem nunca sobrescrever outro (revisão do M1-T09, B1 e B2). O `rename` do Node no Windows
 * substitui o destino; por isso o nome novo nasce como **link físico** (`link` falha com EEXIST se o nome existir) e
 * só depois o nome antigo é removido. Volumes sem link físico (FAT, alguns compartilhamentos) caem na conferência
 * seguida de `rename`, com a janela de corrida mínima registrada como resíduo.
 *
 * Troca só de caixa (`tcc.bdp` → `TCC.bdp`): em pasta que ignora a caixa os dois nomes são o mesmo arquivo; o destino
 * só é aceito se tiver a mesma identidade (`dev:ino`) da origem, o que também protege pastas sensíveis à caixa.
 */
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';

export type ResultadoRenomear = { ok: true } | { ok: false; motivo: 'JA_EXISTE' } | { ok: false; motivo: 'ERRO'; erro: unknown };

/** Erros de `link` que indicam "este volume não faz link físico", não "o destino existe". */
const SEM_LINK = new Set(['EPERM', 'ENOTSUP', 'ENOSYS', 'EXDEV', 'EINVAL', 'EACCES']);

const existe = (fs: SistemaArquivos, caminho: string) =>
  fs.info(caminho).then(
    (i) => i,
    (e: unknown) => (codigoErro(e) === 'ENOENT' ? null : Promise.reject(e)),
  );

/** Nunca lança. `de` e `para` ficam na mesma pasta. */
export async function renomearSemSobrescrever(
  de: string,
  para: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
): Promise<ResultadoRenomear> {
  if (de === para) return { ok: true };
  try {
    if (de.toLowerCase() === para.toLowerCase()) {
      const origem = await fs.info(de);
      const destino = await existe(fs, para);
      if (destino && destino.identidade !== origem.identidade) return { ok: false, motivo: 'JA_EXISTE' };
      await fs.renomear(de, para);
      return { ok: true };
    }
    try {
      await fs.vincular(de, para);
    } catch (e) {
      const c = codigoErro(e);
      if (c === 'EEXIST') return { ok: false, motivo: 'JA_EXISTE' };
      if (!c || !SEM_LINK.has(c)) throw e;
      if (await existe(fs, para)) return { ok: false, motivo: 'JA_EXISTE' };
      await fs.renomear(de, para);
      return { ok: true };
    }
    try {
      await fs.apagar(de);
    } catch (e) {
      // Nome antigo preso (arquivo aberto por outro programa): desfaz o nome novo, nada muda.
      await fs.apagar(para).catch(() => undefined);
      throw e;
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false, motivo: 'ERRO', erro };
  }
}
