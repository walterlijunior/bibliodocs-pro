// M4-T04 (RF-08): formatadores dos tipos da primeira leva além do livro (D-M4-06). Cada caso é um exemplo do Manual
// UFT, 5.19, com a página. Elementos sem campo no modelo ficam fora do esperado e estão anotados no caso: dois
// eventos juntos (ZUBEN) e "In: VADE mecum", deixados para a segunda leva (decisão do usuário, 2026-11-07).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatarReferencia, type ReferenciaFormatada } from '../src/dominio/bibliografia';
import type { Autor, Documento, InlineDeTitulo, Obra } from '../src/dominio/modelo';

const t = (texto: string): InlineDeTitulo[] => [{ tipo: 'texto', texto }];
const p = (sobrenome: string, prenomes?: string): Autor => ({ tipo: 'pessoa', sobrenome, ...(prenomes ? { prenomes } : {}) });
const e = (nome: string): Autor => ({ tipo: 'entidade', nome });
let seq = 0;
const obra = (campos: Partial<Obra> & Pick<Obra, 'tipo' | 'titulo'>): Obra => ({ id: `obr_tp${String(++seq).padStart(6, '0')}`, ...campos });

/** Texto com o destaque marcado: **negrito**, _itálico_. */
function marcado(ref: ReferenciaFormatada): string {
  return ref.trechos
    .map((x) => {
      let s = x.texto;
      if (x.marcas.includes('italico')) s = `_${s}_`;
      if (x.marcas.includes('negrito')) s = `**${s}**`;
      return s;
    })
    .join('')
    .replace(/\*\*\*\*/gu, '');
}

const casos: [string, Obra, string][] = [
  // Capítulo e verbete
  [
    'p. 52, capítulo com autoria própria (RN-200, RN-188)',
    obra({ tipo: 'capitulo', autores: [p('Coomonte', 'Antônio Vara')], titulo: t('Condições socioestruturais da escola'), noTodo: { autores: [p('Ferreira', 'Naura Syria Carapeto')], funcao: 'org', titulo: t('Supervisão educacional para uma escola de qualidade'), subtitulo: t('da formação à ação') }, local: 'São Paulo', editora: 'Cortez', ano: 1999, paginas: '39-68' }),
    'COOMONTE, Antônio Vara. Condições socioestruturais da escola. _In_: FERREIRA, Naura Syria Carapeto (org.). **Supervisão educacional para uma escola de qualidade**: da formação à ação. São Paulo: Cortez, 1999. p. 39-68.',
  ],
  [
    'p. 52, capítulo sem autoria especial, com "Cap. 2" (RN-201)',
    obra({ tipo: 'capitulo', autores: [p('Cagliari', 'Luiz Carlos')], titulo: t('A linguística e o ensino de português'), noTodo: { autores: [p('Cagliari', 'Luiz Carlos')], titulo: t('Alfabetização & Linguística') }, edicao: 10, local: 'São Paulo', editora: 'Scipione', ano: 2003, paginas: 'Cap. 2' }),
    'CAGLIARI, Luiz Carlos. A linguística e o ensino de português. _In_: CAGLIARI, Luiz Carlos. **Alfabetização & Linguística**. 10. ed. São Paulo: Scipione, 2003. Cap. 2.',
  ],
  [
    'p. 52, verbete com autor (RN-202)',
    obra({ tipo: 'capitulo', autores: [p('Ferreira', 'Aurélio Buarque de Holanda')], titulo: t('Babaçu'), noTodo: { autores: [p('Ferreira', 'Aurélio Buarque de Holanda')], titulo: t('Novo Aurélio Século XXI'), subtitulo: t('dicionário da língua portuguesa') }, edicao: 3, local: 'Rio de Janeiro', editora: 'Nova Fronteira', ano: 1999, paginas: '248' }),
    'FERREIRA, Aurélio Buarque de Holanda. Babaçu. _In_: FERREIRA, Aurélio Buarque de Holanda. **Novo Aurélio Século XXI**: dicionário da língua portuguesa. 3. ed. Rio de Janeiro: Nova Fronteira, 1999. p. 248.',
  ],
  [
    'p. 52, verbete sem autoria, on-line (RN-203)',
    obra({ tipo: 'capitulo', titulo: t('Política'), noTodo: { titulo: t('Dicionário da língua portuguesa') }, local: 'Lisboa', editora: 'Priberam Informática', ano: 1998, url: 'http://www.priberam.pt/dlDLPO', acesso: '1999-03-08' }),
    'POLÍTICA. _In_: DICIONÁRIO da língua portuguesa. Lisboa: Priberam Informática, 1998. Disponível em: http://www.priberam.pt/dlDLPO. Acesso em: 8 mar. 1999.',
  ],
  // Trabalho acadêmico
  [
    'p. 53, dissertação: Universidade, Programa (RN-206, C-B15)',
    obra({ tipo: 'trabalhoAcademico', autores: [p('Pereira Júnior', 'Nilo Marinho')], titulo: t('A biblioteca universitária professor Severino Francisco e suas ações de incentivo à leitura na UFT'), ano: 2019, natureza: 'Dissertação (Mestrado em Letras: ensino de Língua e Literatura)', instituicao: 'Universidade Federal do Tocantins', programa: 'Programa de Pós-Graduação em Letras: ensino de Língua e Literatura', local: 'Araguaína', url: 'http://hdl.handle.net/11612/1724', acesso: '2020-08-12' }),
    'PEREIRA JÚNIOR, Nilo Marinho. **A biblioteca universitária professor Severino Francisco e suas ações de incentivo à leitura na UFT**. 2019. Dissertação (Mestrado em Letras: ensino de Língua e Literatura) – Universidade Federal do Tocantins, Programa de Pós-Graduação em Letras: ensino de Língua e Literatura, Araguaína, 2019. Disponível em: http://hdl.handle.net/11612/1724. Acesso em: 12 ago. 2020.',
  ],
  [
    'p. 70, dissertação com folhas, "222 f." (D-M4-05)',
    obra({ tipo: 'trabalhoAcademico', autores: [p('Nascimento', 'Núbia Nogueira do')], titulo: t('Turismo cultural e a patrimonialização do Polígono de Tombamento do Centro Histórico de Porto Nacional-TO'), ano: 2014, folhas: 222, natureza: 'Dissertação (Mestrado em Geografia)', instituicao: 'Universidade Federal do Tocantins', local: 'Porto Nacional', url: 'http://repositorio.uft.edu.br/handle/11612/412', acesso: '2020-09-01' }),
    'NASCIMENTO, Núbia Nogueira do. **Turismo cultural e a patrimonialização do Polígono de Tombamento do Centro Histórico de Porto Nacional-TO**. 2014. 222 f. Dissertação (Mestrado em Geografia) – Universidade Federal do Tocantins, Porto Nacional, 2014. Disponível em: http://repositorio.uft.edu.br/handle/11612/412. Acesso em: 1 set. 2020.',
  ],
  // Artigo de periódico
  [
    'p. 56, mais de três autores com et al., DOI e on-line (RN-212, RN-214)',
    obra({ tipo: 'artigoPeriodico', autores: [p('Dantas', 'José Alves'), p('B', 'B.'), p('C', 'C.'), p('D', 'D.')], titulo: t('Regulação da auditoria em sistemas bancários'), subtitulo: t('análise do cenário internacional e fatores determinantes'), periodico: 'Revista Contabilidade & Finanças', local: 'São Paulo', volume: '25', numero: '64', paginas: '7-18', dataPublicacao: 'jan./abr. 2014', doi: 'http://dx.doi.org/10.1590/S1519-70772014000100002', url: 'https://www.scielo.br/scielo.php?pid=S1519-70772014000100002&script=sci_arttext&tlng=pt', acesso: '2014-05-20' }),
    'DANTAS, José Alves _et al._ Regulação da auditoria em sistemas bancários: análise do cenário internacional e fatores determinantes. **Revista Contabilidade & Finanças**, São Paulo, v. 25, n. 64, p. 7-18, jan./abr. 2014. DOI: http://dx.doi.org/10.1590/S1519-70772014000100002. Disponível em: https://www.scielo.br/scielo.php?pid=S1519-70772014000100002&script=sci_arttext&tlng=pt. Acesso em: 20 maio 2014.',
  ],
  [
    'p. 56, DOREA com os três primeiros autores (o exemplo tem seis) e o suplemento (RN-212)',
    obra({ tipo: 'artigoPeriodico', autores: [p('Dorea', 'R. D.'), p('Costa', 'J. N.'), p('Batita', 'J. M.')], titulo: t('Reticuloperitonite traumática associada à esplenite e hepatite em bovino'), subtitulo: t('relato de caso'), periodico: 'Veterinária e Zootecnia', local: 'São Paulo', volume: '18', numero: '4', paginas: '199-202', ano: 2011, suplemento: '3' }),
    'DOREA, R. D.; COSTA, J. N.; BATITA, J. M. Reticuloperitonite traumática associada à esplenite e hepatite em bovino: relato de caso. **Veterinária e Zootecnia**, São Paulo, v. 18, n. 4, p. 199-202, 2011. Supl. 3.',
  ],
  [
    'p. 56, sem autoria (RN-213)',
    obra({ tipo: 'artigoPeriodico', titulo: t('Muito por fazer'), periodico: 'Educação', local: 'São Paulo', volume: '29', numero: '236', paginas: '30-31', dataPublicacao: 'dez. 2000' }),
    'MUITO por fazer. **Educação**, São Paulo, v. 29, n. 236, p. 30-31, dez. 2000.',
  ],
  [
    'p. 56, on-line sem local (RN-214)',
    obra({ tipo: 'artigoPeriodico', autores: [p('Porto Junior', 'Francisco Gilson Rebouças'), p('Oliveira', 'Edson de Sousa')], titulo: t('Memória e acesso livre aos periódicos científicos'), subtitulo: t('a Revista Observatório e as possibilidades de preservação da informação'), periodico: 'Revista Observatório', volume: '2', numero: '2', paginas: '403-425', dataPublicacao: '30 maio 2016', url: 'https://sistemas.uft.edu.br/periodicos/index.php/observatorio/article/view/2114', acesso: '2020-08-27' }),
    'PORTO JUNIOR, Francisco Gilson Rebouças; OLIVEIRA, Edson de Sousa. Memória e acesso livre aos periódicos científicos: a Revista Observatório e as possibilidades de preservação da informação. **Revista Observatório**, v. 2, n. 2, p. 403-425, 30 maio 2016. Disponível em: https://sistemas.uft.edu.br/periodicos/index.php/observatorio/article/view/2114. Acesso em: 27 ago. 2020.',
  ],
  // Trabalho em evento
  [
    'p. 54, trabalho em anais, um evento (RN-209; o exemplo ZUBEN junta dois eventos)',
    obra({ tipo: 'trabalhoEvento', autores: [p('Zuben', 'A. V.'), p('Casanova', 'C.'), p('Baldini', 'M. B. D.')], titulo: t('Vigilância epidemiológica da leishmaniose visceral americana (LVA) em cães no município de Campinas, São Paulo'), evento: { nome: 'Reunião de Pesquisa Aplicada em Leishmanioses', numero: 14, ano: 2010, local: 'Uberaba' }, local: 'Uberaba', editora: 'Universidade Federal do Triangulo Mineiro', ano: 2010, paginas: '135-175' }),
    'ZUBEN, A. V.; CASANOVA, C.; BALDINI, M. B. D. Vigilância epidemiológica da leishmaniose visceral americana (LVA) em cães no município de Campinas, São Paulo. _In_: REUNIÃO DE PESQUISA APLICADA EM LEISHMANIOSES, 14., 2010, Uberaba. **Anais** [...]. Uberaba: Universidade Federal do Triangulo Mineiro, 2010. p. 135-175.',
  ],
  [
    'p. 54, anais com título próprio e on-line (RN-207: "Anais eletrônicos [...]")',
    obra({ tipo: 'trabalhoEvento', autores: [p('Lima', 'Ana')], titulo: t('Trabalho'), evento: { nome: 'Congresso de Iniciação Científica da UFPE', numero: 4, ano: 1996, local: 'Recife' }, noTodo: { titulo: t('Anais eletrônicos') }, local: 'Recife', editora: 'UFPE', url: 'http://www.propesq.ufpe.br/anais/anais.htm', acesso: '1997-01-21' }),
    'LIMA, Ana. Trabalho. _In_: CONGRESSO DE INICIAÇÃO CIENTÍFICA DA UFPE, 4., 1996, Recife. **Anais eletrônicos** [...]. Recife: UFPE, 1996. Disponível em: http://www.propesq.ufpe.br/anais/anais.htm. Acesso em: 21 jan. 1997.',
  ],
  // Jornal
  [
    'p. 57, com autor e seção (RN-215)',
    obra({ tipo: 'artigoJornal', autores: [p('Silva', 'Leila')], titulo: t('Ilha do Marajó'), periodico: 'Folha de São Paulo', local: 'São Paulo', dataPublicacao: '14 abr. 2000', secao: 'Folha Turismo, caderno 8', paginas: '2' }),
    'SILVA, Leila. Ilha do Marajó. **Folha de São Paulo**, São Paulo, 14 abr. 2000. Folha Turismo, caderno 8, p. 2.',
  ],
  [
    'p. 57, com autor, sem seção: página antes da data (RN-216)',
    obra({ tipo: 'artigoJornal', autores: [p('Silva Junior', 'Eliezer')], titulo: t('Desenvolvimento sustentável'), periodico: 'Economia', local: 'Tocantins', paginas: '5', dataPublicacao: '13 set. 2003' }),
    'SILVA JUNIOR, Eliezer. Desenvolvimento sustentável. **Economia**, Tocantins, p. 5, 13 set. 2003.',
  ],
  [
    'p. 57, sem autor (RN-217, como o exemplo: ", p. 17")',
    obra({ tipo: 'artigoJornal', titulo: t('Clima de campanha esquenta'), periodico: 'O Globo', local: 'Rio de Janeiro', dataPublicacao: '5 jun. 2006', secao: '1 caderno', paginas: '17' }),
    'CLIMA de campanha esquenta. **O Globo**, Rio de Janeiro, 5 jun. 2006, 1 caderno, p. 17.',
  ],
  [
    'p. 58, on-line (RN-218; o exemplo grafa "LEITÃO. Miriam" por erro)',
    obra({ tipo: 'artigoJornal', autores: [p('Leitão', 'Miriam')], titulo: t('Cargill no debate do Ethos'), periodico: 'O Globo', local: 'Rio de Janeiro', dataPublicacao: '22 jun. 2006', url: 'http://oglobo.globo.com/online/economia/miriam', acesso: '2006-06-24' }),
    'LEITÃO, Miriam. Cargill no debate do Ethos. **O Globo**, Rio de Janeiro, 22 jun. 2006. Disponível em: http://oglobo.globo.com/online/economia/miriam. Acesso em: 24 jun. 2006.',
  ],
  // Norma
  [
    'p. 59, norma técnica (RN-222)',
    obra({ tipo: 'norma', autores: [e('Associação Brasileira de Normas Técnicas')], identificacao: 'NBR 6023', titulo: t('informação e documentação'), subtitulo: t('Referência: Elaboração'), local: 'Rio de Janeiro', editora: 'ABNT', ano: 2018, paginas: '68' }),
    'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **NBR 6023**: informação e documentação: Referência: Elaboração. Rio de Janeiro: ABNT, 2018. 68 p.',
  ],
  // Legislação
  [
    'p. 59, Constituição como obra autônoma: negrito no título (RN-223, C-B16)',
    obra({ tipo: 'legislacao', jurisdicao: 'Brasil', identificacao: 'Constituição (1988)', titulo: t('Constituição da República Federativa do Brasil'), subtitulo: t('1988'), local: 'Brasília, DF', editora: 'Câmara dos Deputados', ano: 2005, paginas: '437' }),
    'BRASIL. Constituição (1988). **Constituição da República Federativa do Brasil**: 1988. Brasília, DF: Câmara dos Deputados, 2005. 437 p.',
  ],
  [
    'p. 60, lei no Diário Oficial: negrito no veículo (RN-223, C-B16)',
    obra({ tipo: 'legislacao', jurisdicao: 'BRASIL', titulo: t('Lei nº 9.979, de 5 de julho de 2000'), ementa: 'Abre ao Orçamento Fiscal da União, em favor da Justiça Eleitoral, crédito suplementar no valor de R$155.000.000,00, para reforço de dotações consignadas no vigente orçamento.', publicacao: 'Diário Oficial [da] República Federativa do Brasil', secao: 'seção 1', local: 'Brasília, DF', anoVeiculo: '138', numero: '129', paginas: '4', dataPublicacao: '6 jul. 2000' }),
    'BRASIL. Lei nº 9.979, de 5 de julho de 2000. Abre ao Orçamento Fiscal da União, em favor da Justiça Eleitoral, crédito suplementar no valor de R$155.000.000,00, para reforço de dotações consignadas no vigente orçamento. **Diário Oficial [da] República Federativa do Brasil**: seção 1, Brasília, DF, ano 138, n. 129, p. 4, 6 jul. 2000.',
  ],
  [
    'p. 60, Constituição on-line com data não impressa "[2016]" (RN-223, D-M4-05)',
    obra({ tipo: 'legislacao', jurisdicao: 'BRASIL', identificacao: '[Constituição (1988)]', titulo: t('Constituição da República Federativa do Brasil de 1988'), local: 'Brasília, DF', editora: 'Presidência da República', ano: 2016, anoIncerto: 'naoImpresso', url: 'http://www.planalto.gov.br/ccivil_03/Constituicao/Constituiçao.htm', acesso: '2017-01-01' }),
    'BRASIL. [Constituição (1988)]. **Constituição da República Federativa do Brasil de 1988**. Brasília, DF: Presidência da República, [2016]. Disponível em: http://www.planalto.gov.br/ccivil_03/Constituicao/Constituiçao.htm. Acesso em: 1 jan. 2017.',
  ],
];

describe('tipos da primeira leva: exemplos do Manual, 5.19', () => {
  it.each(casos)('%s', (_fonte, o, esperado) => {
    const ref = formatarReferencia(o);
    expect(marcado(ref)).toBe(esperado);
    expect(ref.avisos).toEqual([]);
    for (const x of ref.trechos) expect(x.origem.length).toBeGreaterThan(0);
  });
});

describe('documento on-line (RN-189; padrão provisório, o Manual não tem um próprio)', () => {
  it('só título, endereço e acesso', () => {
    const ref = formatarReferencia(obra({ tipo: 'documentoOnline', titulo: t('Página'), url: 'http://exemplo.org', acesso: '2026-01-31' }));
    expect(marcado(ref)).toBe('PÁGINA. Disponível em: http://exemplo.org. Acesso em: 31 jan. 2026.');
    expect(ref.avisos).toEqual([]);
  });
  it('com autor entidade e ano, sem local nem editora: o ano sozinho, sem "[S. l.]"', () => {
    const ref = formatarReferencia(obra({ tipo: 'documentoOnline', autores: [e('Universidade Federal do Tocantins')], titulo: t('Calendário acadêmico'), ano: 2026, url: 'https://uft.edu.br', acesso: '2026-11-07' }));
    expect(marcado(ref)).toBe('UNIVERSIDADE FEDERAL DO TOCANTINS. **Calendário acadêmico**. 2026. Disponível em: https://uft.edu.br. Acesso em: 7 nov. 2026.');
  });
  it('sem endereço avisa', () => {
    const ref = formatarReferencia(obra({ tipo: 'documentoOnline', titulo: t('Página') }));
    expect(ref.avisos.map((a) => a.codigo)).toEqual(['ELEMENTO_AUSENTE']);
  });
});

describe('o que falta vira aviso, não texto inventado', () => {
  it.each<[string, Obra, string]>([
    ['capítulo sem a obra no todo', obra({ tipo: 'capitulo', titulo: t('Cap'), ano: 2000 }), 'RN-200'],
    ['artigo sem periódico', obra({ tipo: 'artigoPeriodico', titulo: t('Art'), ano: 2000 }), 'RN-212'],
    ['jornal sem jornal', obra({ tipo: 'artigoJornal', titulo: t('Nota'), ano: 2000 }), 'RN-215'],
    ['norma sem número', obra({ tipo: 'norma', autores: [e('ABNT')], titulo: t('Norma'), local: 'L', editora: 'E', ano: 2000 }), 'RN-222'],
    ['legislação sem jurisdição', obra({ tipo: 'legislacao', titulo: t('Lei'), local: 'L', editora: 'E', ano: 2000 }), 'RN-223'],
  ])('%s', (_nome, o, rn) => {
    const ref = formatarReferencia(o);
    expect(ref.avisos.map((a) => [a.codigo, a.rn])).toEqual([['ELEMENTO_AUSENTE', rn]]);
  });

  it('trabalho acadêmico sem natureza e sem instituição avisa as duas', () => {
    const ref = formatarReferencia(obra({ tipo: 'trabalhoAcademico', autores: [p('Lima', 'Ana')], titulo: t('TCC'), ano: 2020, local: 'Palmas' }));
    expect(ref.avisos.map((a) => a.codigo)).toEqual(['ELEMENTO_AUSENTE', 'ELEMENTO_AUSENTE']);
    expect(marcado(ref)).toBe('LIMA, Ana. **TCC**. 2020. Palmas, 2020.');
  });

  it('trabalho em evento sem ano de publicação usa o ano do evento', () => {
    const ref = formatarReferencia(obra({ tipo: 'trabalhoEvento', titulo: t('Trabalho'), evento: { nome: 'Congresso de Exemplo', numero: 1, ano: 2020, local: 'Palmas' } }));
    expect(marcado(ref)).toBe('TRABALHO. _In_: CONGRESSO DE EXEMPLO, 1., 2020, Palmas. **Anais** [...]. [S. l.]: [s. n.], 2020.');
    expect(ref.avisos).toEqual([]);
  });

  it('sufixo a/b também na data do periódico (D-M4-03)', () => {
    const ref = formatarReferencia(obra({ tipo: 'artigoPeriodico', autores: [p('Lima', 'Ana')], titulo: t('A'), periodico: 'Revista', dataPublicacao: 'dez. 2000' }), { sufixoAno: 'a' });
    expect(marcado(ref)).toBe('LIMA, Ana. A. **Revista**, dez. 2000a.');
  });
});

describe('fixture do M4-T01 (uma obra de cada tipo)', () => {
  const doc = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'projeto-v1', 'documento-bordas-m4.json'), 'utf8')) as Documento;
  it.each((doc.obras ?? []).map((o) => [o.tipo, o] as const))('%s formata sem exceção e termina em ponto', (_tipo, o) => {
    const ref = formatarReferencia(o);
    expect(ref.trechos.length).toBeGreaterThan(0);
    expect(ref.trechos.at(-1)!.texto.endsWith('.')).toBe(true);
    expect(ref.trechos.map((x) => x.texto).join('')).not.toMatch(/\s{2}|(?<!\.)\.\.(?!\.)|,\s*\.|\s[.,]/u);
  });
});
