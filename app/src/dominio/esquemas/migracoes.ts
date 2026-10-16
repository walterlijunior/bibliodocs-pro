/**
 * Migrações do formato de projeto (ADR-0004, seção 2; M1-T07).
 *
 * Cada migração é `migrar_N_para_N+1(json) → json`: função pura, que recebe os JSON **já lidos e ainda não
 * validados** do pacote e devolve os JSON da versão seguinte, sem alterar a entrada. A validação de esquema vem só
 * depois da cadeia inteira, contra a versão atual.
 *
 * O formato v1 não tem migração real: `MIGRACOES_REGISTRADAS` fica vazio até existir o v2. Os testes usam uma
 * migração fictícia v0 → v1 (`tests/apoio/migracao-ficticia.ts`). Toda migração registrada precisa de fixture de
 * entrada e de saída em `tests/fixtures/migracoes/v<N>-para-v<N+1>/` (RNF-16); o teste de migrações confere.
 */
import { LIMITES_V1 } from './limites';
import { VERSAO_FORMATO_ATUAL } from './projeto-v1';
import { profundidadeJsonExcede, type ErroValidacao } from './validar';

/** Os JSON do pacote que uma migração pode mudar. */
export interface JsonProjeto {
  manifesto: unknown;
  documento: unknown;
}

export interface Migracao {
  /** Versão de entrada; a de saída é sempre `de + 1`. */
  de: number;
  migrar(json: Readonly<JsonProjeto>): JsonProjeto;
}

export const MIGRACOES_REGISTRADAS: readonly Migracao[] = [];

export type ResultadoMigracao =
  | { ok: true; json: JsonProjeto; /** Versões percorridas, da original até a atual; vazio se nada mudou. */ passos: number[] }
  | { ok: false; erros: ErroValidacao[] };

const erro = (mensagem: string): ResultadoMigracao => ({ ok: false, erros: [{ caminho: 'manifesto.versaoFormato', mensagem }] });

/**
 * `versaoFormato` declarada no manifesto, se for um inteiro não negativo; `null` se faltar ou for de outro tipo
 * (nesse caso o manifesto segue para a validação, que aponta o erro).
 */
export function versaoFormatoDeclarada(manifesto: unknown): number | null {
  if (manifesto === null || typeof manifesto !== 'object' || Array.isArray(manifesto)) return null;
  const v = (manifesto as { versaoFormato?: unknown }).versaoFormato;
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

/**
 * Problemas do registro: versão repetida, buraco na cadeia ou cadeia que não termina na versão atual.
 * Lista vazia = registro coerente. Conferido em teste para o registro de produção e na entrada de `migrarParaAtual`.
 */
export function problemasDoRegistro(registro: readonly Migracao[], atual: number = VERSAO_FORMATO_ATUAL): string[] {
  const problemas: string[] = [];
  const versoes = registro.map((m) => m.de).sort((a, b) => a - b);
  versoes.forEach((v, i) => {
    if (!Number.isSafeInteger(v) || v < 0) problemas.push(`versão de origem inválida: ${v}`);
    if (i > 0 && v === versoes[i - 1]) problemas.push(`duas migrações a partir da versão ${v}`);
    else if (i > 0 && v !== versoes[i - 1]! + 1) problemas.push(`falta a migração da versão ${versoes[i - 1]! + 1}`);
  });
  if (versoes.length > 0 && versoes.at(-1)! + 1 !== atual) problemas.push(`a cadeia termina na versão ${versoes.at(-1)! + 1}, não na ${atual}`);
  return problemas;
}

/**
 * Motivo pelo qual a cadeia não pode partir de `origem` (registro incoerente ou migração faltando), ou `null`.
 * Não olha o conteúdo: `lerProjeto` chama antes de descomprimir o documento (revisão do M1-T07, B3).
 */
export function motivoParaNaoMigrar(
  origem: number,
  registro: readonly Migracao[] = MIGRACOES_REGISTRADAS,
  atual: number = VERSAO_FORMATO_ATUAL,
): string | null {
  if (problemasDoRegistro(registro, atual).length > 0) return 'o aplicativo tem um registro de migrações incoerente';
  const versoes = new Set(registro.map((m) => m.de));
  for (let v = origem; v < atual; v++) {
    if (!versoes.has(v)) return `projeto em formato antigo demais (versão ${origem}) para esta versão do BiblioDocs Pro`;
  }
  return null;
}

const idDe = (manifesto: unknown): unknown =>
  manifesto !== null && typeof manifesto === 'object' ? (manifesto as { id?: unknown }).id : undefined;

/**
 * Aplica a cadeia a partir da versão declarada até `atual`, na ordem. Nunca lança: exceção dentro de uma migração
 * vira erro. Depois de cada passo confere que o manifesto passou a declarar exatamente a versão seguinte e que o
 * `id` não mudou (ele nomeia as pastas de backup e de recuperação; revisão do M1-T07, B4).
 * Versão igual à atual devolve o JSON sem passos; versão futura não é assunto daqui (quem lê decide antes).
 */
export function migrarParaAtual(
  json: Readonly<JsonProjeto>,
  registro: readonly Migracao[] = MIGRACOES_REGISTRADAS,
  atual: number = VERSAO_FORMATO_ATUAL,
): ResultadoMigracao {
  const origem = versaoFormatoDeclarada(json.manifesto);
  if (origem === null || origem >= atual) return { ok: true, json: { ...json }, passos: [] };
  const motivo = motivoParaNaoMigrar(origem, registro, atual);
  if (motivo) return erro(motivo);
  // As migrações podem percorrer a árvore recursivamente: o aninhamento é limitado antes, como na validação.
  if (profundidadeJsonExcede(json.manifesto, LIMITES_V1.profundidadeJson) || profundidadeJsonExcede(json.documento, LIMITES_V1.profundidadeJson)) {
    return erro(`estrutura aninhada demais para atualizar o formato (limite de ${LIMITES_V1.profundidadeJson} níveis)`);
  }

  const porVersao = new Map(registro.map((m) => [m.de, m]));
  const id = idDe(json.manifesto);
  let atualJson: JsonProjeto = { ...json };
  const passos = [origem];
  for (let v = origem; v < atual; v++) {
    try {
      // A conferência da saída fica dentro do try: uma migração que devolve algo que não é objeto não pode lançar daqui.
      atualJson = porVersao.get(v)!.migrar(atualJson);
      if (versaoFormatoDeclarada(atualJson.manifesto) !== v + 1) return erro(`a atualização da versão ${v} não produziu a versão ${v + 1}`);
    } catch {
      return erro(`falha ao atualizar o formato do projeto da versão ${v} para a ${v + 1}`);
    }
    if (idDe(atualJson.manifesto) !== id) return erro(`a atualização da versão ${v} mudou a identificação do projeto`);
    passos.push(v + 1);
  }
  return { ok: true, json: atualJson, passos };
}
