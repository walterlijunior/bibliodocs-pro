/**
 * Contêiner `.bdp` (ADR-0004, seções 1 a 3): empacotar e ler o projeto em memória.
 *
 * Coerência entre arquivos (decisão técnica do M1-T05): `manifesto.id` e `manifesto.tipoTrabalho` são iguais aos do
 * `documento.json`. O manifesto é um índice legível sem processar o documento; esse id único nomeia as pastas de
 * recuperação e de backup.
 */
import { createHash } from 'node:crypto';
import { zipSync, type Zippable } from 'fflate';
import type { Documento } from '../../dominio/modelo';
import {
  MIGRACOES_REGISTRADAS,
  migrarParaAtual,
  MIMETYPE_PROJETO,
  motivoParaNaoMigrar,
  validarDocumentoV1,
  validarManifestoV1,
  VERSAO_FORMATO_ATUAL,
  versaoFormatoDeclarada,
  type ErroValidacao,
  type Manifesto,
  type Migracao,
} from '../../dominio/esquemas';
import { LIMITES_CONTEINER, type LimitesConteiner } from './limites';
import { lerZip, type EntradaZip } from './zip-leitura';

export interface PacoteProjeto {
  manifesto: Manifesto;
  documento: Documento;
  /** Bytes de cada mídia, pela chave sha256 do manifesto. */
  midias: ReadonlyMap<string, Uint8Array>;
  miniatura?: Uint8Array;
}

/** Problema que não impede abrir o projeto (ex.: mídia descartada). */
export interface AvisoPacote {
  caminho: string;
  mensagem: string;
}

/**
 * Pacote de versão futura aberto só para leitura. O manifesto mantém a versão do arquivo (`number`, não o literal
 * da versão atual): `salvarProjeto` não aceita este tipo na compilação e `empacotarProjeto` o recusa na execução,
 * então um arquivo novo nunca é regravado no formato antigo (revisão do M1-T07, M2).
 */
export type PacoteSomenteLeitura = Omit<PacoteProjeto, 'manifesto'> & {
  manifesto: Omit<Manifesto, 'versaoFormato'> & { versaoFormato: number };
};

/**
 * Projeto gravado por uma versão mais nova do app (ADR-0004, seção 2; R33). Nunca é editável: a leitura vem num
 * resultado `ok: false`, então nenhum caminho de edição ou de salvamento recebe esse pacote por engano.
 */
export interface VersaoFutura {
  versaoFormato: number;
  /**
   * Conteúdo para abrir só para leitura, quando ele passa na validação da versão atual (lido como se fosse dela);
   * `null` quando a versão nova usa algo que esta não conhece.
   */
  leitura: { pacote: PacoteSomenteLeitura; avisos: AvisoPacote[] } | null;
}

export type ResultadoLeituraProjeto =
  | {
      ok: true;
      pacote: PacoteProjeto;
      avisos: AvisoPacote[];
      /** Versões percorridas pela migração (ex.: `[0, 1]`); vazio se o arquivo já estava na versão atual. */
      migracao: number[];
    }
  | { ok: false; erros: ErroValidacao[]; versaoFutura?: VersaoFutura };

type ResultadoMontagem = { ok: true; pacote: PacoteProjeto; avisos: AvisoPacote[] } | { ok: false; erros: ErroValidacao[] };

export type ResultadoEmpacotamento = { ok: true; bytes: Uint8Array } | { ok: false; erros: ErroValidacao[] };

const NOME_MIDIA = /^midias\/([0-9a-f]{64})\.(png|jpg)$/;
const NAO_SUPORTADOS_V1 = new Set(['bibliografia.json', 'ajustes.json']);
/**
 * Nomes que uma versão futura do formato pode trazer (JSON novo na raiz, mídia de outro tipo). O leitor do ZIP os
 * aceita com limite, mas nunca os descomprime: a recusa vem depois do manifesto, para que um arquivo de versão futura
 * receba a mensagem de versão nova (revisão do M1-T07, M1).
 */
const JSON_DESCONHECIDO = /^[a-z0-9_-]+\.json$/;
const MIDIA_DESCONHECIDA = /^midias\/[0-9a-f]{64}\.[a-z0-9]{1,8}$/;
const NOMES_V1 = new Set(['mimetype', 'manifesto.json', 'documento.json', 'miniatura.png']);
const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ASSINATURA_JPEG = [0xff, 0xd8, 0xff];
/** Data fixa nas entradas: o mesmo conteúdo gera os mesmos bytes. */
const DATA_ENTRADAS = new Date(1980, 0, 1);

const comeca = (dados: Uint8Array, assinatura: readonly number[]) => assinatura.every((b, i) => dados[i] === b);
const sha256 = (dados: Uint8Array) => createHash('sha256').update(dados).digest('hex');
const paraJson = (valor: unknown) => new TextEncoder().encode(`${JSON.stringify(valor, null, 2)}\n`);

function tipoPelosBytes(dados: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (comeca(dados, ASSINATURA_PNG)) return 'image/png';
  if (comeca(dados, ASSINATURA_JPEG)) return 'image/jpeg';
  return null;
}

function coerencia(manifesto: Manifesto, documento: Documento): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  if (manifesto.id !== documento.id) erros.push({ caminho: 'manifesto.id', mensagem: 'id do manifesto diferente do id do documento' });
  if (manifesto.tipoTrabalho !== documento.tipoTrabalho) {
    erros.push({ caminho: 'manifesto.tipoTrabalho', mensagem: 'tipo de trabalho do manifesto diferente do documento' });
  }
  return erros;
}

/**
 * Gera o `.bdp` em memória. Valida tudo antes e relê o resultado com `lerProjeto` antes de devolvê-lo: o app nunca
 * entrega para gravação um pacote que ele mesmo recusaria ao abrir (revisão do M1-T05, A1).
 */
export function empacotarProjeto(pacote: PacoteProjeto, limites: LimitesConteiner = LIMITES_CONTEINER): ResultadoEmpacotamento {
  const rm = validarManifestoV1(pacote.manifesto);
  const rd = validarDocumentoV1(pacote.documento);
  const erros = [...(rm.ok ? [] : rm.erros), ...(rd.ok ? [] : rd.erros)];
  if (erros.length === 0) erros.push(...coerencia(pacote.manifesto, pacote.documento));

  const declaradas = new Set(pacote.manifesto.midias.map((m) => m.sha256));
  pacote.manifesto.midias.forEach((m, i) => {
    const caminho = `manifesto.midias[${i}]`;
    const dados = pacote.midias.get(m.sha256);
    if (!dados) return void erros.push({ caminho, mensagem: 'mídia declarada sem conteúdo' });
    if (sha256(dados) !== m.sha256) erros.push({ caminho, mensagem: 'sha256 não confere com o conteúdo da mídia' });
    if (dados.length !== m.bytes) erros.push({ caminho, mensagem: 'tamanho não confere com o conteúdo da mídia' });
    if (tipoPelosBytes(dados) !== m.tipo) erros.push({ caminho, mensagem: 'conteúdo da mídia não corresponde ao tipo declarado' });
  });
  for (const chave of pacote.midias.keys()) {
    if (!declaradas.has(chave)) erros.push({ caminho: `midias/${chave}`, mensagem: 'mídia não declarada no manifesto' });
  }
  if (pacote.miniatura && !comeca(pacote.miniatura, ASSINATURA_PNG)) {
    erros.push({ caminho: 'miniatura.png', mensagem: 'a miniatura não é PNG' });
  }
  if (erros.length > 0) return { ok: false, erros };

  // Ordem de inserção = ordem no ZIP: mimetype primeiro e sem compressão (como ODF/EPUB).
  const arquivos: Zippable = {
    mimetype: [new TextEncoder().encode(MIMETYPE_PROJETO), { level: 0 }],
    'manifesto.json': paraJson(pacote.manifesto),
    'documento.json': paraJson(pacote.documento),
  };
  if (pacote.miniatura) arquivos['miniatura.png'] = [pacote.miniatura, { level: 0 }];
  // PNG e JPEG já são comprimidos: gravar sem recompressão (ADR-0004, consequências).
  for (const m of pacote.manifesto.midias) arquivos[m.caminho] = [pacote.midias.get(m.sha256)!, { level: 0 }];
  const bytes = zipSync(arquivos, { level: 6, mtime: DATA_ENTRADAS });

  const releitura = lerProjeto(bytes, limites);
  if (!releitura.ok) {
    return { ok: false, erros: releitura.erros.map((e) => ({ caminho: e.caminho, mensagem: `o projeto passaria do limite de leitura: ${e.mensagem}` })) };
  }
  if (releitura.avisos.length > 0) {
    return { ok: false, erros: releitura.avisos.map((a) => ({ caminho: a.caminho, mensagem: `releitura divergente: ${a.mensagem}` })) };
  }
  return { ok: true, bytes };
}

function politicaNomes(limites: LimitesConteiner) {
  return (nome: string): number | null => {
    if (nome === 'mimetype') return MIMETYPE_PROJETO.length;
    if (nome === 'manifesto.json') return limites.bytesManifesto;
    if (nome === 'documento.json' || JSON_DESCONHECIDO.test(nome)) return limites.bytesJson;
    if (nome === 'miniatura.png' || MIDIA_DESCONHECIDA.test(nome)) return limites.bytesMidia;
    return null;
  };
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: ErroValidacao[] };

function lerJson(entrada: EntradaZip | undefined, nome: string): Resultado<unknown> {
  if (!entrada) return { ok: false, erros: [{ caminho: nome, mensagem: 'arquivo obrigatório ausente no pacote' }] };
  const r = entrada.ler();
  if (!r.ok) return { ok: false, erros: [r.erro] };
  try {
    return { ok: true, valor: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.dados)) };
  } catch {
    return { ok: false, erros: [{ caminho: nome, mensagem: 'JSON inválido ou texto fora de UTF-8' }] };
  }
}

/**
 * Recusa pelo nome, sem descomprimir: conteúdo que o v1 conhece e não suporta, ou nome que o v1 não conhece.
 * Roda depois do manifesto (para a mensagem de versão futura) e antes do documento.
 */
function recusaPorNome(entradas: readonly EntradaZip[]): { ok: false; erros: ErroValidacao[] } | null {
  for (const { nome } of entradas) {
    if (NAO_SUPORTADOS_V1.has(nome)) return { ok: false, erros: [{ caminho: nome, mensagem: 'conteúdo não suportado nesta versão do formato' }] };
  }
  for (const { nome } of entradas) {
    if (!NOMES_V1.has(nome) && !NOME_MIDIA.test(nome)) return { ok: false, erros: [{ caminho: nome, mensagem: 'nome de entrada não permitido no pacote' }] };
  }
  return null;
}

/**
 * Lê um `.bdp` em memória. Erro estrutural recusa o pacote; mídia divergente é descartada com aviso.
 * A descompressão segue a ordem da validação (revisão do M1-T05, A2/A3): nomes → mimetype → manifesto → versão →
 * recusas pelo nome e pela cadeia de migrações → documento → só as mídias declaradas. Nada é descomprimido depois de um erro, nem o que vai ser descartado.
 *
 * Versões do formato (M1-T07): versão antiga passa pela cadeia de migrações antes da validação (`migracao` diz o
 * caminho; o backup obrigatório é de `abrirProjeto`); versão futura é recusada com `versaoFutura`.
 */
export function lerProjeto(
  bytes: Uint8Array,
  limites: LimitesConteiner = LIMITES_CONTEINER,
  migracoes: readonly Migracao[] = MIGRACOES_REGISTRADAS,
): ResultadoLeituraProjeto {
  const zip = lerZip(bytes, limites, politicaNomes(limites));
  if (!zip.ok) return zip;
  const porNome = new Map(zip.entradas.map((e) => [e.nome, e]));

  const mimetype = porNome.get('mimetype');
  if (!mimetype || mimetype.deslocamento !== 0 || mimetype.metodo !== 0) {
    return { ok: false, erros: [{ caminho: 'mimetype', mensagem: 'o pacote deve começar pela entrada mimetype sem compressão' }] };
  }
  const rmime = mimetype.ler();
  if (!rmime.ok) return { ok: false, erros: [rmime.erro] };
  if (new TextDecoder().decode(rmime.dados) !== MIMETYPE_PROJETO) {
    return { ok: false, erros: [{ caminho: 'mimetype', mensagem: 'este arquivo não é um projeto do BiblioDocs Pro' }] };
  }

  const jm = lerJson(porNome.get('manifesto.json'), 'manifesto.json');
  if (!jm.ok) return jm;
  const versao = versaoFormatoDeclarada(jm.valor);
  const lerDocumento = () => lerJson(porNome.get('documento.json'), 'documento.json');

  if (versao !== null && versao > VERSAO_FORMATO_ATUAL) {
    const comoAtual = { ...(jm.valor as object), versaoFormato: VERSAO_FORMATO_ATUAL };
    const r = montarPacote(comoAtual, lerDocumento, porNome, zip.entradas);
    const leitura = r.ok ? { pacote: { ...r.pacote, manifesto: { ...r.pacote.manifesto, versaoFormato: versao } }, avisos: r.avisos } : null;
    return {
      ok: false,
      erros: [{ caminho: 'manifesto.versaoFormato', mensagem: 'projeto criado por uma versão mais nova do BiblioDocs Pro' }],
      versaoFutura: { versaoFormato: versao, leitura },
    };
  }
  if (versao !== null && versao < VERSAO_FORMATO_ATUAL) {
    // Formato antigo: o documento é lido antes de validar o manifesto, porque só se valida depois de migrar. As recusas
    // que não dependem dele vêm antes, para não descomprimir à toa (revisão do M1-T07, B3).
    const porNomeRecusa = recusaPorNome(zip.entradas);
    if (porNomeRecusa) return porNomeRecusa;
    const motivo = motivoParaNaoMigrar(versao, migracoes);
    if (motivo) return { ok: false, erros: [{ caminho: 'manifesto.versaoFormato', mensagem: motivo }] };
    const jd = lerDocumento();
    if (!jd.ok) return jd;
    const m = migrarParaAtual({ manifesto: jm.valor, documento: jd.valor }, migracoes);
    if (!m.ok) return m;
    const r = montarPacote(m.json.manifesto, () => ({ ok: true, valor: m.json.documento }), porNome, zip.entradas);
    return r.ok ? { ...r, migracao: m.passos } : r;
  }
  const r = montarPacote(jm.valor, lerDocumento, porNome, zip.entradas);
  return r.ok ? { ...r, migracao: [] } : r;
}

/** Valida manifesto e documento (já na versão atual) e lê as mídias declaradas e a miniatura. */
function montarPacote(
  manifestoJson: unknown,
  lerDocumento: () => Resultado<unknown>,
  porNome: ReadonlyMap<string, EntradaZip>,
  entradas: readonly EntradaZip[],
): ResultadoMontagem {
  const porNomeRecusa = recusaPorNome(entradas);
  if (porNomeRecusa) return porNomeRecusa;
  const rm = validarManifestoV1(manifestoJson);
  if (!rm.ok) return rm;
  const jd = lerDocumento();
  if (!jd.ok) return jd;
  const rd = validarDocumentoV1(jd.valor);
  if (!rd.ok) return rd;
  const erros = coerencia(rm.valor, rd.valor);
  if (erros.length > 0) return { ok: false, erros };

  const avisos: AvisoPacote[] = [];
  const midias = new Map<string, Uint8Array>();
  const midiasValidas = rm.valor.midias.filter((m) => {
    const entrada = porNome.get(m.caminho);
    let problema = '';
    let dados: Uint8Array | undefined;
    if (!entrada) problema = 'mídia declarada e ausente no pacote';
    else if (entrada.bytes !== m.bytes) problema = 'tamanho não confere com o manifesto';
    else {
      const r = entrada.ler();
      if (!r.ok) problema = r.erro.mensagem;
      else if (sha256(r.dados) !== m.sha256) problema = 'sha256 não confere com o manifesto';
      else if (tipoPelosBytes(r.dados) !== m.tipo) problema = 'conteúdo não corresponde ao tipo declarado';
      else dados = r.dados;
    }
    if (!dados) {
      avisos.push({ caminho: m.caminho, mensagem: `${problema}; mídia descartada` });
      return false;
    }
    midias.set(m.sha256, dados);
    return true;
  });
  const declaradas = new Set(rm.valor.midias.map((m) => m.caminho));
  for (const e of entradas) {
    if (NOME_MIDIA.test(e.nome) && !declaradas.has(e.nome)) avisos.push({ caminho: e.nome, mensagem: 'mídia não declarada no manifesto; descartada' });
  }

  let miniatura: Uint8Array | undefined;
  const entradaMiniatura = porNome.get('miniatura.png');
  if (entradaMiniatura) {
    const r = entradaMiniatura.ler();
    if (r.ok && comeca(r.dados, ASSINATURA_PNG)) miniatura = r.dados;
    else avisos.push({ caminho: 'miniatura.png', mensagem: `${r.ok ? 'a miniatura não é PNG' : r.erro.mensagem}; descartada` });
  }

  const pacote: PacoteProjeto = { manifesto: { ...rm.valor, midias: midiasValidas }, documento: rd.valor, midias };
  if (miniatura) pacote.miniatura = miniatura;
  return { ok: true, pacote, avisos };
}
