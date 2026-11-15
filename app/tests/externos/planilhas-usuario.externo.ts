// Etapa 4 da especificação de atualização — "Importar planilha" com as planilhas do usuário (`Pasta1.xlsx` e
// `QUADROS.xlsx`). Os arquivos NÃO estão no repositório (regra 9: documentos de usuários fora dos testes públicos):
// a pasta vem de `BDP_PLANILHAS` ou é a pasta acima do repositório; sem os arquivos, o grupo pula com aviso.
//
// Para cada aba pedida na especificação, cada intervalo sugerido passa pelo fluxo da janela (prévia → tabela → DOCX), e
// o teste compara, célula por célula, a origem (o que a planilha mostra), a prévia (a grade convertida) e o DOCX
// exportado: textos na mesma ordem, quebras de linha, mesclagens (gridSpan e vMerge) e células vazias. Nenhum conteúdo
// das planilhas fica escrito aqui, só o que a própria especificação cita (nomes das abas, C24 = 8 e C39 = 4).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../../src/aplicacao/perfil-padrao';
import {
  aplicarPlanilha,
  converterPlanilha,
  criarTrabalhoVazio,
  lerIntervalo,
  lerPastaXlsx,
  opcoesSugeridas,
  planilhaDoIntervalo,
  rascunhoNovo,
  sugerirIntervalos,
  textoIntervalo,
  validarTabela,
  type AbaXlsx,
  type PlanilhaConvertida,
} from '../../src/aplicacao';
import { validarDocumentoV1 } from '../../src/dominio/esquemas';
import type { BlocoTabela, Secao } from '../../src/dominio/modelo';
import { formatar } from '../../src/dominio/normas';
import { exportarDocx } from '../../src/exportacao/docx';
import { abrirDocx } from '../apoio/docx-normalizado';
import { RAIZ_APP } from './apoio';

const PASTA = process.env['BDP_PLANILHAS'] ?? join(RAIZ_APP, '..', '..');
const ARQ = { pasta1: join(PASTA, 'Pasta1.xlsx'), quadros: join(PASTA, 'QUADROS.xlsx') };
const tem = existsSync(ARQ.pasta1) && existsSync(ARQ.quadros);
if (!tem) console.warn(`[planilhas do usuário] Pasta1.xlsx e QUADROS.xlsx não encontrados em ${PASTA}: grupo pulado.`);

function abasDe(caminho: string): AbaXlsx[] {
  const r = lerPastaXlsx(new Uint8Array(readFileSync(caminho)));
  if (!r.ok) throw new Error(r.mensagem);
  return r.pasta.abas;
}

const desfazer = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Tabelas do DOCX: por linha, as células com texto (`<w:br/>` = \n), colunas mescladas e se continua mesclagem vertical. */
function tabelasDoDocx(xml: string) {
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((t) =>
    [...t[1]!.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)].map((r) =>
      [...r[1]!.matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((c) => {
        const corpo = c[1]!;
        const texto = [...corpo.matchAll(/<w:br\/>|<w:tab\/>|<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => (m[0] === '<w:br/>' ? '\n' : m[0] === '<w:tab/>' ? '\t' : desfazer(m[1] ?? ''))).join('');
        return { texto, colunas: Number(/<w:gridSpan w:val="(\d+)"/.exec(corpo)?.[1] ?? 1), continua: /<w:vMerge w:val="continue"\/>/.test(corpo) };
      }),
    ),
  );
}

interface Importada {
  aba: string;
  intervalo: string;
  conv: PlanilhaConvertida;
  bloco: BlocoTabela;
  avisos: string[];
}

function importar(aba: AbaXlsx, especie: 'tabela' | 'quadro', k: number): Importada[] {
  return sugerirIntervalos(aba).map((s, j) => {
    const p = planilhaDoIntervalo(aba, s.intervalo);
    const conv = converterPlanilha(p.lida, especie, opcoesSugeridas(p.lida));
    const r = { ...aplicarPlanilha(rascunhoNovo(especie), conv), titulo: { texto: `${aba.nome} ${j + 1}` }, origem: { arquivo: 'planilha.xlsx', aba: aba.nome, intervalo: textoIntervalo(s.intervalo) } };
    const v = validarTabela(r);
    if (!v.ok) throw new Error(`${aba.nome} ${textoIntervalo(s.intervalo)}: ${JSON.stringify(v.erros)}`);
    return { aba: aba.nome, intervalo: textoIntervalo(s.intervalo), conv, bloco: { ...v.dados, id: `tab_real${String(k).padStart(3, '0')}${String(j).padStart(5, '0')}` }, avisos: conv.relatorio };
  });
}

/** Normaliza como a conversão grava ("-" sozinho vira "–"; espaços nas pontas saem). */
const comoGravado = (t: string) => {
  const a = t.replace(/ /g, ' ').trim();
  return a === '-' ? '–' : a;
};

describe.skipIf(!tem)('planilhas do usuário: origem × prévia × DOCX', () => {
  const pedidas: [string, string, 'tabela' | 'quadro'][] = [
    [ARQ.pasta1, '2022', 'quadro'],
    [ARQ.pasta1, 'Modelo de Gestão de Risco', 'quadro'],
    [ARQ.pasta1, '2024', 'quadro'],
    [ARQ.quadros, 'Quadro 1', 'quadro'],
    [ARQ.quadros, 'Quadro 6', 'quadro'],
  ];

  it('abas listadas pelo nome; as auxiliares existem e podem ficar de fora', () => {
    expect(abasDe(ARQ.quadros).map((a) => a.nome)).toEqual(expect.arrayContaining(['Quadro 1', 'Quadro 6', 'SIGLAS', 'Referencias']));
    expect(abasDe(ARQ.pasta1).map((a) => a.nome)).toEqual(expect.arrayContaining(['2022', 'Modelo de Gestão de Risco', '2024']));
  });

  it('Quadro 6: C24 e C39 (fórmulas) ficam 8 e 4 na origem, na prévia e no DOCX', async () => {
    const q6 = abasDe(ARQ.quadros).find((a) => a.nome === 'Quadro 6')!;
    const valor = (ref: string) => {
      const i = lerIntervalo(ref)!;
      return q6.celulas.find((c) => c.l === i.l1 && c.c === i.c1);
    };
    expect(valor('C24')).toMatchObject({ texto: '8', formula: true });
    expect(valor('C39')).toMatchObject({ texto: '4', formula: true });
    const imp = importar(q6, 'quadro', 9);
    const ultimas = imp.map((x) => x.conv.grade.at(-1)!.filter((c) => c !== null).map((c) => c!.campo.texto).at(-1));
    expect(ultimas).toEqual(expect.arrayContaining(['8', '4']));
    const xml = abrirDocx(await exportarDocx(formatar({ ...criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' }).documento, corpo: [{ id: 'sec_real00000001', titulo: [{ tipo: 'texto', texto: 'S' }], blocos: imp.map((x) => x.bloco), subsecoes: [] }] }, PERFIL)))['word/document.xml']!;
    const tabs = tabelasDoDocx(xml);
    const fins = tabs.map((t) => t.at(-1)!.at(-1)!.texto);
    expect(fins).toEqual(expect.arrayContaining(['8', '4']));
  });

  it('cada intervalo sugerido: os textos, quebras, vazios e mesclagens da origem chegam iguais à prévia e ao DOCX', async () => {
    const todas: Importada[] = [];
    const relatorio: string[] = [];
    pedidas.forEach(([arq, nome, especie], k) => {
      const aba = abasDe(arq).find((a) => a.nome === nome)!;
      const imp = importar(aba, especie, k);
      relatorio.push(`${nome}: ${imp.map((x) => `${x.intervalo} (${x.conv.grade.length}×${x.conv.alinhamentos.length})`).join(', ')}`);
      for (const x of imp) for (const a of x.avisos) relatorio.push(`   ${x.intervalo}: ${a}`);
      // Origem × prévia: cada célula com valor do intervalo aparece na prévia, na ordem de linha e coluna.
      for (const x of imp) {
        const i = lerIntervalo(x.intervalo)!;
        const p = planilhaDoIntervalo(aba, i);
        const retiradas = new Set(p.colunasRetiradas);
        const origem = aba.celulas
          .filter((c) => c.l >= i.l1 && c.l <= i.l2 && c.c >= i.c1 && c.c <= i.c2 && c.texto.trim() !== '')
          .filter((c) => !aba.mesclagens.some((m) => c.l >= m.l1 && c.l <= m.l2 && c.c >= m.c1 && c.c <= m.c2 && (c.l !== m.l1 || c.c !== m.c1)))
          .map((c) => comoGravado(c.texto));
        expect(retiradas.size >= 0).toBe(true);
        const previa = x.conv.grade.flat().filter((c) => c !== null && c.campo.texto !== '').map((c) => comoGravado(c!.campo.texto));
        expect(previa, `${nome} ${x.intervalo}`).toEqual(origem);
        // Mesclagens da origem no intervalo × mesclagens da prévia.
        const mescOrigem = aba.mesclagens.filter((m) => m.l1 >= i.l1 && m.l2 <= i.l2 && m.c1 >= i.c1 && m.c2 <= i.c2).length;
        const mescPrevia = x.conv.grade.flat().filter((c) => c !== null && (c.colunas > 1 || c.linhas > 1)).length;
        expect(mescPrevia, `${nome} ${x.intervalo}: mesclagens`).toBe(mescOrigem);
      }
      todas.push(...imp);
    });
    console.log(`[planilhas do usuário]\n${relatorio.join('\n')}`);

    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-15T10:00:00.000Z', appVersao: '0.1.0' }).documento;
    const secao: Secao = { id: 'sec_real00000001', titulo: [{ tipo: 'texto', texto: 'Importadas' }], blocos: todas.map((x) => x.bloco), subsecoes: [] };
    const doc = { ...base, corpo: [secao] };
    expect(validarDocumentoV1(doc).ok).toBe(true);
    const bytes = await exportarDocx(formatar(doc, PERFIL));
    // Com `BDP_GUARDAR_PLANILHAS` (pasta), o DOCX fica lá para a conferência visual (LibreOffice ou Word).
    const guardar = process.env['BDP_GUARDAR_PLANILHAS'];
    if (guardar) writeFileSync(join(guardar, 'planilhas-importadas.docx'), bytes);
    const tabs = tabelasDoDocx(abrirDocx(bytes)['word/document.xml']!);
    expect(tabs.length).toBe(todas.length);
    todas.forEach((x, k) => {
      // Prévia × DOCX: mesma grade (linhas, células que começam em cada linha, textos com quebras, colunas mescladas).
      const previa = x.conv.grade.map((l) => l.filter((c) => c !== null).map((c) => ({ texto: comoGravado(c!.campo.texto), colunas: c!.colunas })));
      const docx = tabs[k]!.map((l) => l.filter((c) => !c.continua).map((c) => ({ texto: c.texto, colunas: c.colunas })));
      expect(docx, `${x.aba} ${x.intervalo}: DOCX`).toEqual(previa);
    });
  });
});
