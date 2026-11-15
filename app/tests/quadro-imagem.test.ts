// Etapa 4 da especificação de atualização — quadro em imagem (D-E4-09; RN-049: o Manual lista o quadro entre as
// ilustrações). Ilustração da espécie "quadro" e quadro em grade dividem uma sequência só (o motivo da D-M5-11):
// Quadro 1, Quadro 2, na ordem do texto; a remissiva acompanha, e a conformidade o conta como quadro.
import { describe, expect, it } from 'vitest';
import { inventarioConformidade } from '../src/aplicacao';
import type { BlocoIlustracao, BlocoTabela } from '../src/dominio/modelo';
import { numerarElementos } from '../src/dominio/numeracao';
import { alvosDeRemissiva, rotulosDeRemissiva } from '../src/dominio/visuais';

const t = (texto: string) => ({ tipo: 'texto' as const, texto });
const imagem: BlocoIlustracao = { tipo: 'ilustracao', id: 'ilu_qi000000001', especie: 'quadro', titulo: [t('Materialidade')], midia: 'a'.repeat(64), fonte: [t('Relatório Anual 2022, p. 13.')] };
const grade: BlocoTabela = { tipo: 'tabela', id: 'tab_qi000000001', especie: 'quadro', titulo: [t('Critérios')], colunas: [{ alinhamento: 'esquerda' }], linhasCabecalho: 0, linhas: [[{ conteudo: [t('x')] }]] };
const figura: BlocoIlustracao = { ...imagem, id: 'ilu_qi000000002', especie: 'figura', titulo: [t('Foto')] };
const corpo = [{ id: 'sec_qi000000001', titulo: [t('S')], blocos: [imagem, figura, grade], subsecoes: [] }];

describe('quadro em imagem', () => {
  it('numera na sequência dos quadros, separada das figuras', () => {
    expect(numerarElementos(corpo).elementos.map((e) => [e.bloco.id, e.sequencia, e.numero])).toEqual([
      [imagem.id, 'quadro', 1],
      [figura.id, 'figura', 1],
      [grade.id, 'quadro', 2],
    ]);
    const r = rotulosDeRemissiva(corpo);
    expect([r.get(imagem.id), r.get(grade.id), r.get(figura.id)]).toEqual(['Quadro 1', 'Quadro 2', 'Figura 1']);
  });

  it('a visão geral da conformidade o conta em Quadros', () => {
    const alvos = alvosDeRemissiva(corpo).map((a) => (a.id === imagem.id || a.id === grade.id ? { ...a, especie: 'quadro' as const } : a));
    const inv = inventarioConformidade({ problemas: [], diagnosticos: [] }, { alvos, remissivas: [], citacoes: 0, obras: 0, preTextuais: 0 });
    expect(inv.categorias.find((c) => c.categoria === 'quadros')!.noTrabalho).toBe(2);
    expect(inv.categorias.find((c) => c.categoria === 'figuras')!.noTrabalho).toBe(1);
  });
});
