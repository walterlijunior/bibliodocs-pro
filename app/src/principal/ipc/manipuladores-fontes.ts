/**
 * Canais `bibliodocs:fontes:*` (Etapa 5 da especificação de atualização): o PDF da obra no computador.
 *
 * - `escolherPdf`: a janela do sistema, só arquivos `.pdf`; devolve o caminho escolhido.
 * - `abrirPdf`: o caminho vem do documento (que pode vir de outra pessoa), então é conferido aqui: texto curto, absoluto,
 *   sem caractere de controle, extensão `.pdf` e arquivo que existe. Só então vai para o leitor padrão do sistema. Nada
 *   é lido nem copiado pelo aplicativo.
 */
import { isAbsolute, extname } from 'node:path';
import { CANAIS_FONTES, type CanalFontes, type ResultadoAbrirPdf, type ResultadoEscolherPdf } from '../../aplicacao/portas/fontes';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { criarConferencia, type Manipulador } from './chamada';

export const LIMITE_CAMINHO_PDF = 2_000;
export const MENSAGEM_PDF_AUSENTE = 'O PDF não foi encontrado nesse caminho. Ele pode ter sido movido ou apagado: escolha o arquivo de novo.';
export const MENSAGEM_PDF_NAO_ABERTO = 'O PDF não pôde ser aberto. Confira se há um leitor de PDF instalado.';

export interface DependenciasFontes {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  escolher: (idConteudo: number) => Promise<string | null>;
  /** `true` = é um arquivo comum. */
  ehArquivo: (caminho: string) => Promise<boolean>;
  /** `shell.openPath`: texto vazio = aberto; senão, o erro. */
  abrir: (caminho: string) => Promise<string>;
  log?: (m: string) => void;
}

/** Caminho que pode ir para o leitor do sistema (antes de conferir se existe). */
export function caminhoPdfValido(caminho: unknown): caminho is string {
  return (
    typeof caminho === 'string' &&
    caminho.length > 0 &&
    caminho.length <= LIMITE_CAMINHO_PDF &&
    !/[\u0000-\u001F]/.test(caminho) &&
    isAbsolute(caminho) &&
    !caminho.startsWith('\\') &&
    extname(caminho).toLowerCase() === '.pdf'
  );
}

export function criarManipuladoresFontes(dep: DependenciasFontes): Readonly<Record<CanalFontes, Manipulador>> {
  const log = dep.log ?? ((m: string) => console.warn(m));
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);

  const escolherPdf: Manipulador = async (r, argumentos): Promise<ResultadoEscolherPdf> => {
    conferir(CANAIS_FONTES.escolherPdf, r, argumentos, 0);
    const caminho = await dep.escolher(r.idConteudo);
    return caminho !== null && caminhoPdfValido(caminho) ? { caminho } : null;
  };

  const abrirPdf: Manipulador = async (r, argumentos): Promise<ResultadoAbrirPdf> => {
    const canal = CANAIS_FONTES.abrirPdf;
    conferir(canal, r, argumentos, 1);
    const caminho = argumentos[0];
    if (!caminhoPdfValido(caminho)) return recusarArgumento(canal, 'caminho do PDF');
    if (!(await dep.ehArquivo(caminho).catch(() => false))) return { ok: false, mensagem: MENSAGEM_PDF_AUSENTE };
    const erro = await dep.abrir(caminho).catch(() => 'falhou');
    if (erro !== '') {
      log('[fontes] o leitor de PDF não abriu o arquivo');
      return { ok: false, mensagem: MENSAGEM_PDF_NAO_ABERTO };
    }
    return { ok: true };
  };

  return { [CANAIS_FONTES.escolherPdf]: escolherPdf, [CANAIS_FONTES.abrirPdf]: abrirPdf } as Record<CanalFontes, Manipulador>;
}
