// Especificação revista, Etapa 3 (L5): caixa alta por campo na capa e na folha de rosto do TCC. No Manual da UFT 2022
// (a edição do perfil): capa com autoria e título em caixa alta (5.1 c-d, p. 31); folha de rosto com autoria e título em
// "negrito e caixa baixa" (5.3 a-b, p. 33; RN-128, RN-129) e natureza em texto corrido (RN-131). A especificação revista
// cita outra edição (seção 3.1.1.2) com a folha de rosto em caixa alta: decisão pendente do usuário (D-E3-10). A caixa
// alta vem do estilo (`allCaps` no DOCX); o texto gravado nunca muda.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PERFIL_UFT_2022 as PERFIL } from '../src/aplicacao/perfil-padrao';
import { formatar, type BlocoFormatado } from '../src/dominio/normas';
import type { ElementoPreTextual, Metadados } from '../src/dominio/modelo';
import { exportarDocx } from '../src/exportacao/docx';

const M: Metadados = {
  titulo: [{ tipo: 'texto', texto: 'Um título em Caixa Mista' }],
  autoria: 'Ana Souza',
  instituicao: 'Universidade Federal do Tocantins',
  campus: 'Câmpus Universitário de Palmas',
  curso: 'Curso de Graduação em Letras',
  local: 'Palmas, TO',
  ano: '2026',
  natureza: 'Monografia apresentada à Universidade Federal do Tocantins (UFT), Câmpus Universitário de Palmas, para obtenção do título de licenciado em Letras.',
  orientador: { titulacao: 'Dra.', nome: 'Bia Lima' },
};
const pre = [{ id: 'pre_1', tipo: 'capa' }, { id: 'pre_2', tipo: 'folhaRosto' }] as ElementoPreTextual[];
const texto = (b: BlocoFormatado) => (b.tipo === 'paragrafo' ? b.trechos.map((t) => (t.tipo === 'texto' ? t.texto : '')).join('') : '');

describe('Caixa alta por campo na folha de rosto (L5)', () => {
  const d = formatar({ corpo: [], metadados: M, preTextuais: pre }, PERFIL);
  const maiusculas = (id: string) => d.estilos.find((e) => e.id === id)?.propriedades.maiusculas === true;

  it('capa em maiúsculas; folha de rosto (autoria, título, natureza, local e ano) em caixa mista', () => {
    expect(maiusculas('capaAutoria')).toBe(true);
    expect(maiusculas('capaTitulo')).toBe(true);
    expect(maiusculas('rostoAutoria')).toBe(false);
    expect(maiusculas('rostoTitulo')).toBe(false);
    expect(maiusculas('naturezaTrabalho')).toBe(false);
    expect(maiusculas('rostoLocalAno')).toBe(false);
  });

  it('o texto da folha de rosto sai como foi gravado (a caixa é do estilo)', () => {
    const rosto = d.secoes.find((s) => s.papel === 'folhaRosto')!;
    const natureza = rosto.blocos.find((b) => b.tipo === 'paragrafo' && b.estilo === 'naturezaTrabalho')!;
    expect(texto(natureza)).toContain('Monografia apresentada à Universidade Federal do Tocantins (UFT)');
    const titulo = rosto.blocos.find((b) => b.tipo === 'paragrafo' && b.estilo === 'rostoTitulo')!;
    expect(texto(titulo)).toBe('Um título em Caixa Mista');
  });

  it('no DOCX, só os estilos da capa levam allCaps', async () => {
    const bytes = await exportarDocx(d);
    const estilos = strFromU8(unzipSync(bytes)['word/styles.xml']!);
    const estilo = (id: string) => new RegExp(`<w:style[^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`).exec(estilos)?.[0] ?? '';
    expect(estilo('capaAutoria')).toContain('<w:caps/>');
    expect(estilo('capaTitulo')).toContain('<w:caps/>');
    expect(estilo('rostoAutoria')).not.toContain('<w:caps');
    expect(estilo('rostoTitulo')).not.toContain('<w:caps');
    expect(estilo('naturezaTrabalho')).not.toContain('<w:caps');
    const doc = strFromU8(unzipSync(bytes)['word/document.xml']!);
    expect(doc).toContain('Monografia apresentada à Universidade Federal do Tocantins (UFT)');
  });
});
