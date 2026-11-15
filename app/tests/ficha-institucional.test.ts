// Etapa 3 da especificação de atualização — ficha institucional, contribuições e importação. Critério de aceite: uma
// ficha preenchida (uma instituição, dois câmpus, cursos distintos, uma disciplina, um docente e um manual) é exportada
// e importada em outra biblioteca com os vínculos corretos; reimportar não cria duplicatas; vínculo ambíguo e valor
// conflitante esperam a revisão antes de gravar.
import { describe, expect, it } from 'vitest';
import {
  CATALOGO_INICIAL,
  contarRegistros,
  cursosDisponiveis,
  dadosInstitucionais,
  docentesDisponiveis,
  disciplinasDisponiveis,
  campiDisponiveis,
  fichaDoCatalogo,
  fichaModelo,
  importarFicha,
  lerFicha,
  modeloDoPerfil,
  NOVO_REGISTRO,
  perfisAplicaveis,
  textoDaFicha,
  type Catalogo,
  type FichaInstitucional,
} from '../src/aplicacao';
import { validarCatalogo, type FichaValidada } from '../src/dominio/esquemas';

type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const tiposBatem: Igual<FichaInstitucional, FichaValidada> = true;

const FONTE = { url: 'https://www.exemplo.edu.br/cursos', consultadoEm: '2026-11-14' };
const VAZIO: Catalogo = { formato: 'bibliodocs-catalogo', versao: 1, instituicoes: [] };

/** A ficha de teste do roteiro "Como verificar". */
function fichaDeTeste(): FichaInstitucional {
  return {
    formato: 'bibliodocs-ficha-institucional',
    versao: 1,
    instituicao: { nome: 'Universidade Federal de Teste', sigla: 'UFTE' },
    fontes: { instituicao: { url: 'https://www.exemplo.edu.br', consultadoEm: '2026-11-14' }, campi: FONTE, cursos: FONTE, disciplinas: FONTE, docentes: FONTE },
    campi: [
      { chave: 'norte', nome: 'Campus Norte', especie: 'campus', cidade: 'Araguaína', uf: 'TO' },
      { chave: 'sul', nome: 'Campus Sul', especie: 'campus', cidade: 'Gurupi', uf: 'TO' },
    ],
    cursos: [
      // Um curso em dois câmpus (mais de um vínculo) e outro só no Sul.
      { chave: 'historia', nome: 'História', nivel: 'graduacao', grau: 'licenciatura', campi: ['norte', 'sul'] },
      { chave: 'agronomia', nome: 'Agronomia', nivel: 'graduacao', grau: 'bacharelado', campi: ['sul'] },
    ],
    disciplinas: [{ chave: 'metodologia', nome: 'Metodologia Científica', cursos: ['historia'] }],
    docentes: [{ chave: 'ana', nome: 'Ana Souza', titulacao: 'Dra.', cursos: ['historia', 'agronomia'] }],
    manuais: [{ chave: 'manual', titulo: 'Manual de Trabalhos Acadêmicos', url: 'https://www.exemplo.edu.br/manual.pdf', edicao: '2. ed.', data: '2024', fonte: FONTE }],
    perfis: [{ chave: 'perfil-tcc', nome: 'TCC da UFTE', manual: 'manual', secao: 'Seção 3.2', regras: { margemSuperiorCm: 2.5, fonte: 'Arial' }, instrucoes: ['Use fonte Arial.'], cursos: ['agronomia'], tipos: ['monografia'] }],
  };
}

const instDe = (c: Catalogo, sigla: string) => c.instituicoes.find((i) => i.sigla === sigla)!;

describe('Ficha institucional: formato', () => {
  it('a ficha de teste é válida e o tipo do domínio bate com o do esquema', () => {
    expect(tiposBatem).toBe(true);
    const r = lerFicha(textoDaFicha(fichaDeTeste()));
    expect(r.ok).toBe(true);
  });

  it('recusa o que não é ficha e diz onde está o problema', () => {
    expect(lerFicha('não é json')).toMatchObject({ ok: false });
    expect(lerFicha('{"formato":"outro"}')).toMatchObject({ ok: false });
    const f = fichaDeTeste() as unknown as { campi: { uf: string }[] };
    f.campi[0]!.uf = 'tocantins';
    const r = lerFicha(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toContain('campi › 0 › uf');
    const dup = fichaDeTeste();
    dup.campi[1]!.chave = 'norte';
    expect(lerFicha(JSON.stringify(dup))).toMatchObject({ ok: false, mensagem: expect.stringContaining('chave repetida') });
  });

  it('aceita o arquivo com BOM e campos marcados como desconhecidos', () => {
    const f = fichaDeTeste();
    const { cidade: _c, uf: _u, ...sem } = f.campi[0]!;
    f.campi[0] = { ...sem, desconhecidos: ['cidade', 'uf'] };
    expect(lerFicha(`﻿${JSON.stringify(f)}`).ok).toBe(true);
  });
});

describe('Ficha institucional: exportar de uma biblioteca e importar em outra', () => {
  // Biblioteca A: a ficha é preenchida e importada; depois exportada como arquivo.
  const a = importarFicha(CATALOGO_INICIAL, fichaDeTeste());
  const exportada = lerFicha(textoDaFicha(fichaDoCatalogo(a.catalogo, a.instituicao!, new Date('2026-11-14T12:00:00Z'))!));

  it('a prévia mostra o que entra e os vínculos que serão criados', () => {
    const p = importarFicha(VAZIO, fichaDeTeste()).previa;
    expect(p.aguardaRevisao).toBe(false);
    expect(p.semMudancas).toBe(false);
    expect(p.itens.filter((i) => i.acao === 'incluir').map((i) => `${i.nivel}: ${i.rotulo}`)).toEqual([
      'instituicao: Universidade Federal de Teste (UFTE)',
      'campus: Câmpus Campus Norte',
      'campus: Câmpus Campus Sul',
      'curso: História (graduação) em Campus Norte',
      'curso: História (graduação) em Campus Sul',
      'curso: Agronomia (graduação) em Campus Sul',
      'disciplina: Metodologia Científica em História (Campus Norte)',
      'disciplina: Metodologia Científica em História (Campus Sul)',
      'docente: Dra. Ana Souza em História (Campus Norte)',
      'docente: Dra. Ana Souza em História (Campus Sul)',
      'docente: Dra. Ana Souza em Agronomia (Campus Sul)',
      'manual: Manual de Trabalhos Acadêmicos (2. ed.)',
      'perfil: TCC da UFTE',
    ]);
    expect(p.vinculosNovos).toContainEqual({ de: 'Agronomia (graduação)', para: 'Câmpus Campus Sul' });
    expect(p.vinculosNovos).toContainEqual({ de: 'Dra. Ana Souza', para: 'Agronomia (Campus Sul)' });
    expect(p.conflitos).toEqual([]);
    // Só o logotipo falta (não foi informado nem marcado como desconhecido).
    expect(p.faltantes).toEqual([{ rotulo: 'Universidade Federal de Teste (UFTE)', campo: 'logotipo', desconhecido: false }]);
  });

  it('a ficha exportada é importada em outra biblioteca com os vínculos corretos', () => {
    expect(exportada.ok).toBe(true);
    if (!exportada.ok) return;
    // Dois câmpus, dois cursos (História agrupada nos dois câmpus), uma disciplina, um docente, um manual, um perfil.
    expect(exportada.ficha.campi).toHaveLength(2);
    expect(exportada.ficha.cursos.map((u) => [u.nome, u.campi.length])).toEqual([
      ['História', 2],
      ['Agronomia', 1],
    ]);
    expect(exportada.ficha.disciplinas).toHaveLength(1);
    expect(exportada.ficha.docentes).toHaveLength(1);
    expect(exportada.ficha.docentes[0]!.cursos).toHaveLength(2);

    // Biblioteca B: catálogo inicial do aplicativo, sem nada da UFTE.
    const b = importarFicha(CATALOGO_INICIAL, exportada.ficha);
    expect(b.previa.aguardaRevisao).toBe(false);
    expect(validarCatalogo(b.catalogo).ok).toBe(true);
    const inst = instDe(b.catalogo, 'UFTE');
    expect(contarRegistros(inst)).toEqual({ campi: 2, cursos: 3, disciplinas: 2, docentes: 3, manuais: 1, perfis: 1 });

    // Filtros: a instituição mostra só os câmpus dela; o câmpus, só os cursos dele; o curso, as disciplinas e docentes.
    const s = { instituicao: inst.id };
    expect(campiDisponiveis(b.catalogo, s).map((k) => k.nome)).toEqual(['Campus Norte', 'Campus Sul']);
    const [norte, sul] = inst.campi;
    expect(cursosDisponiveis(b.catalogo, { ...s, campus: norte!.id }).map((u) => u.nome)).toEqual(['História']);
    expect(cursosDisponiveis(b.catalogo, { ...s, campus: sul!.id }).map((u) => u.nome)).toEqual(['História', 'Agronomia']);
    const agro = sul!.cursos.find((u) => u.nome === 'Agronomia')!;
    expect(disciplinasDisponiveis(b.catalogo, { ...s, campus: sul!.id, curso: agro.id })).toEqual([]);
    expect(docentesDisponiveis(b.catalogo, { ...s, campus: sul!.id, curso: agro.id }).map((d) => `${d.titulacao} ${d.nome}`)).toEqual(['Dra. Ana Souza']);
    const histNorte = norte!.cursos[0]!;
    expect(disciplinasDisponiveis(b.catalogo, { ...s, campus: norte!.id, curso: histNorte.id }).map((d) => d.nome)).toEqual(['Metodologia Científica']);

    // Dados institucionais no trabalho, com local e natureza.
    expect(dadosInstitucionais(b.catalogo, { ...s, campus: sul!.id, curso: agro.id, orientador: agro.docentes[0]!.id }, 'monografia')).toMatchObject({
      instituicao: 'Universidade Federal de Teste',
      local: 'Gurupi, TO',
      curso: 'Curso de Graduação em Agronomia',
      orientador: { nome: 'Ana Souza', titulacao: 'Dra.' },
    });

    // O perfil vale para Agronomia e monografia; chega sem revisão; vira o modelo do trabalho com a fonte.
    expect(perfisAplicaveis(inst, agro.id, 'monografia').map((p) => p.nome)).toEqual(['TCC da UFTE']);
    expect(perfisAplicaveis(inst, histNorte.id, 'monografia')).toEqual([]);
    expect(perfisAplicaveis(inst, agro.id, 'tese')).toEqual([]);
    const perfil = inst.perfisInstitucionais![0]!;
    expect(perfil.revisado).toBe(false);
    expect(perfil.manual).toBe(inst.manuais![0]!.id);
    const modelo = modeloDoPerfil(perfil, inst, new Date('2026-11-14T12:00:00Z'));
    expect(modelo.regras).toEqual({ margemSuperiorCm: 2.5, fonte: 'Arial' });
    expect(modelo.instrucoes![0]).toBe('Fonte: Manual de Trabalhos Acadêmicos, 2. ed., Seção 3.2 (https://www.exemplo.edu.br/manual.pdf).');
  });

  it('reimportar a mesma ficha não cria duplicatas e preserva os vínculos', () => {
    if (!exportada.ok) throw new Error('ficha');
    const b1 = importarFicha(CATALOGO_INICIAL, exportada.ficha).catalogo;
    const r = importarFicha(b1, exportada.ficha);
    expect(r.previa.semMudancas).toBe(true);
    expect(r.previa.itens.every((i) => i.acao === 'sem-mudanca')).toBe(true);
    expect(r.previa.vinculosNovos).toEqual([]);
    expect(r.previa.conflitos).toEqual([]);
    expect(r.catalogo).toEqual(b1);
    expect(r.catalogo.instituicoes.filter((i) => i.sigla === 'UFTE')).toHaveLength(1);
    // E a ficha original (com outras chaves) também casa com o que foi importado.
    expect(importarFicha(b1, fichaDeTeste()).previa.semMudancas).toBe(true);
  });

  it('reimportar depois de uma revisão do perfil mantém a revisão', () => {
    if (!exportada.ok) throw new Error('ficha');
    const b1 = importarFicha(VAZIO, exportada.ficha).catalogo;
    const inst = b1.instituicoes[0]!;
    const revisado: Catalogo = { ...b1, instituicoes: [{ ...inst, perfisInstitucionais: inst.perfisInstitucionais!.map((p) => ({ ...p, revisado: true })) }] };
    expect(importarFicha(revisado, exportada.ficha).catalogo.instituicoes[0]!.perfisInstitucionais![0]!.revisado).toBe(true);
  });

  it('a ficha da UFT sai dos dados iniciais com fonte e volta sem duplicar', () => {
    const uft = fichaDoCatalogo(CATALOGO_INICIAL, 'uft')!;
    expect(uft.campi.length).toBeGreaterThan(0);
    expect(uft.cursos.every((u) => u.fonte !== undefined)).toBe(true);
    const r = importarFicha(CATALOGO_INICIAL, uft);
    expect(r.previa.semMudancas).toBe(true);
    expect(r.catalogo).toBe(CATALOGO_INICIAL);
  });
});

describe('Ficha institucional: revisão antes de gravar', () => {
  it('valor editado pelo usuário é preservado até ele confirmar a substituição', () => {
    const b1 = importarFicha(VAZIO, fichaDeTeste()).catalogo;
    // O usuário corrigiu a cidade do Campus Sul.
    const inst = b1.instituicoes[0]!;
    const editado: Catalogo = { ...b1, instituicoes: [{ ...inst, campi: inst.campi.map((k) => (k.nome === 'Campus Sul' ? { ...k, cidade: 'Gurupi (sede)', origem: 'usuario' as const } : k)) }] };
    const r = importarFicha(editado, fichaDeTeste());
    expect(r.previa.conflitos).toEqual([{ id: 'campus:sul:cidade', rotulo: 'Câmpus Campus Sul', campo: 'cidade', noCatalogo: 'Gurupi (sede)', naFicha: 'Gurupi', substituir: false }]);
    expect(r.previa.semMudancas).toBe(true);
    expect(r.catalogo.instituicoes[0]!.campi[1]!.cidade).toBe('Gurupi (sede)');
    const confirmado = importarFicha(editado, fichaDeTeste(), { substituir: ['campus:sul:cidade'] });
    expect(confirmado.previa.conflitos[0]!.substituir).toBe(true);
    expect(confirmado.catalogo.instituicoes[0]!.campi[1]!.cidade).toBe('Gurupi');
    expect(contarRegistros(confirmado.catalogo.instituicoes[0]!)).toEqual(contarRegistros(inst));
  });

  it('campo vazio no catálogo é preenchido pela ficha sem conflito', () => {
    const b1 = importarFicha(VAZIO, fichaDeTeste()).catalogo;
    const inst = b1.instituicoes[0]!;
    const semUf: Catalogo = { ...b1, instituicoes: [{ ...inst, campi: inst.campi.map(({ uf: _u, ...k }) => k) }] };
    const r = importarFicha(semUf, fichaDeTeste());
    expect(r.previa.conflitos).toEqual([]);
    expect(r.catalogo.instituicoes[0]!.campi.map((k) => k.uf)).toEqual(['TO', 'TO']);
  });

  it('vínculo ambíguo espera a escolha; a escolha liga ao registro certo', () => {
    const b1 = importarFicha(VAZIO, fichaDeTeste()).catalogo;
    const inst = b1.instituicoes[0]!;
    // Dois câmpus com o mesmo nome no catálogo: qual é o "Campus Sul" da ficha?
    const outro = { ...inst.campi[1]!, id: `${inst.campi[1]!.id}-b`, cidade: 'Formoso', cursos: [] };
    const ambiguo: Catalogo = { ...b1, instituicoes: [{ ...inst, campi: [...inst.campi, outro] }] };
    const r = importarFicha(ambiguo, fichaDeTeste());
    expect(r.previa.aguardaRevisao).toBe(true);
    const p = r.previa.pendencias.find((x) => x.id === 'campus:sul')!;
    expect(p.tipo).toBe('ambigua');
    expect(p.opcoes!.map((o) => o.rotulo)).toEqual(['Campus Sul (Gurupi)', 'Campus Sul (Formoso)', 'Incluir como registro novo']);
    // Os cursos do Sul ficam pendentes até a escolha.
    expect(r.previa.pendencias.some((x) => x.id === 'curso:agronomia:espera:sul')).toBe(true);
    const escolhido = importarFicha(ambiguo, fichaDeTeste(), { escolhas: { 'campus:sul': inst.campi[1]!.id } });
    expect(escolhido.previa.aguardaRevisao).toBe(false);
    expect(escolhido.previa.semMudancas).toBe(true);
    // Escolher "novo" cria um terceiro câmpus com os cursos dele.
    const novo = importarFicha(ambiguo, fichaDeTeste(), { escolhas: { 'campus:sul': NOVO_REGISTRO } });
    expect(novo.catalogo.instituicoes[0]!.campi).toHaveLength(4);
  });

  it('instituição ambígua: nada é gravado até a escolha', () => {
    const b1 = importarFicha(VAZIO, fichaDeTeste()).catalogo;
    const copia = { ...b1.instituicoes[0]!, id: 'outra', nome: 'Universidade Federal de Teste' , sigla: 'UFT-E2' };
    const amb: Catalogo = { ...b1, instituicoes: [...b1.instituicoes, copia] };
    const r = importarFicha(amb, fichaDeTeste());
    expect(r.instituicao).toBeNull();
    expect(r.previa.aguardaRevisao).toBe(true);
    expect(r.catalogo).toBe(amb);
  });

  it('relação incompleta vira pendência e o registro não entra', () => {
    const f = fichaDeTeste();
    f.cursos.push({ chave: 'solto', nome: 'Física', nivel: 'graduacao', campi: [] });
    f.docentes.push({ chave: 'beto', nome: 'Beto Lima', cursos: ['inexistente'] });
    const r = importarFicha(VAZIO, f);
    expect(r.previa.aguardaRevisao).toBe(false);
    expect(r.previa.pendencias.map((p) => p.id)).toEqual(['curso:solto:sem-campus', 'docente:beto:curso:inexistente']);
    expect(r.catalogo.instituicoes[0]!.campi.flatMap((k) => k.cursos).some((u) => u.nome === 'Física')).toBe(false);
    // Faltantes: o grau da Física e a titulação do Beto.
    expect(r.previa.faltantes).toContainEqual({ rotulo: 'Física (graduação)', campo: 'grau', desconhecido: false });
    expect(r.previa.faltantes).toContainEqual({ rotulo: 'Beto Lima', campo: 'titulação', desconhecido: false });
  });

  it('nomes que diferem só em acento ou caixa casam (sem duplicata)', () => {
    const b1 = importarFicha(VAZIO, fichaDeTeste()).catalogo;
    const f = fichaDeTeste();
    f.cursos[0]!.nome = 'HISTORIA';
    f.docentes[0]!.nome = 'ana  souza';
    const r = importarFicha(b1, f);
    expect(contarRegistros(r.catalogo.instituicoes[0]!)).toEqual(contarRegistros(b1.instituicoes[0]!));
    expect(r.previa.vinculosNovos).toEqual([]);
  });

  it('o perfil vira o modelo do trabalho com o nome da instituição', () => {
    const b = importarFicha(VAZIO, fichaDeTeste()).catalogo.instituicoes[0]!;
    const modelo = modeloDoPerfil(b.perfisInstitucionais![0]!, b, new Date('2026-11-14T12:00:00Z'));
    expect(modelo.nome).toBe('TCC da UFTE (UFTE)');
    expect(modelo.reconhecidas).toEqual(modelo.regras);
  });
});

describe('Ficha institucional: modelo de preenchimento', () => {
  it('o modelo é uma ficha válida, que importa sem pendências e com o perfil por revisar', () => {
    const lida = lerFicha(textoDaFicha(fichaModelo()));
    expect(lida.ok).toBe(true);
    const r = importarFicha(VAZIO, fichaModelo());
    expect(r.previa.aguardaRevisao).toBe(false);
    expect(r.previa.pendencias).toEqual([]);
    const inst = r.catalogo.instituicoes[0]!;
    expect(contarRegistros(inst)).toMatchObject({ campi: 2, manuais: 1, perfis: 1 });
    expect(inst.perfisInstitucionais![0]!.revisado).toBe(false);
    expect(validarCatalogo(r.catalogo).ok).toBe(true);
  });
});
