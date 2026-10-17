/**
 * Resumo de um `.bdp` para a biblioteca (título, tipo, datas). Lê e valida o arquivo inteiro, como na abertura, mas
 * não grava nada: um arquivo de formato antigo é migrado só em memória (o backup obrigatório fica para quando o
 * usuário o abrir de fato).
 *
 * Roda no processo leitor (`utilityProcess`), nunca no principal: o arquivo da pasta pode ter vindo de qualquer lugar
 * (regra do M1-T08 para todo `.bdp`).
 */
import { textoPlano } from '../../dominio/modelo';
import { lerArquivoLimitado } from '../arquivo/projeto-em-disco';
import { SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';
import { LIMITES_CONTEINER, type LimitesConteiner } from '../conteiner/limites';
import { lerProjeto } from '../conteiner/pacote';
import { MAX_TITULO_INDICE, type ResumoProjeto } from './indice';

/** Nunca lança: qualquer falha vira `{ estado: 'invalido' }`. */
export async function resumirProjeto(
  caminho: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  limites: LimitesConteiner = LIMITES_CONTEINER,
): Promise<ResumoProjeto> {
  try {
    const lido = await lerArquivoLimitado(caminho, fs, limites);
    if (!lido.ok) return { estado: 'invalido' };
    const r = lerProjeto(lido.bytes, limites);
    if (r.ok) {
      const { manifesto, documento } = r.pacote;
      return {
        estado: 'ok',
        id: manifesto.id,
        titulo: textoPlano(documento.metadados.titulo).slice(0, MAX_TITULO_INDICE),
        tipoTrabalho: manifesto.tipoTrabalho,
        criadoEm: manifesto.criadoEm,
        atualizadoEm: manifesto.atualizadoEm,
      };
    }
    if (r.versaoFutura) return { estado: 'versaoFutura', versaoFormato: r.versaoFutura.versaoFormato };
    return { estado: 'invalido' };
  } catch {
    return { estado: 'invalido' };
  }
}
