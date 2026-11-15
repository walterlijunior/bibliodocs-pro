/**
 * Catálogo acadêmico na aplicação (Etapa 3 da especificação de atualização): carrega os dados iniciais empacotados
 * (`catalogos/catalogo-inicial.json`, validado por `tests/catalogo.test.ts`) e repassa à interface as operações puras do
 * domínio (a interface só importa tipos do domínio, ADR-0005).
 */
import dados from '../../catalogos/catalogo-inicial.json';
import type { Catalogo, FichaInstitucional, Instituicao, PerfilInstitucional } from '../dominio/catalogo';
import { validarFicha } from '../dominio/esquemas';
import type { ModeloEvento } from '../dominio/modelo';

export const CATALOGO_INICIAL = dados as unknown as Catalogo;

export {
  campiDisponiveis,
  campusDe,
  contarRegistros,
  fichaDoCatalogo,
  fichaVazia,
  FORMATO_FICHA,
  importarFicha,
  normalizarNome,
  NOVO_REGISTRO,
  perfisAplicaveis,
  type CampusFicha,
  type ConflitoPrevia,
  type ConjuntoFicha,
  type CursoFicha,
  type DecisoesImportacao,
  type DisciplinaFicha,
  type DocenteFicha,
  type FaltantePrevia,
  type FichaInstitucional,
  type ItemPrevia,
  type ManualFicha,
  type PendenciaPrevia,
  type PerfilFicha,
  type PreviaImportacao,
  type ResultadoImportacao,
  type VinculoPrevia,
  cursoDe,
  cursosDisponiveis,
  dadosInstitucionais,
  disciplinasDisponiveis,
  docentesDisponiveis,
  gravarCampus,
  gravarCurso,
  gravarInstituicao,
  idDoNome,
  idsDoCatalogo,
  idsRetirados,
  instituicaoDe,
  mesclarCatalogo,
  naturezaSugerida,
  retirarRegistro,
  revisarSelecao,
  textoCampus,
  textoCurso,
  tiposDeTrabalhoDoNivel,
  TODOS_OS_TIPOS,
  type CampoSelecao,
  type DadosInstitucionais,
} from '../dominio/catalogo';
export type { AplicacaoRegra, ManualInstitucional, PerfilInstitucional, FonteRegistro, OrigemRegistro, Campus, Catalogo, Curso, Disciplina, Docente, GrauCurso, Instituicao, NivelCurso, SelecaoCatalogo } from '../dominio/catalogo';

/** Extensão sugerida do arquivo da ficha institucional. */
export const EXTENSAO_FICHA = '.bdficha.json';
/** Tamanho máximo do arquivo da ficha (com logotipo de até 2 MB em base64). */
export const BYTES_MAX_FICHA = 8 * 1024 * 1024;

/** Lê o texto de um arquivo de ficha (JSON, com ou sem BOM) e valida. */
export function lerFicha(texto: string): { ok: true; ficha: FichaInstitucional } | { ok: false; mensagem: string } {
  let json: unknown;
  try {
    json = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    return { ok: false, mensagem: 'O arquivo não é uma ficha institucional: o conteúdo não é JSON válido.' };
  }
  if (typeof json !== 'object' || json === null || (json as { formato?: unknown }).formato !== 'bibliodocs-ficha-institucional') {
    return { ok: false, mensagem: 'O arquivo não é uma ficha institucional do BiblioDocs Pro (falta "formato": "bibliodocs-ficha-institucional").' };
  }
  const v = validarFicha(json);
  return v.ok ? { ok: true, ficha: v.valor as FichaInstitucional } : { ok: false, mensagem: `A ficha tem um problema: ${v.erro}.` };
}

/**
 * Modelo de preenchimento: uma ficha de exemplo, válida, com um registro de cada tipo e as ligações por `chave`, para
 * quem vai preencher a ficha de outra instituição num editor de texto (o formato está em `docs/FICHA_INSTITUCIONAL.md`).
 * Os campos opcionais que a pessoa não souber vão em `desconhecidos`.
 */
export function fichaModelo(): FichaInstitucional {
  const fonte = { url: 'https://www.exemplo.edu.br/cursos', consultadoEm: '2026-11-15', observacao: 'Troque pela página oficial consultada.' };
  return {
    formato: 'bibliodocs-ficha-institucional',
    versao: 1,
    instituicao: { nome: 'Universidade Exemplo', sigla: 'UEX', desconhecidos: ['logotipo'] },
    fontes: { instituicao: fonte, campi: fonte, cursos: fonte },
    campi: [
      { chave: 'sede', nome: 'Sede', especie: 'campus', cidade: 'Cidade Exemplo', uf: 'TO' },
      { chave: 'polo-norte', nome: 'Norte', especie: 'polo', desconhecidos: ['cidade', 'uf'] },
    ],
    cursos: [
      { chave: 'historia', nome: 'História', nivel: 'graduacao', grau: 'licenciatura', campi: ['sede', 'polo-norte'] },
      { chave: 'ppg-letras', nome: 'Programa de Pós-Graduação em Letras', nivel: 'mestrado', areaConcentracao: 'Estudos Literários', campi: ['sede'] },
    ],
    disciplinas: [{ chave: 'tcc', nome: 'Trabalho de Conclusão de Curso', cursos: ['historia'] }],
    docentes: [{ chave: 'ana', nome: 'Ana Exemplo', titulacao: 'Dra.', cursos: ['historia', 'ppg-letras'] }],
    manuais: [{ chave: 'manual', titulo: 'Manual de Normalização de Trabalhos Acadêmicos', url: 'https://www.exemplo.edu.br/manual.pdf', edicao: '2. ed.', data: '2024' }],
    perfis: [
      {
        chave: 'tcc-historia',
        nome: 'TCC de História',
        manual: 'manual',
        secao: 'Seção 3, p. 12',
        regras: { margemSuperiorCm: 3, margemEsquerdaCm: 3, margemInferiorCm: 2, margemDireitaCm: 2 },
        instrucoes: ['O trabalho deve ter entre 30 e 60 páginas de texto.'],
        cursos: ['historia'],
        tipos: ['monografia', 'artigo-tcc'],
      },
    ],
  };
}

/** Texto do arquivo da ficha (JSON legível, para quem quiser conferir ou preencher num editor de texto). */
export const textoDaFicha = (f: FichaInstitucional): string => `${JSON.stringify(f, null, 1)}
`;

/** Nome de arquivo sugerido ("ficha-UFT.bdficha.json"). */
export const nomeArquivoFicha = (f: FichaInstitucional): string =>
  `ficha-${(f.instituicao.sigla || 'instituicao').normalize('NFD').replace(/[^A-Za-z0-9-]+/g, '') || 'instituicao'}${EXTENSAO_FICHA}`;

/**
 * O perfil institucional como modelo do trabalho (o mesmo caminho do modelo de evento, Etapa 7): as regras valem sobre o
 * perfil base; a fonte vai nas instruções para o autor ver de onde veio.
 */
export function modeloDoPerfil(perfil: PerfilInstitucional, inst: Instituicao, agora: Date): ModeloEvento {
  const manual = inst.manuais?.find((m) => m.id === perfil.manual);
  const fonte = manual ? `Fonte: ${manual.titulo}${manual.edicao ? `, ${manual.edicao}` : ''}${perfil.secao ? `, ${perfil.secao}` : ''}${manual.url ? ` (${manual.url})` : ''}.` : perfil.secao ? `Fonte: ${perfil.secao}.` : 'Sem fonte informada.';
  const instrucoes = [fonte, ...(perfil.instrucoes ?? [])].map((t) => t.slice(0, 300)).slice(0, 50);
  return { nome: `${perfil.nome} (${inst.sigla})`.slice(0, 300), importadoEm: agora.toISOString(), reconhecidas: perfil.regras, regras: perfil.regras, instrucoes };
}
