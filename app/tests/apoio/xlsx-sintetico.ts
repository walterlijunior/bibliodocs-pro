// Pasta de trabalho .xlsx montada à mão para os testes de "Importar planilha" (Etapa 4 da especificação de atualização),
// no formato que o Excel grava (SpreadsheetML): texto compartilhado, estilos com formato de número, bordas e
// alinhamento, mesclagens, fórmulas com e sem resultado gravado, aba oculta. Sem arquivos de usuário no repositório.
import { strToU8, zipSync } from 'fflate';

export interface AbaSintetica {
  nome: string;
  oculta?: boolean;
  /** XML de dentro de `<sheetData>`. */
  linhas: string;
  mesclagens?: string[];
  /** XML de dentro de `<cols>` (larguras). */
  colunas?: string;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Estilos: 0 padrão; 1 "0.00" centralizado; 2 negrito com bordas; 3 contábil; 4 data; 5 quebra automática à esquerda. */
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="_-* #,##0.00_-;\\-* #,##0.00_-;_-* &quot;-&quot;??_-;_-@_-"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf></cellXfs>
</styleSheet>`;

export function xlsxSintetico(abas: readonly AbaSintetica[], compartilhados: readonly string[]): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS}><sheets>${abas
        .map((a, k) => `<sheet name="${a.nome.replace(/&/g, '&amp;')}" sheetId="${k + 1}"${a.oculta ? ' state="hidden"' : ''} r:id="rId${k + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas
        .map((_, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`)
        .join('')}</Relationships>`,
    ),
    'xl/styles.xml': strToU8(ESTILOS),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${NS} count="${compartilhados.length}" uniqueCount="${compartilhados.length}">${compartilhados.map((s) => (s.startsWith('<') ? `<si>${s}</si>` : `<si><t xml:space="preserve">${s}</t></si>`)).join('')}</sst>`,
    ),
  };
  abas.forEach((a, k) => {
    arquivos[`xl/worksheets/sheet${k + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}>${a.colunas ? `<cols>${a.colunas}</cols>` : ''}<sheetData>${a.linhas}</sheetData>${
        a.mesclagens && a.mesclagens.length > 0 ? `<mergeCells count="${a.mesclagens.length}">${a.mesclagens.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''
      }</worksheet>`,
    );
  });
  return zipSync(arquivos);
}

/** Célula de texto compartilhado. */
export const s = (ref: string, i: number, estilo = 0) => `<c r="${ref}" s="${estilo}" t="s"><v>${i}</v></c>`;
/** Célula de número. */
export const n = (ref: string, v: number | string, estilo = 0) => `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
/** Linha. */
export const linha = (r: number, ...celulas: string[]) => `<row r="${r}">${celulas.join('')}</row>`;
