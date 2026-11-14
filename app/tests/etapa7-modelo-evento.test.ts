// Etapa 7 da especificação de atualização — modelos de congressos e eventos em DOCX: leitura do modelo (página,
// margens, fonte, texto, títulos, seções, instruções e o que não se reproduz), perfil derivado, aplicação sem mexer no
// texto e o aceite: importar, aplicar, exportar e comparar o exportado com o original.
import { AlignmentType, Document, Footer, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { zipSync, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { aspectosDoModelo, compararComExportado, criarTrabalhoVazio, modeloDoArquivo, secoesQueFaltam, SessaoTrabalho, type PacoteTransferivel } from '../src/aplicacao';
import { validarDocumentoV1 } from '../src/dominio/esquemas';
import type { Documento, ModeloEvento, Secao } from '../src/dominio/modelo';
import { formatar, perfilComModelo } from '../src/dominio/normas';
import { exportarDocx } from '../src/exportacao/docx';
import { lerModeloDocx } from '../src/importacao';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const AGORA = new Date('2026-11-14T12:00:00.000Z');

/** Modelo de evento sintético: A4, margens de 2,5 cm, Arial 11, simples, justificado sem recuo, títulos em negrito. */
async function modeloDeEvento(opcoes: { colunas?: number; rodape?: boolean } = {}): Promise<Uint8Array> {
  const d = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 240 }, alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 0 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, allCaps: true, size: 24 }, paragraph: { alignment: AlignmentType.LEFT } },
        { id: 'Heading2', name: 'heading 2', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 22 }, paragraph: { alignment: AlignmentType.LEFT } },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } }, ...(opcoes.colunas ? { column: { count: opcoes.colunas, space: 708 } } : {}) },
        ...(opcoes.rodape ? { footers: { default: new Footer({ children: [new Paragraph('Anais do Congresso')] }) } } : {}),
        children: [
          new Paragraph({ text: 'TÍTULO DO TRABALHO' }),
          new Paragraph({ children: [new TextRun('O texto deve ter de 8 a 12 páginas, em fonte Arial 11, margens de 2,5 cm e espaçamento simples.')] }),
          new Paragraph({ text: '1 INTRODUÇÃO', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Texto de exemplo.' }),
          new Paragraph({ text: '2 METODOLOGIA', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: '2.1 Coleta', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '3 CONSIDERAÇÕES FINAIS', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'REFERÊNCIAS', heading: HeadingLevel.HEADING_1 }),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(d));
}

function abrir(documento: Partial<Documento>) {
  const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' });
  const pacote: PacoteTransferivel = { ...base, documento: { ...base.documento, ...documento }, midias: [] };
  let n = 0;
  const s = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, cancelado: true }) as never, fechar: async () => {} },
    agora: () => AGORA,
    agendar: () => () => {},
    gerarIdSecao: () => `sec_et7teste${String(++n).padStart(5, '0')}`,
  });
  s.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote, avisos: [], atualizacao: null });
  return s;
}

const sec = (id: string, titulo: string, texto: string): Secao => ({ id, titulo: [t(titulo)], blocos: [{ tipo: 'paragrafo', id: `par_${id.slice(4)}`, conteudo: [t(texto)] }], subsecoes: [] });

describe('leitura do modelo DOCX', () => {
  it('reconhece página, margens, fonte, corpo, entrelinha, alinhamento, recuo, títulos, seções e instruções', async () => {
    const r = lerModeloDocx(await modeloDeEvento());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.modelo.regras).toMatchObject({
      larguraMm: 210,
      alturaMm: 297,
      margemSuperiorCm: 2.5,
      margemInferiorCm: 2.5,
      margemEsquerdaCm: 2.5,
      margemDireitaCm: 2.5,
      fonte: 'Arial',
      corpoPt: 11,
      entrelinha: 'simples',
      alinhamento: 'justificado',
      recuoPrimeiraLinhaCm: 0,
      titulo1: { corpoPt: 12, negrito: true, maiusculas: true, alinhamento: 'esquerda', quebraPagina: false },
      titulo2: { corpoPt: 11, negrito: true, maiusculas: false },
    });
    expect(r.modelo.secoes).toEqual([
      { nivel: 1, titulo: '1 INTRODUÇÃO' },
      { nivel: 1, titulo: '2 METODOLOGIA' },
      { nivel: 2, titulo: '2.1 Coleta' },
      { nivel: 1, titulo: '3 CONSIDERAÇÕES FINAIS' },
      { nivel: 1, titulo: 'REFERÊNCIAS' },
    ]);
    expect(r.modelo.instrucoes).toEqual(['O texto deve ter de 8 a 12 páginas, em fonte Arial 11, margens de 2,5 cm e espaçamento simples.']);
    expect(r.modelo.avisos).toEqual([]);
  });

  it('o que não se reproduz vira aviso: colunas e rodapé do modelo', async () => {
    const r = lerModeloDocx(await modeloDeEvento({ colunas: 2, rodape: true }));
    expect(r.ok && r.modelo.avisos.join(' ')).toMatch(/2 colunas.*Cabeçalho e rodapé/s);
  });

  it('recusa o que não é DOCX e o DOCX cujo conteúdo é grande demais', () => {
    expect(lerModeloDocx(new Uint8Array([1, 2, 3]))).toMatchObject({ ok: false });
    expect(lerModeloDocx(zipSync({ 'a.txt': new Uint8Array([1]) }))).toMatchObject({ ok: false, mensagem: expect.stringContaining('Word') });
    const enorme = zipSync({ 'word/document.xml': new Uint8Array(16 * 1024 * 1024) }, { level: 9 });
    expect(lerModeloDocx(enorme)).toMatchObject({ ok: false, mensagem: expect.stringContaining('grande demais') });
  });
});

describe('modelo no trabalho', () => {
  it('o modelo do arquivo passa no formato; a tabela mostra reconhecido, corrigido e o que vale do Manual', async () => {
    const r = modeloDoArquivo('Modelo SBPC 2026.docx', await modeloDeEvento(), AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.modelo.nome).toBe('Modelo SBPC 2026');
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento;
    expect(validarDocumentoV1({ ...base, modelo: r.modelo }).ok).toBe(true);
    const { recuoPrimeiraLinhaCm: _r, ...semRecuo } = r.modelo.regras;
    const corrigido: ModeloEvento = { ...r.modelo, regras: { ...semRecuo, corpoPt: 12 } };
    const linhas = new Map(aspectosDoModelo(corrigido, PERFIL).map((l) => [l.chave, l]));
    expect(linhas.get('margemSuperiorCm')).toMatchObject({ noModelo: '2,5 cm', noTrabalho: '2,5 cm', situacao: 'reconhecido' });
    expect(linhas.get('corpoPt')).toMatchObject({ noModelo: '11 pt', noTrabalho: '12 pt', situacao: 'corrigido' });
    expect(linhas.get('recuoPrimeiraLinhaCm')).toMatchObject({ noModelo: '0 cm', noTrabalho: '1,25 cm', situacao: 'perfil' });
  });

  it('o perfil derivado só acrescenta regras MOD-* e troca a fonte; sem modelo, é o mesmo perfil', async () => {
    const r = modeloDoArquivo('m.docx', await modeloDeEvento(), AGORA);
    if (!r.ok) throw new Error(r.mensagem);
    expect(perfilComModelo(PERFIL, undefined)).toBe(PERFIL);
    const p = perfilComModelo(PERFIL, r.modelo);
    expect(p.regras.slice(0, PERFIL.regras.length)).toEqual(PERFIL.regras);
    expect(p.regras.slice(PERFIL.regras.length).map((x) => x.id)).toEqual(['MOD-PAGINA', 'MOD-DOCUMENTO', 'MOD-CORPO', 'MOD-TITULO1', 'MOD-TITULO2', 'MOD-TITULO3']);
    expect(p.parametros['fonte']).toMatchObject({ valor: 'Arial', opcoes: ['Arial'] });
  });

  it('seções que faltam: compara sem número, acento nem maiúsculas e ignora REFERÊNCIAS', async () => {
    const r = modeloDoArquivo('m.docx', await modeloDeEvento(), AGORA);
    if (!r.ok) throw new Error(r.mensagem);
    expect(secoesQueFaltam(r.modelo, [sec('sec_et7000000001', 'Introducao', 'x')])).toEqual(['METODOLOGIA', 'CONSIDERAÇÕES FINAIS']);
  });
});

describe('aceite da Etapa 7', () => {
  it('importa o modelo, aplica sem mudar o texto, exporta e o exportado confere com o original em margens, estilos e seções', async () => {
    const corpo = [sec('sec_et7000000001', 'Introdução', 'Texto do autor.')];
    const s = abrir({ tipoTrabalho: 'artigo-tcc', corpo });
    const antes = s.pacote!.documento.corpo;
    const r = modeloDoArquivo('Modelo do evento.docx', await modeloDeEvento(), AGORA);
    if (!r.ok) throw new Error(r.mensagem);
    expect(s.aplicarModelo(r.modelo).ok).toBe(true);
    // O texto do autor não mudou.
    expect(s.pacote!.documento.corpo).toBe(antes);
    // Seções do modelo criadas vazias, no fim; as do autor ficam.
    expect(s.secoesQueFaltamDoModelo()).toEqual(['METODOLOGIA', 'CONSIDERAÇÕES FINAIS']);
    expect(s.criarSecoesDoModelo()).toBe(2);
    const doc = s.pacote!.documento;
    expect(doc.corpo.map((x) => x.titulo.map((i) => i.texto).join(''))).toEqual(['Introdução', 'METODOLOGIA', 'CONSIDERAÇÕES FINAIS']);
    expect(doc.corpo[0]).toBe(antes[0]);

    // Exporta com o perfil derivado (como faz o principal) e compara com o modelo original.
    const exportado = await exportarDocx(formatar(doc, perfilComModelo(PERFIL, doc.modelo)));
    const lido = lerModeloDocx(exportado);
    if (!lido.ok) throw new Error(lido.mensagem);
    const diferencas = compararComExportado(doc.modelo!, lido.modelo);
    // O recuo 0 do modelo e o título 2 (que o trabalho não tem) saem iguais; o que difere é só o que o motor não
    // reproduz: nada, neste modelo.
    expect(diferencas).toEqual([]);

    // Sem o modelo, as diferenças aparecem (margens e fonte do Manual da UFT).
    const semModelo = lerModeloDocx(await exportarDocx(formatar(doc, PERFIL)));
    if (!semModelo.ok) throw new Error(semModelo.mensagem);
    const aspectos = compararComExportado(doc.modelo!, semModelo.modelo).map((d) => d.aspecto);
    expect(aspectos).toEqual(expect.arrayContaining(['Margem superior', 'Margem esquerda', 'Fonte', 'Tamanho do texto', 'Entrelinha do texto']));
  });

  it('voltar ao perfil tira o modelo; o histórico guarda o estado de antes de aplicar', async () => {
    const s = abrir({ tipoTrabalho: 'artigo-tcc', corpo: [sec('sec_et7000000001', 'Introdução', 'Texto.')] });
    const r = modeloDoArquivo('m.docx', await modeloDeEvento(), AGORA);
    if (!r.ok) throw new Error(r.mensagem);
    s.aplicarModelo(r.modelo);
    expect(s.obterEstado().trabalho!.modelo?.nome).toBe('m');
    expect(s.aplicarModelo(null).ok).toBe(true);
    expect(s.pacote!.documento.modelo).toBeUndefined();
    expect(s.pontosDoHistorico().map((p) => p.descricao)).toEqual(['Antes de voltar ao perfil da UFT', 'Trabalho aberto (antes de aplicar o modelo “m”)']);
  });

  it('o DOCX exportado guarda o modelo só no .bdp: o arquivo exportado não leva o nome do modelo', async () => {
    const r = modeloDoArquivo('Modelo secreto.docx', await modeloDeEvento(), AGORA);
    if (!r.ok) throw new Error(r.mensagem);
    const base = criarTrabalhoVazio({ id: 'prj_abcdefghijklmnop', agora: '2026-11-14T10:00:00.000Z', appVersao: '0.1.0' }).documento;
    const doc = { ...base, tipoTrabalho: 'artigo-tcc' as const, corpo: [sec('sec_et7000000001', 'Introdução', 'Texto.')], modelo: r.modelo };
    const partes = unzipSync(await exportarDocx(formatar(doc, perfilComModelo(PERFIL, doc.modelo))));
    expect(Object.values(partes).some((b) => new TextDecoder().decode(b).includes('Modelo secreto'))).toBe(false);
  });
});
