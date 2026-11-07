// M4-T07 (RF-07): funções da citação no editor. A chamada na tela sai do mesmo formatador do DOCX; o editor só insere a
// citação que o formato aceita; o texto colado com "(AUTOR, ano)" de uma obra cadastrada vira sugestão de ligação.
import { describe, expect, it } from 'vitest';
import { formatadorDeChamadas, reconhecerChamadasEscritas, validarCitacao } from '../src/aplicacao';
import type { Obra } from '../src/dominio/modelo';

const t = (texto: string) => [{ tipo: 'texto' as const, texto }];
const livro = (id: string, sobrenome: string, ano: number | undefined, prenomes = 'Ana'): Obra => ({
  id,
  tipo: 'livro',
  autores: [{ tipo: 'pessoa', sobrenome, prenomes }],
  titulo: t(`Obra de ${sobrenome}`),
  ...(ano === undefined ? {} : { ano }),
});

const cagliari = livro('obr_cagliari000001', 'Cagliari', 2003, 'Luiz Carlos');
const candido = livro('obr_candido0000001', 'Candido', 1993, 'Antonio');
const limaA = livro('obr_limaa000000001', 'Lima', 2020);
const limaB = livro('obr_limab000000001', 'Lima', 2020, 'Bruno');
const semAno = livro('obr_semano00000001', 'Souza', undefined);
const OBRAS = [cagliari, candido, limaA, limaB, semAno];

describe('formatador de chamadas', () => {
  it('gera o texto da chamada com as obras do trabalho, como no documento', () => {
    const f = formatadorDeChamadas(OBRAS);
    expect(f({ forma: 'parentetica', obras: [{ obra: cagliari.id, pagina: '12' }] }).texto).toBe('(CAGLIARI, 2003, p. 12)');
    expect(f({ forma: 'narrativa', obras: [{ obra: candido.id, volume: '2', pagina: '12' }] }).texto).toBe('Candido (1993, v. 2, p. 12)');
    expect(f({ forma: 'parentetica', obras: [{ obra: cagliari.id }], apud: { obra: candido.id, pagina: '5' } }).texto).toBe('(CAGLIARI, 2003 apud CANDIDO, 1993, p. 5)');
  });

  it('mudar a obra muda a chamada (aceite do RF-07)', () => {
    const dados = { forma: 'parentetica' as const, obras: [{ obra: cagliari.id }] };
    expect(formatadorDeChamadas([{ ...cagliari, ano: 2004 }])(dados).texto).toBe('(CAGLIARI, 2004)');
  });

  it('edição 2023 (C-01): sobrenome sem caixa alta dentro dos parênteses', () => {
    expect(formatadorDeChamadas(OBRAS, '2023')({ forma: 'parentetica', obras: [{ obra: cagliari.id }] }).texto).toBe('(Cagliari, 2003)');
  });

  it('obra que não está no trabalho sai com "?" e aviso', () => {
    const r = formatadorDeChamadas([])({ forma: 'parentetica', obras: [{ obra: cagliari.id }] });
    expect(r.texto).toBe('(?)');
    expect(r.avisos.map((a) => a.codigo)).toEqual(['OBRA_INEXISTENTE']);
  });
});

describe('validar a citação antes de inserir', () => {
  it('apara, tira página com "sem paginação" e devolve a forma única', () => {
    const r = validarCitacao({ forma: 'parentetica', obras: [{ obra: cagliari.id, volume: ' 2 ', pagina: '  ' }], apud: { obra: candido.id, pagina: '9', semPaginacao: true } }, OBRAS);
    expect(r).toEqual({ ok: true, dados: { forma: 'parentetica', obras: [{ obra: cagliari.id, volume: '2' }], apud: { obra: candido.id, semPaginacao: true } } });
  });

  it('recusa obra fora da bibliografia, página e volume fora do padrão', () => {
    const r = validarCitacao({ forma: 'parentetica', obras: [{ obra: 'obr_naoexiste00001' }, { obra: cagliari.id, pagina: '(12)', volume: '#' }], apud: { obra: '' } }, OBRAS);
    expect(r.ok).toBe(false);
    const caminhos = r.ok ? [] : r.erros.map((e) => e.caminho);
    expect(caminhos).toEqual(expect.arrayContaining(['citacao.obras[0].obra', 'citacao.obras[1].pagina', 'citacao.obras[1].volume', 'citacao.apud.obra']));
  });

  it('sem obra nenhuma não há citação', () => {
    expect(validarCitacao({ forma: 'parentetica', obras: [] }, OBRAS).ok).toBe(false);
  });
});

describe('chamadas escritas no texto colado', () => {
  const achar = (texto: string) => reconhecerChamadasEscritas(texto, OBRAS).map((c) => [c.texto, c.dados]);

  it('reconhece as duas formas, com volume e página, em maiúsculas ou não', () => {
    const texto = 'Como diz Cagliari (2003, p. 12), a escrita (CANDIDO, 1993, v. 2, p. 12) e (Cagliari, 2003).';
    expect(achar(texto)).toEqual([
      ['Cagliari (2003, p. 12)', { forma: 'narrativa', obras: [{ obra: cagliari.id, pagina: '12' }] }],
      ['(CANDIDO, 1993, v. 2, p. 12)', { forma: 'parentetica', obras: [{ obra: candido.id, volume: '2', pagina: '12' }] }],
      ['(Cagliari, 2003)', { forma: 'parentetica', obras: [{ obra: cagliari.id }] }],
    ]);
    const [primeira] = reconhecerChamadasEscritas(texto, OBRAS);
    expect(texto.slice(primeira!.inicio, primeira!.fim)).toBe('Cagliari (2003, p. 12)');
  });

  it('não sugere quando a chamada serviria a duas obras, nem obra sem ano, nem ano diferente', () => {
    expect(achar('(LIMA, 2020) e (SOUZA) e (CAGLIARI, 2004) e (CAGLIARI, 2003; CANDIDO, 1993)')).toEqual([]);
  });

  it('não reconhece pedaço de palavra', () => {
    expect(achar('Mascagliari (2003)')).toEqual([]);
  });
});
