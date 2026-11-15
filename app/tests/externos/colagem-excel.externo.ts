// Etapa 4 da especificação de atualização — colagem editável do Excel real. Com `BDP_COLAGEM` (pasta), lê o "HTML
// Format" capturado da área de transferência do Excel (`colar-*.html`, copiados de `QUADROS.xlsx`) e compara a grade da
// colagem com a da importação do mesmo intervalo pelo arquivo (`BDP_PLANILHAS` ou a pasta acima do repositório). Os
// arquivos do usuário não entram no repositório; sem eles, o grupo pula com aviso.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { converterPlanilha, lerIntervalo, lerPastaXlsx, opcoesSugeridas, planilhaDoIntervalo } from '../../src/aplicacao';
import { estilosDeClasse, planilhaDoHtml } from '../../src/interface/editor/planilha-colada';
import { lerHtmlMinimo } from '../apoio/html-minimo';
import { RAIZ_APP } from './apoio';

const COLAGEM = process.env['BDP_COLAGEM'] ?? '';
const QUADROS = join(process.env['BDP_PLANILHAS'] ?? join(RAIZ_APP, '..', '..'), 'QUADROS.xlsx');
const CASOS = [
  ['colar-q1.html', 'Quadro 1', 'A1:F7'],
  ['colar-q6.html', 'Quadro 6', 'A13:C24'],
] as const;
const tem = COLAGEM !== '' && existsSync(QUADROS) && CASOS.every(([f]) => existsSync(join(COLAGEM, f)));
if (!tem) console.warn('[colagem do Excel] BDP_COLAGEM ou QUADROS.xlsx ausente: grupo pulado.');

/**
 * "HTML Format" do Windows: cabeçalho com StartHTML/EndHTML antes do HTML, em UTF-8. A captura pelo .NET
 * (`Clipboard.GetData`) devolve os bytes lidos como Windows-1252; o Electron decodifica direito. Aqui se desfaz a troca.
 */
const htmlDoClipboard = (bruto: string) => {
  const cp1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const bytes = Uint8Array.from([...bruto].map((ch) => {
    const k = cp1252.indexOf(ch);
    return k >= 0 ? 0x80 + k : ch.charCodeAt(0) & 0xff;
  }));
  const utf8 = /Ã./.test(bruto) ? new TextDecoder('utf-8').decode(bytes) : bruto;
  return utf8.slice(Math.max(0, utf8.indexOf('<html')));
};

describe.skipIf(!tem)('colagem do Excel real × importação do arquivo', () => {
  const r = tem ? lerPastaXlsx(new Uint8Array(readFileSync(QUADROS))) : null;
  for (const [arquivo, aba, intervalo] of CASOS) {
    it(`${aba} ${intervalo}: mesmos textos, mesclagens e alinhamentos`, () => {
      if (!r?.ok) throw new Error('planilha ilegível');
      const html = htmlDoClipboard(readFileSync(join(COLAGEM, arquivo), 'utf8'));
      const colada = planilhaDoHtml(lerHtmlMinimo(html), estilosDeClasse(html))!;
      const daAba = planilhaDoIntervalo(r.pasta.abas.find((a) => a.nome === aba)!, lerIntervalo(intervalo)!, { retirarColunasVazias: false, retirarLinhasVazias: false }).lida;
      const conv = (l: typeof colada) => converterPlanilha(l, 'quadro', { ...opcoesSugeridas(l), linhasCabecalho: 1 });
      const grade = (l: typeof colada) => conv(l).grade.map((linha) => linha.map((c) => (c ? [c.campo.texto, c.colunas, c.linhas] : null)));
      expect(grade(colada)).toEqual(grade(daAba));
      expect(conv(colada).alinhamentos).toEqual(conv(daAba).alinhamentos);
    });
  }
});
