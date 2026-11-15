// Etapa 10 da especificação de atualização — backup e restauração dos cadastros e configurações (D-E10-01): o arquivo
// diz a versão do formato, o que contém e o que não contém; a chave de IA nunca entra; arquivo inválido não grava
// nada; a restauração numa instalação limpa traz instituições, logotipos, campi, perfis e as preferências; numa
// instalação com dados, os conflitos aparecem antes e o usuário escolhe substituir ou só acrescentar.
import { describe, expect, it } from 'vitest';
import { CATALOGO_INICIAL, catalogoRestaurado, criarBackup, idsRetirados, lerBackup, previaRestauracao } from '../src/aplicacao';
import type { Catalogo, Instituicao } from '../src/dominio/catalogo';
import { nomeSeguroBackup } from '../src/principal/ipc/manipuladores-catalogo';

const LOGO = { sha256: 'a'.repeat(64), tipo: 'image/png' as const, dados: 'iVBORw0KGgo=' };
// A instituição de teste copia a forma de uma do catálogo inicial (o esquema confere tudo).
const modelo = CATALOGO_INICIAL.instituicoes[0]!;
const campusModelo = modelo.campi[0]!;
const teste: Instituicao = {
  ...modelo,
  id: 'ins-teste',
  nome: 'Universidade de Teste',
  sigla: 'UT',
  logotipo: LOGO,
  campi: [
    { ...campusModelo, id: 'cam-norte', nome: 'Câmpus Norte', cursos: [] },
    { ...campusModelo, id: 'cam-sul', nome: 'Câmpus Sul', cursos: [] },
  ],
};
const comTeste = (c: Catalogo, inst = teste): Catalogo => ({ ...c, instituicoes: [...c.instituicoes.filter((i) => i.id !== inst.id), inst] });

function backupDe(catalogo: Catalogo): string {
  return criarBackup({
    usuario: { catalogo, removidos: idsRetirados(CATALOGO_INICIAL, catalogo) },
    ia: { ativa: true, provedor: 'openai', url: 'https://api.openai.com/v1', modelo: 'gpt-x', limiteTokensMes: 100000 },
    preferencias: { 'bibliodocs.zoomEditor': '120', 'outra.chave': 'x' },
    appVersao: '0.1.0',
    agora: new Date('2026-11-15T12:00:00Z'),
  });
}

describe('backup de cadastros e configurações', () => {
  it('diz formato, versão, o que contém e o que não contém; sem chave de IA; só preferências do aplicativo', () => {
    const texto = backupDe(comTeste(CATALOGO_INICIAL));
    const j = JSON.parse(texto);
    expect([j.formato, j.versao, j.escopo]).toEqual(['bibliodocs-backup', 1, 'cadastros-e-configuracoes']);
    expect(j.naoInclui.join(' ')).toMatch(/trabalhos.*anexos.*chave/);
    expect(j.resumo.logotipos).toBeGreaterThanOrEqual(1);
    expect(j.resumo.campi).toBeGreaterThanOrEqual(2);
    expect(texto).not.toMatch(/chave"|apiKey|sk-/);
    expect(j.conteudo.preferencias).toEqual({ 'bibliodocs.zoomEditor': '120' });
    expect(lerBackup(texto).ok).toBe(true);
  });

  it('arquivo inválido, de outro formato, de versão desconhecida ou adulterado não passa (nada é gravado)', () => {
    expect(lerBackup('não é json')).toMatchObject({ ok: false, mensagem: expect.stringMatching(/Nada foi alterado/) });
    expect(lerBackup('{"formato":"outro"}')).toMatchObject({ ok: false });
    expect(lerBackup(JSON.stringify({ ...JSON.parse(backupDe(CATALOGO_INICIAL)), versao: 2 }))).toMatchObject({ ok: false, mensagem: expect.stringMatching(/versão/) });
    const j = JSON.parse(backupDe(CATALOGO_INICIAL));
    j.conteudo.catalogo.catalogo.instituicoes[0].campi = 'quebrado';
    expect(lerBackup(JSON.stringify(j)).ok).toBe(false);
  });

  it('instalação limpa: a restauração traz a instituição com logotipo e os dois câmpus', () => {
    const r = lerBackup(backupDe(comTeste(CATALOGO_INICIAL)));
    if (!r.ok) throw new Error(r.mensagem);
    const previa = previaRestauracao(CATALOGO_INICIAL, r.backup);
    expect(previa.novas).toEqual(['Universidade de Teste (UT)']);
    expect(previa.conflitos).toEqual([]);
    const novo = catalogoRestaurado(CATALOGO_INICIAL, CATALOGO_INICIAL, r.backup, 'substituir');
    const ut = novo.instituicoes.find((i) => i.id === 'ins-teste')!;
    expect(ut.logotipo).toEqual(LOGO);
    expect(ut.campi.map((c) => c.nome)).toEqual(['Câmpus Norte', 'Câmpus Sul']);
  });

  it('instalação com dados: conflito mostrado; "acrescentar" mantém o meu valor; "substituir" põe o do backup', () => {
    const r = lerBackup(backupDe(comTeste(CATALOGO_INICIAL)));
    if (!r.ok) throw new Error(r.mensagem);
    const meu = comTeste(CATALOGO_INICIAL, { ...teste, nome: 'Universidade de Teste (corrigida)', campi: [teste.campi[0]!] } as Instituicao);
    const previa = previaRestauracao(meu, r.backup);
    expect(previa.conflitos).toEqual(['Universidade de Teste (UT)']);
    const acrescentado = catalogoRestaurado(CATALOGO_INICIAL, meu, r.backup, 'acrescentar').instituicoes.find((i) => i.id === 'ins-teste')!;
    expect(acrescentado.nome).toBe('Universidade de Teste (corrigida)');
    // O que faltava (câmpus Sul) entra.
    expect(acrescentado.campi.map((c) => c.id)).toEqual(['cam-norte', 'cam-sul']);
    const substituido = catalogoRestaurado(CATALOGO_INICIAL, meu, r.backup, 'substituir').instituicoes.find((i) => i.id === 'ins-teste')!;
    expect(substituido.nome).toBe('Universidade de Teste');
  });

  it('nome do arquivo sugerido na janela de salvar', () => {
    expect(nomeSeguroBackup('BiblioDocsPro-backup-2026-11-15.bdbackup.json')).toBe('BiblioDocsPro-backup-2026-11-15.bdbackup.json');
    expect(nomeSeguroBackup('../x.bdbackup.json')).toBeNull();
    expect(nomeSeguroBackup('x.json')).toBeNull();
  });
});
