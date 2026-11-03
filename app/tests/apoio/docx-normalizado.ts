// Abre e normaliza um DOCX para a regressão (ADR-0006, camada 5): sem datas, com ids sequenciais, atributos ordenados e
// uma marca por linha. Mudança de versão da biblioteca aparece como diferença legível (R32).
import { strFromU8, unzipSync } from 'fflate';

export type Partes = Record<string, string>;

export function abrirDocx(bytes: Uint8Array): Partes {
  return Object.fromEntries(
    Object.entries(unzipSync(bytes))
      .filter(([nome]) => /\.(xml|rels)$/.test(nome))
      .map(([nome, b]) => [nome, strFromU8(b)]),
  );
}

const ordenarAtributos = (xml: string): string =>
  xml.replace(/<([\w:]+)((?:\s+[\w:.-]+="[^"]*")+)(\s*\/?)>/g, (_m, tag: string, atributos: string, fim: string) => {
    const lista = atributos.match(/[\w:.-]+="[^"]*"/g) ?? [];
    return `<${tag} ${lista.sort().join(' ')}${fim.trim()}>`;
  });

export function normalizarXml(xml: string): string {
  const ids = new Map<string, number>();
  const sequencial = (id: string): number => {
    if (!ids.has(id)) ids.set(id, ids.size + 1);
    return ids.get(id)!;
  };
  return ordenarAtributos(xml)
    .replace(/\s+w:rsid\w*="[^"]*"/g, '')
    .replace(/<dcterms:(created|modified)[^>]*>[^<]*<\/dcterms:\1>/g, '<dcterms:$1/>')
    // Marcadores têm id gerado pela biblioteca; o que importa é o par início e fim.
    .replace(/(<w:bookmark(?:Start|End) (?:[\w:]+="[^"]*" )*?w:id=")([^"]+)(")/g, (_m, a: string, id: string, c: string) => `${a}${sequencial(id)}${c}`)
    .replace(/>\s*</g, '>\n<')
    .trim();
}

/** Partes que entram no instantâneo. As demais são derivadas da biblioteca, sem efeito no documento. */
export const PARTES_DO_INSTANTANEO = ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/settings.xml'] as const;
