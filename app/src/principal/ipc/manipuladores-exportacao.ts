/**
 * Canal de exportação DOCX (M3-T08; RF-06). Confere remetente e pacote, abre o diálogo, formata com o perfil, gera no
 * processo utilitário e grava por gravação atômica, sem `.bak`: o diálogo do sistema já confirmou a substituição (R-M3-06). Uma exportação por vez.
 */
import { basename } from 'node:path';
import { CANAIS_EXPORTACAO, LIMITES_GRAFICOS_EXPORTACAO, type CanalExportacao, type ResultadoExportar } from '../../aplicacao/portas/exportacao';
import { areaUtilMm, formatar, type DocumentoFormatado, type Perfil } from '../../dominio/normas';
import { gravarAtomico, limparNomeArquivo, type ResultadoGravacao } from '../../persistencia';
import { textoPlano, type Secao } from '../../dominio/modelo';
import { lerInfoImagem } from '../../dominio/visuais';
import { verificarVisuais } from '../../dominio/verificador';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { lerPacoteTransferivel } from './argumentos';
import { criarConferencia, type Manipulador } from './chamada';
import type { RespostaExportacao } from './protocolo-exportacao';

export const EXTENSAO_DOCX = '.docx';
export const MENSAGEM_EXPORTACAO_INVALIDA = 'O trabalho tem conteúdo que não pôde ser conferido e não foi exportado. Salve e tente de novo.';
export const MENSAGEM_EXPORTACAO_FALHOU = 'Não foi possível gerar o arquivo. Nada foi gravado. Tente de novo.';
export const MENSAGEM_EXTENSAO_DOCX = 'O arquivo precisa terminar em .docx.';
export const MENSAGEM_EXPORTACAO_EM_CURSO = 'Já há uma exportação em andamento. Espere terminar.';

/** Grava o .docx sem deixar `.bak` na pasta do usuário: o diálogo do sistema já confirmou a substituição (R-M3-06). */
export const gravarExportacao = (destino: string, bytes: Uint8Array): Promise<ResultadoGravacao> => gravarAtomico(destino, bytes, { semBak: true });

export interface DependenciasExportacao {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  perfil: Perfil;
  escolherDestino: (idConteudo: number, nomeSugerido: string) => Promise<string | null>;
  exportar: (f: DocumentoFormatado) => Promise<RespostaExportacao>;
  gravar: (destino: string, bytes: Uint8Array) => Promise<ResultadoGravacao>;
  log?: (m: string) => void;
}

export function criarManipuladoresExportacao(dep: DependenciasExportacao): Readonly<Record<CanalExportacao, Manipulador>> {
  const log = dep.log ?? ((m: string) => console.warn(m));
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  let emCurso = false;

  const docx: Manipulador = async (r, argumentos): Promise<ResultadoExportar> => {
    const canal = CANAIS_EXPORTACAO.docx;
    conferir(canal, r, argumentos, 2);
    const p = lerPacoteTransferivel(argumentos[0]);
    if (!p.ok && p.recusado) return recusarArgumento(canal, `pacote (${p.motivo})`);
    const opcoes = argumentos[1];
    if (typeof opcoes !== 'object' || opcoes === null) return recusarArgumento(canal, 'opções');
    const fonte = (opcoes as { fonte?: unknown }).fonte;
    if (fonte !== undefined && (typeof fonte !== 'string' || fonte.length > 64)) return recusarArgumento(canal, 'fonte');
    // M5-T09: PNG dos gráficos, desenhados no renderer. Forma e tamanho conferidos aqui; ids e conteúdo, depois.
    const graficosArg = (opcoes as { graficos?: unknown }).graficos;
    let graficosRecebidos: [string, Uint8Array][] = [];
    if (graficosArg !== undefined) {
      if (typeof graficosArg !== 'object' || graficosArg === null || Array.isArray(graficosArg)) return recusarArgumento(canal, 'gráficos');
      graficosRecebidos = Object.entries(graficosArg) as [string, Uint8Array][];
      if (graficosRecebidos.length > LIMITES_GRAFICOS_EXPORTACAO.quantidade) return recusarArgumento(canal, 'gráficos (quantidade)');
      for (const [, bytes] of graficosRecebidos) {
        if (!(bytes instanceof Uint8Array) || bytes.length > LIMITES_GRAFICOS_EXPORTACAO.bytesPorGrafico) return recusarArgumento(canal, 'gráficos (imagem)');
      }
    }
    if (!p.ok) return { ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_INVALIDA };
    if (emCurso) return { ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_EM_CURSO };
    emCurso = true;
    try {
      const documento = p.valor.documento;
      const destino = await dep.escolherDestino(r.idConteudo, `${limparNomeArquivo(textoPlano(documento.metadados.titulo)).replace(/\.bdp$/i, '')}${EXTENSAO_DOCX}`);
      if (destino === null) return { ok: false, motivo: 'CANCELADO' };
      if (!destino.toLowerCase().endsWith(EXTENSAO_DOCX)) return { ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXTENSAO_DOCX };
      // M5-T06: as imagens das ilustrações vão com o documento, pelo sha256 (o pacote já foi conferido na leitura).
      const imagens = p.valor.midias;
      // Só PNG legível e de um gráfico que existe no documento; o resto fica de fora (o gráfico sai sem a imagem, com aviso).
      const idsGraficos = idsDeGraficos(documento.corpo);
      const graficos = new Map(graficosRecebidos.filter(([id, bytes]) => idsGraficos.has(id) && lerInfoImagem(bytes)?.tipo === 'image/png'));
      const formatado = formatar({ ...documento, imagens, graficos }, dep.perfil, fonte !== undefined ? { fonte } : {});
      const gerado = await dep.exportar(formatado);
      if (!gerado.ok) return { ok: false, motivo: 'ERRO', mensagem: MENSAGEM_EXPORTACAO_FALHOU };
      const g = await dep.gravar(destino, gerado.bytes);
      if (!g.ok) {
        log(`[exportacao] gravação falhou: ${g.codigo}${g.detalhe ? ` (${g.detalhe})` : ''}`);
        return { ok: false, motivo: 'ERRO', mensagem: g.mensagem };
      }
      // M5-T03: pendências de tabelas, quadros e ilustrações (sem fonte, tabela longa, RN-297) junto dos avisos do motor.
      const visuais = verificarVisuais(documento, { imagens, areaUtilMm: areaUtilMm(dep.perfil) });
      const avisos = [...formatado.avisos.map((a) => a.mensagem), ...visuais.map((v) => v.mensagem)];
      return { ok: true, nomeArquivo: basename(destino), avisos };
    } finally {
      emCurso = false;
    }
  };
  return Object.freeze({ [CANAIS_EXPORTACAO.docx]: docx });
}

/** Ids dos gráficos gerados de tabela do corpo (M5-T09). */
function idsDeGraficos(corpo: readonly Secao[]): Set<string> {
  const ids = new Set<string>();
  const visitar = (secoes: readonly Secao[]): void => {
    for (const s of secoes) {
      for (const b of s.blocos) if (b.tipo === 'grafico') ids.add(b.id);
      visitar(s.subsecoes);
    }
  };
  visitar(corpo);
  return ids;
}

