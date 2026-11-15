// Etapa 5 da especificação de atualização — tipos de obra novos (relatório, demonstrações financeiras, base de dados;
// D-E5-05, provisórios), referência colada (texto preservado e usado como veio; conversão em campos com incertezas;
// D-E5-06) e o formato v1. Os exemplos seguem a forma das referências do relato de experiência, com dados genéricos.
import { describe, expect, it } from 'vitest';
import { aplicarReferenciaLida, lerReferenciaColada, obraVazia, validarObra } from '../src/aplicacao';
import { dataDeAcesso, formatarReferencia } from '../src/dominio/bibliografia';
import type { Obra } from '../src/dominio/modelo';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const texto = (o: Obra) => formatarReferencia(o).trechos.map((x) => x.texto).join('').trim();
const negrito = (o: Obra) => formatarReferencia(o).trechos.filter((x) => x.marcas?.includes('negrito')).map((x) => x.texto).join('');

describe('tipos de obra novos', () => {
  it('demonstrações financeiras: entidade, título, período, imprenta e acesso; aviso de padrão provisório', () => {
    const o: Obra = {
      id: 'obr_e5000000001',
      tipo: 'demonstracaoFinanceira',
      autores: [{ tipo: 'entidade', nome: 'EMPRESA EXEMPLO S.A.' }],
      titulo: t('Demonstrações financeiras individuais e consolidadas'),
      periodo: 'Exercícios findos em 2023 e 2024',
      local: 'São Paulo',
      editora: 'Empresa Exemplo',
      ano: 2025,
      url: 'https://ri.exemplo.com.br/central-de-resultados/',
      acesso: '2026-09-26',
    };
    expect(validarObra(o).ok).toBe(true);
    expect(texto(o)).toBe(
      'EMPRESA EXEMPLO S.A. Demonstrações financeiras individuais e consolidadas. Exercícios findos em 2023 e 2024. São Paulo: Empresa Exemplo, 2025. Disponível em: https://ri.exemplo.com.br/central-de-resultados/. Acesso em: 26 set. 2026.',
    );
    expect(negrito(o)).toBe('Demonstrações financeiras individuais e consolidadas');
    expect(formatarReferencia(o).avisos.map((a) => a.codigo)).toContain('PADRAO_PROVISORIO');
    expect(formatarReferencia({ ...o, periodo: undefined }).avisos.map((a) => a.mensagem).join(' ')).toMatch(/período/);
  });

  it('relatório de RI e base de dados; a página de RI continua como página web', () => {
    const rel: Obra = { id: 'obr_e5000000002', tipo: 'relatorio', autores: [{ tipo: 'entidade', nome: 'EMPRESA EXEMPLO S.A.' }], titulo: t('Relatório de sustentabilidade'), periodo: '2024', local: 'São Paulo', editora: 'Empresa Exemplo', ano: 2025 };
    expect(texto(rel)).toBe('EMPRESA EXEMPLO S.A. Relatório de sustentabilidade. 2024. São Paulo: Empresa Exemplo, 2025.');
    const base: Obra = { id: 'obr_e5000000003', tipo: 'baseDados', autores: [{ tipo: 'entidade', nome: 'PROVEDOR' }], titulo: t('Base de dados de demonstrações financeiras'), subtitulo: t('companhias abertas'), local: 'São Paulo', editora: 'Provedor', ano: 2026, url: 'https://provedor.exemplo/plataforma', acesso: '2026-09-27' };
    expect(texto(base)).toBe('PROVEDOR. Base de dados de demonstrações financeiras: companhias abertas. São Paulo: Provedor, 2026. Disponível em: https://provedor.exemplo/plataforma. Acesso em: 27 set. 2026.');
    const pagina: Obra = { id: 'obr_e5000000004', tipo: 'documentoOnline', autores: [{ tipo: 'entidade', nome: 'EMPRESA EXEMPLO S.A.' }], titulo: t('ESG'), local: 'São Paulo', editora: 'Empresa Exemplo', ano: 2026, url: 'https://ri.exemplo.com.br/esg/', acesso: '2026-09-26' };
    expect(texto(pagina)).toBe('EMPRESA EXEMPLO S.A. ESG. São Paulo: Empresa Exemplo, 2026. Disponível em: https://ri.exemplo.com.br/esg/. Acesso em: 26 set. 2026.');
  });

  it('obras diferentes da mesma entidade no mesmo ano recebem a, b na ordem da lista (D-M4-03)', async () => {
    const { sufixosDeAno } = await import('../src/dominio/bibliografia');
    const ent = [{ tipo: 'entidade' as const, nome: 'EMPRESA EXEMPLO S.A.' }];
    const a: Obra = { id: 'obr_e5000000005', tipo: 'demonstracaoFinanceira', autores: ent, titulo: t('Demonstrações financeiras'), ano: 2026 };
    const b: Obra = { id: 'obr_e5000000006', tipo: 'documentoOnline', autores: ent, titulo: t('ESG'), ano: 2026 };
    expect([...sufixosDeAno([a, b]).entries()]).toEqual([
      [a.id, 'a'],
      [b.id, 'b'],
    ]);
  });
});

describe('referência colada', () => {
  it('data de acesso no padrão do Manual', () => {
    expect(dataDeAcesso('27 set. 2026')).toBe('2026-09-27');
    expect(dataDeAcesso('3 maio 2024')).toBe('2024-05-03');
    expect(dataDeAcesso('31 xyz 2024')).toBeNull();
  });

  it('artigo com iniciais: autoria, título, periódico, local, volume, número, páginas, ano, endereço e acesso', () => {
    const r = lerReferenciaColada('SOUZA, M. A.; LIMA, V. C. Os motores do greenwashing. Revista de Gestão, Berkeley, v. 54, n. 1, p. 64-87, 2011. Disponível em: https://exemplo.org/artigo.pdf. Acesso em: 27 set. 2026.');
    expect(r.tipo).toBe('artigoPeriodico');
    expect(r.campos).toMatchObject({
      autores: [
        { tipo: 'pessoa', sobrenome: 'SOUZA', prenomes: 'M. A.' },
        { tipo: 'pessoa', sobrenome: 'LIMA', prenomes: 'V. C.' },
      ],
      titulo: t('Os motores do greenwashing'),
      periodico: 'Revista de Gestão',
      local: 'Berkeley',
      volume: '54',
      numero: '1',
      paginas: '64-87',
      ano: 2011,
      url: 'https://exemplo.org/artigo.pdf',
      acesso: '2026-09-27',
    });
    expect(r.faltando).toEqual([]);
  });

  it('livro com subtítulo e edição; demonstrações e resolução de entidade; o que não se lê fica marcado', () => {
    const livro = lerReferenciaColada('PEREIRA, S. de. Contabilidade gerencial: da teoria à prática. 7. ed. São Paulo: Atlas, 2020.');
    expect(livro.tipo).toBe('livro');
    expect(livro.campos).toMatchObject({ autores: [{ sobrenome: 'PEREIRA', prenomes: 'S. de' }], titulo: t('Contabilidade gerencial'), subtitulo: t('da teoria à prática'), edicao: 7, local: 'São Paulo', editora: 'Atlas', ano: 2020 });
    expect(livro.incertos.map((x) => x.campo)).toContain('tipo');

    const dem = lerReferenciaColada('EMPRESA EXEMPLO S.A. Demonstrações financeiras individuais e consolidadas: exercícios findos em 2024 e 2025. São Paulo: Empresa Exemplo, 2026a. Disponível em: https://ri.exemplo.com.br/x/. Acesso em: 26 set. 2026.');
    expect(dem.tipo).toBe('demonstracaoFinanceira');
    expect(dem.campos).toMatchObject({ autores: [{ tipo: 'entidade', nome: 'EMPRESA EXEMPLO S.A' }], titulo: t('Demonstrações financeiras individuais e consolidadas'), local: 'São Paulo', editora: 'Empresa Exemplo', ano: 2026 });

    const res = lerReferenciaColada('COMISSÃO EXEMPLO DE VALORES (CEV). Resolução CEV nº 244, de 29 de maio de 2026. Altera a Resolução CEV nº 193. Rio de Janeiro: CEV, 2026.');
    expect(res.tipo).toBe('legislacao');
    expect(res.campos).toMatchObject({ autores: [{ tipo: 'entidade', nome: 'COMISSÃO EXEMPLO DE VALORES (CEV)' }], ementa: 'Altera a Resolução CEV nº 193', ano: 2026 });

    const solto = lerReferenciaColada('um texto qualquer sem ano');
    expect(solto.faltando).toContain('ano');
    expect(solto.incertos.map((x) => x.campo)).toContain('autores');
  });

  it('preencher só os campos vazios; o texto colado fica; usar o texto colado na lista', () => {
    const colado = 'SOUZA, M. A. Os motores do greenwashing. Revista de Gestão, Berkeley, v. 54, n. 1, p. 64-87, 2011.';
    const base = { ...obraVazia('obr_e5000000010', 'livro'), titulo: t('Título que eu conferi') };
    const r = aplicarReferenciaLida(base, lerReferenciaColada(colado), colado);
    expect(r.obra.tipo).toBe('artigoPeriodico');
    expect(r.obra.titulo).toEqual(t('Título que eu conferi'));
    expect(r.mantidos).toEqual(['titulo']);
    expect(r.preenchidos).toEqual(expect.arrayContaining(['autores', 'periodico', 'volume', 'ano']));
    expect(r.obra.referenciaLivre).toBe(colado);
    const v = validarObra({ ...r.obra, usarReferenciaLivre: true });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(texto(v.obra)).toBe(colado);
    expect(formatarReferencia(v.obra).avisos.map((a) => a.codigo)).toEqual(['REFERENCIA_COLADA']);
    // Sem o texto, a marca não fica (forma única).
    const sem = validarObra({ ...v.obra, referenciaLivre: '   ' });
    expect(sem.ok && sem.obra.usarReferenciaLivre).toBeFalsy();
  });
});

describe('IA opcional na bibliografia (D-E5-07)', () => {
  it('o pedido leva só o material do autor; a resposta vira a mesma prévia, com fontes e incertezas', async () => {
    const { pedidoSugerirObra, lerObraSugerida } = await import('../src/aplicacao');
    const p = pedidoSugerirObra('EMPRESA EXEMPLO S.A. Relatório anual 2024. https://ri.exemplo.com.br/relatorio.pdf');
    expect(p.mensagens.at(-1)!.texto).toContain('EMPRESA EXEMPLO S.A. Relatório anual 2024.');
    const r = lerObraSugerida(
      'Aqui está: {"tipo":"relatorio","campos":{"autores":[{"tipo":"entidade","nome":"EMPRESA EXEMPLO S.A."}],"titulo":"Relatório anual","periodo":"2024","ano":2025,"url":"https://ri.exemplo.com.br/relatorio.pdf","acesso":"ontem"},"fontes":{"titulo":"Relatório anual 2024","periodo":"2024"},"incertos":[{"campo":"ano","motivo":"o ano de publicação não aparece"}]}',
    )!;
    expect(r.tipo).toBe('relatorio');
    expect(r.campos).toEqual({ autores: [{ tipo: 'entidade', nome: 'EMPRESA EXEMPLO S.A.' }], titulo: t('Relatório anual'), periodo: '2024', ano: 2025, url: 'https://ri.exemplo.com.br/relatorio.pdf' });
    expect(r.fontes).toEqual({ titulo: 'Relatório anual 2024', periodo: '2024' });
    // Acesso inválido não entra; o que veio sem fonte ou marcado pela IA fica para conferir.
    expect(r.faltando).toEqual(['data de acesso']);
    expect(r.incertos.map((x) => x.campo)).toEqual(expect.arrayContaining(['tipo', 'ano', 'autores', 'url']));
    expect(r.incertos.map((x) => x.campo)).not.toContain('titulo');
    // O que o autor já conferiu fica.
    const base = { ...obraVazia('obr_e5000000020', 'livro'), titulo: t('Relatório anual'), ano: 2024 };
    const aplicada = aplicarReferenciaLida(base, r, 'EMPRESA EXEMPLO S.A. Relatório anual 2024.');
    expect(aplicada.obra.ano).toBe(2024);
    expect(aplicada.mantidos).toEqual(['ano']);
    expect(lerObraSugerida('sem json')).toBeNull();
    expect(lerObraSugerida('{"tipo":"inventado","campos":{}}')!.tipo).toBe('documentoOnline');
  });
});
