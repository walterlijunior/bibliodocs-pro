/**
 * Nomes de arquivo e caminhos da biblioteca (M1-T09): validação do nome digitado ao renomear, limpeza do título para o
 * nome sugerido, nome livre na pasta, comparação de caminhos e detecção do OneDrive (risco R16; ADR-0004, seção 5).
 */
import { extname, resolve, sep } from 'node:path';
import { codigoErro, SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';

export const EXTENSAO_PROJETO = '.bdp';

/** Caracteres que o Windows não aceita em nome de arquivo, e controles. */
const PROIBIDOS_NOME = /[<>:"/\\|?*\u0000-\u001F]/u;
const PROIBIDOS_NOME_TODOS = new RegExp(PROIBIDOS_NOME.source, 'gu');
const NOMES_RESERVADOS = /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/iu;
/**
 * Caracteres de formatação invisíveis (`\p{Cf}`: marcas de direção como U+202E, espaço de largura zero), que permitem
 * nomes enganosos, e surrogates órfãos, que o Windows grava como U+FFFD (o nome no índice divergiria do arquivo).
 * Revisão do M1-T09, B3.
 */
const INVISIVEIS = /\p{Cf}/u;
const INVISIVEIS_TODOS = /\p{Cf}/gu;
const SURROGATE_ORFAO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const SURROGATE_ORFAO_TODOS = new RegExp(SURROGATE_ORFAO.source, 'g');
/** Tamanho máximo do nome sem a extensão (em caracteres). */
export const MAX_NOME_TRABALHO = 80;
const NOME_PADRAO = 'Trabalho';

export const ehArquivoProjeto = (nome: string): boolean => extname(nome).toLowerCase() === EXTENSAO_PROJETO;

/** Nome sem a extensão `.bdp` (em qualquer caixa). `.bdp` sozinho vira vazio (o `extname` o trata como sem extensão). */
export const semExtensao = (nome: string): string =>
  nome.toLowerCase().endsWith(EXTENSAO_PROJETO) ? nome.slice(0, -EXTENSAO_PROJETO.length) : nome;

const cortar = (texto: string, max: number) => [...texto].slice(0, max).join('');

/**
 * Nome de arquivo a partir de um texto qualquer (o título do trabalho): tira invisíveis, troca o que o Windows não
 * aceita por espaço, corta no tamanho máximo e tira pontos e espaços do fim. Texto que não sobra nada vira "Trabalho".
 */
export function limparNomeArquivo(texto: string): string {
  let nome = texto
    .replace(SURROGATE_ORFAO_TODOS, '')
    .replace(INVISIVEIS_TODOS, '')
    .replace(PROIBIDOS_NOME_TODOS, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  nome = cortar(nome, MAX_NOME_TRABALHO).replace(/[ .]+$/u, '');
  if (nome === '' || NOMES_RESERVADOS.test(nome)) nome = NOME_PADRAO;
  return `${nome}${EXTENSAO_PROJETO}`;
}

export type ResultadoNome = { ok: true; nomeArquivo: string } | { ok: false; mensagem: string };

/**
 * Confere o nome digitado ao renomear. Diferente de `limparNomeArquivo`, não corrige nada: o usuário vê a mensagem
 * e decide. Espaços nas pontas são ignorados e um `.bdp` no fim é aceito.
 */
export function validarNomeTrabalho(digitado: string): ResultadoNome {
  const nome = semExtensao(digitado.trim()).trim();
  if (nome === '') return { ok: false, mensagem: 'Informe um nome para o trabalho.' };
  if (PROIBIDOS_NOME.test(nome)) return { ok: false, mensagem: 'O nome não pode conter os caracteres < > : " / \\ | ? *.' };
  if (INVISIVEIS.test(nome) || SURROGATE_ORFAO.test(nome)) {
    return { ok: false, mensagem: 'O nome tem caracteres invisíveis ou inválidos. Digite-o de novo.' };
  }
  if ([...nome].length > MAX_NOME_TRABALHO) return { ok: false, mensagem: `O nome pode ter no máximo ${MAX_NOME_TRABALHO} caracteres.` };
  if (nome.endsWith('.')) return { ok: false, mensagem: 'O nome não pode terminar em ponto.' };
  if (NOMES_RESERVADOS.test(nome)) return { ok: false, mensagem: `“${nome}” é um nome reservado pelo Windows.` };
  return { ok: true, nomeArquivo: `${nome}${EXTENSAO_PROJETO}` };
}

/** Nome base acrescido de um sufixo, sem passar do tamanho máximo (o sufixo é preservado). */
export function comSufixo(base: string, sufixo: string): string {
  const espaco = MAX_NOME_TRABALHO - [...sufixo].length;
  return `${cortar(base, espaco).replace(/[ .]+$/u, '')}${sufixo}`;
}

/** Tentativas de nome livre: `Nome.bdp`, `Nome (2).bdp`... */
const NOMES_TENTADOS = 1_000;

/**
 * Primeiro nome livre na pasta para `base` (sem extensão). `null` se todos os tentados existem. Erro de disco que não
 * seja "não existe" é lançado para quem chamou.
 */
export async function nomeLivre(pasta: string, base: string, fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE): Promise<string | null> {
  for (let n = 1; n <= NOMES_TENTADOS; n++) {
    const nome = `${n === 1 ? base : comSufixo(base, ` (${n})`)}${EXTENSAO_PROJETO}`;
    try {
      await fs.info(resolve(pasta, nome));
    } catch (e) {
      if (codigoErro(e) === 'ENOENT') return nome;
      throw e;
    }
  }
  return null;
}

const CAIXA_INDIFERENTE = process.platform === 'win32' || process.platform === 'darwin';

/** Forma comparável de um caminho: absoluto e, no Windows (e macOS), sem diferença de caixa. */
export function chaveCaminho(caminho: string): string {
  const c = resolve(caminho);
  return CAIXA_INDIFERENTE ? c.toLowerCase() : c;
}

const dentroDe = (chave: string, raiz: string) => chave === raiz || chave.startsWith(raiz.endsWith(sep) ? raiz : `${raiz}${sep}`);

/** Variáveis que o cliente do OneDrive define (pessoal e corporativo). */
const VARIAVEIS_ONEDRIVE = ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial'] as const;
/** Pastas que o cliente cria: `OneDrive` e `OneDrive - <organização>`. */
const PASTA_ONEDRIVE = /^onedrive( - .+)?$/iu;

/**
 * Se a pasta fica dentro do OneDrive (R16): pelas variáveis de ambiente do cliente ou, sem elas, por uma pasta do
 * caminho com o nome que o cliente usa. Cobre a pasta Documentos redirecionada pelo OneDrive ("backup de pastas").
 * [HIPÓTESE] outros clientes de sincronização (Google Drive, Dropbox) não são detectados.
 */
export function pastaNaNuvem(pasta: string, ambiente: Readonly<Record<string, string | undefined>>): boolean {
  const chave = chaveCaminho(pasta);
  for (const v of VARIAVEIS_ONEDRIVE) {
    const raiz = ambiente[v];
    if (raiz && raiz.trim() !== '' && dentroDe(chave, chaveCaminho(raiz))) return true;
  }
  return chave.split(sep).some((parte) => PASTA_ONEDRIVE.test(parte));
}
