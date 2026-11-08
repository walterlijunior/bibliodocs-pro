import { describe, expect, it } from 'vitest';
import { criarTrabalhoDoTipo, SessaoTrabalho, type CadastrosDocumento } from '../src/aplicacao';
import { empacotarProjeto, lerProjeto } from '../src/persistencia';

function sessao() {
  let id = 0;
  const p = criarTrabalhoDoTipo({ id: 'prj_catalogos01', agora: new Date(0).toISOString(), appVersao: '0.1.0', tipo: 'monografia', novoId: (p) => `${p}_${String(++id).padStart(16, '0')}` });
  const s = new SessaoTrabalho({ api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} }, agora: () => new Date(0), agendar: () => () => {} });
  s.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote: { ...p, midias: [] }, avisos: [], atualizacao: null } as never);
  return s;
}
const dados: CadastrosDocumento = {
  siglas: [{ id: 'cad_sigla0001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' }],
  simbolos: [{ id: 'cad_simbolo01', simbolo: 'α', significado: 'Alfa' }],
  glossario: [{ id: 'cad_termo001', termo: 'Pequi', definicao: 'Fruto do pequizeiro.' }],
};

describe('M6: cadastros pela sessão', () => {
  it('valida, salva e reabre todos os cadastros sem alterar o texto', () => {
    const s = sessao(); const corpo = s.pacote!.documento.corpo;
    expect(s.atualizarCadastros(dados).ok).toBe(true);
    expect(s.pacote!.documento.corpo).toBe(corpo);
    expect(s.obterEstado().trabalho!.cadastros).toEqual(dados);
    const p = s.pacote!;
    const bytes = empacotarProjeto({ ...p, midias: new Map() });
    if (!bytes.ok) throw new Error(JSON.stringify(bytes.erros));
    const lido = lerProjeto(bytes.bytes);
    if (!lido.ok) throw new Error(JSON.stringify(lido.erros));
    expect(lido.pacote.documento).toMatchObject(dados);
    expect(s.obterEstado().trabalho!.salvamento.tipo).toBe('naoSalvo');
  });
  it('incluir, alterar e excluir participam do histórico junto com o texto', () => {
    const s = sessao();
    s.atualizarCadastros(dados);
    s.atualizarCadastros({ ...dados, siglas: [{ ...dados.siglas![0]!, extenso: 'Outro nome' }] });
    s.desfazer(() => false);
    expect(s.obterEstado().trabalho!.cadastros).toEqual(dados);
    s.desfazer(() => false);
    expect(s.obterEstado().trabalho!.cadastros).toEqual({});
    s.refazer(() => false);
    expect(s.obterEstado().trabalho!.cadastros).toEqual(dados);
    s.atualizarCadastros({});
    s.desfazer(() => false);
    expect(s.obterEstado().trabalho!.cadastros).toEqual(dados);
  });
  it('campo vazio, lista vazia, id repetido ou extra não alteram documento nem histórico', () => {
    const s = sessao(); const antes = s.pacote!.documento;
    for (const c of [
      { siglas: [] },
      { siglas: [{ ...dados.siglas![0]!, extenso: '' }] },
      { siglas: [dados.siglas![0]!], simbolos: [{ ...dados.simbolos![0]!, id: dados.siglas![0]!.id }] },
      { siglas: [{ ...dados.siglas![0]!, extra: 'x' }] },
    ]) expect(s.atualizarCadastros(c as CadastrosDocumento).ok).toBe(false);
    expect(s.pacote!.documento).toBe(antes);
    expect(s.desfazer(() => false).ok).toBe(false);
  });
});
