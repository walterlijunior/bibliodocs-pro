// Revisão do M6 (R-M6-03, R-M6-12): pós-textuais pela sessão — incluir, renomear, ordenar, retirar e desfazer — e o
// conteúdo do apêndice que não pode sumir quando o passo estrutural é desfeito sem o passo de texto correspondente.
import { describe, expect, it } from 'vitest';
import { criarTrabalhoDoTipo, SessaoTrabalho } from '../src/aplicacao';

function sessao() {
  let id = 0;
  const p = criarTrabalhoDoTipo({ id: 'prj_postextuais01', agora: new Date(0).toISOString(), appVersao: '0.1.0', tipo: 'monografia', novoId: (x) => `${x}_${String(++id).padStart(16, '0')}` });
  let n = 0;
  const s = new SessaoTrabalho({
    api: { salvar: async () => ({ ok: true, nomeArquivo: 'T.bdp', avisos: [] }), salvarComo: async () => ({ ok: false, motivo: 'CANCELADO' }), fechar: async () => {} },
    agora: () => new Date(0),
    agendar: () => () => {},
    gerarIdElemento: () => `ele_postextual${String(++n).padStart(6, '0')}`,
  } as never);
  s.abrir({ identificador: 'AAAAAAAAAAAAAAAAAAAAAA', nomeArquivo: 'T.bdp', pacote: { ...p, midias: [] }, avisos: [], atualizacao: null } as never);
  return s;
}
const pos = (s: SessaoTrabalho) => s.pacote!.documento.posTextuais ?? [];
const texto = (t: string) => [{ tipo: 'paragrafo' as const, id: 'par_postextual0001', conteudo: [{ tipo: 'texto' as const, texto: t }] }];

describe('pós-textuais pela sessão', () => {
  it('inclui, renomeia, ordena e retira, cada um num passo do desfazer', () => {
    const s = sessao();
    const a = s.incluirPosTextual('apendice')!;
    const b = s.incluirPosTextual('apendice')!;
    expect(s.renomearPosTextual(a, 'Questionário')).toBe(true);
    expect(s.moverPosTextual(b, 'cima')).toBe(true);
    const apendices = () => pos(s).filter((e) => e.tipo === 'apendice').map((e) => [e.id, 'titulo' in e ? e.titulo : undefined]);
    expect(apendices()).toEqual([[b, undefined], [a, 'Questionário']]);
    expect(s.retirarPosTextual(b)).toBe(true);
    expect(apendices()).toEqual([[a, 'Questionário']]);
    s.desfazer(() => false);
    expect(apendices()).toEqual([[b, undefined], [a, 'Questionário']]);
  });

  it('R-M6-03: desfazer o passo estrutural não apaga o texto que continua no apêndice', () => {
    const s = sessao();
    const a = s.incluirPosTextual('apendice')!;
    s.incluirPosTextual('anexo');
    s.alterarSecao(a, { titulo: [], blocos: texto('Texto longo digitado no apêndice.') });
    s.registrarTexto(a);
    // O editor não tem mais o passo de texto (histórico cheio ou estado descartado): o desfazer pula para o estrutural.
    s.desfazer(() => false);
    const apendice = pos(s).find((e) => e.id === a);
    expect(apendice && 'blocos' in apendice ? apendice.blocos : null).toEqual(texto('Texto longo digitado no apêndice.'));
  });
});
