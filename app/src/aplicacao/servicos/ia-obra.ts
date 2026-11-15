/**
 * Metadados da obra sugeridos pela IA (Etapa 5 da especificação de atualização, D-E5-07; opcional). Puro: monta o pedido
 * com o texto que o autor forneceu (referência colada, trecho da página, texto do PDF ou o link escrito — o aplicativo
 * não abre o link) e converte a resposta em `ReferenciaLida`, a mesma prévia da referência colada: o que foi sugerido,
 * a fonte de cada campo quando a IA a informa, o que ficou incerto e o que falta. Nada é gravado sem a revisão, e
 * "Preencher os campos vazios" mantém o que o autor já escreveu (datas, nomes conferidos).
 */
import type { ReferenciaLida } from '../../dominio/bibliografia';
import type { Autor, InlineDeTitulo, TipoObra } from '../../dominio/modelo';
import { TIPOS_OBRA } from '../../dominio/modelo';
import type { PedidoIA } from '../portas/ia';

export const TITULO_SUGERIR_OBRA = 'Sugerir dados da obra';
export const LIMITE_TEXTO_OBRA_IA = 20_000;

const SISTEMA = [
  'Você extrai metadados bibliográficos para referências ABNT de trabalhos acadêmicos brasileiros.',
  'Use só o que está no material enviado: não invente autores, datas, páginas nem endereços. O que não estiver no material fica fora.',
  `Escolha o tipo entre: ${TIPOS_OBRA.join(', ')}. Página de Relações com Investidores citada como página: documentoOnline; relatório ou documento baixado do RI: relatorio ou demonstracaoFinanceira (com o período).`,
  'Autoria: pessoas como {"tipo":"pessoa","sobrenome":"SOBRENOME","prenomes":"Prenomes"}; instituição ou empresa como {"tipo":"entidade","nome":"NOME"}.',
  'Responda somente com um objeto JSON: {"tipo": string, "campos": {"autores": [...], "titulo": string, "subtitulo": string, "periodico": string, "local": string, "editora": string, "ano": número, "edicao": número, "volume": string, "numero": string, "paginas": string, "periodo": string, "natureza": string, "instituicao": string, "ementa": string, "url": string, "acesso": "AAAA-MM-DD", "doi": string}, "fontes": {"campo": "trecho do material de onde saiu"}, "incertos": [{"campo": string, "motivo": string}]}.',
].join(' ');

export function pedidoSugerirObra(material: string): PedidoIA {
  return {
    mensagens: [
      { papel: 'sistema', texto: SISTEMA },
      { papel: 'usuario', texto: `Material da obra:\n\n${material.slice(0, LIMITE_TEXTO_OBRA_IA)}` },
    ],
    maxTokens: 1500,
  };
}

function objetoJson(texto: string): Record<string, unknown> | null {
  const ini = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    const v = JSON.parse(texto.slice(ini, fim + 1)) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const linha = (v: unknown, max = 500): string | undefined => {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const t = String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max);
};
const trechos = (v: unknown): InlineDeTitulo[] | undefined => {
  const t = linha(v);
  return t ? [{ tipo: 'texto', texto: t }] : undefined;
};
const inteiro = (v: unknown, max: number): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
};

function autoresDe(v: unknown): Autor[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const lista = v.flatMap((a): Autor[] => {
    if (typeof a !== 'object' || a === null) return [];
    const o = a as Record<string, unknown>;
    if (o['tipo'] === 'entidade' && linha(o['nome'])) return [{ tipo: 'entidade', nome: linha(o['nome'])! }];
    const sobrenome = linha(o['sobrenome']);
    if (!sobrenome) return [];
    const prenomes = linha(o['prenomes']);
    return [{ tipo: 'pessoa', sobrenome, ...(prenomes ? { prenomes } : {}) }];
  });
  return lista.length > 0 ? lista.slice(0, 50) : undefined;
}

/** A sugestão como `ReferenciaLida` (com a fonte de cada campo nos incertos, para a revisão); `null` = resposta inválida. */
export function lerObraSugerida(resposta: string): (ReferenciaLida & { fontes: Record<string, string> }) | null {
  const j = objetoJson(resposta);
  if (!j || typeof j['campos'] !== 'object' || j['campos'] === null) return null;
  const c = j['campos'] as Record<string, unknown>;
  const tipo = (TIPOS_OBRA as readonly string[]).includes(String(j['tipo'])) ? (j['tipo'] as TipoObra) : 'documentoOnline';
  const campos: ReferenciaLida['campos'] = {};
  const autores = autoresDe(c['autores']);
  if (autores) campos.autores = autores;
  const titulo = trechos(c['titulo']);
  if (titulo) campos.titulo = titulo;
  const subtitulo = trechos(c['subtitulo']);
  if (subtitulo) campos.subtitulo = subtitulo;
  for (const k of ['periodico', 'local', 'editora', 'volume', 'numero', 'paginas', 'periodo', 'natureza', 'instituicao', 'ementa', 'doi'] as const) {
    const v = linha(c[k], k === 'ementa' ? 2000 : 500);
    if (v) campos[k] = v;
  }
  const url = linha(c['url']);
  if (url && /^https?:\/\/\S+$/.test(url)) campos.url = url;
  const acesso = linha(c['acesso']);
  if (acesso && /^\d{4}-\d{2}-\d{2}$/.test(acesso)) campos.acesso = acesso;
  const ano = inteiro(c['ano'], 9999);
  if (ano) campos.ano = ano;
  const edicao = inteiro(c['edicao'], 999);
  if (edicao) campos.edicao = edicao;
  const fontes: Record<string, string> = {};
  if (typeof j['fontes'] === 'object' && j['fontes'] !== null) {
    for (const [k, v] of Object.entries(j['fontes'] as Record<string, unknown>)) {
      const f = linha(v, 300);
      if (f) fontes[k] = f;
    }
  }
  const incertos: ReferenciaLida['incertos'] = [{ campo: 'tipo', motivo: 'Tipo sugerido pela IA: confira.' }];
  if (Array.isArray(j['incertos'])) {
    for (const x of j['incertos'] as unknown[]) {
      if (typeof x !== 'object' || x === null) continue;
      const o = x as Record<string, unknown>;
      const campo = linha(o['campo'], 40);
      if (campo) incertos.push({ campo, motivo: `IA: ${linha(o['motivo'], 300) ?? 'confira este campo.'}` });
    }
  }
  // Campo sem a fonte informada também se confere.
  for (const k of Object.keys(campos)) if (!fontes[k] && !incertos.some((x) => x.campo === k)) incertos.push({ campo: k, motivo: 'A IA não indicou de onde tirou este dado: confira.' });
  const faltando: string[] = [];
  if (!campos.titulo) faltando.push('título');
  if (campos.ano === undefined) faltando.push('ano');
  if (campos.url && !campos.acesso) faltando.push('data de acesso');
  return { tipo, campos, incertos, faltando, fontes };
}
