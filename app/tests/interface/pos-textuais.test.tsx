import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PosTextuais, type PropsPosTextuais } from '../../src/interface/escrever/PosTextuais';

const props: PropsPosTextuais = {
  elementos: [
    { tipo: 'referencias', id: 'pos_ref000001' },
    { tipo: 'apendice', id: 'pos_ap000001', titulo: 'Roteiro' },
    { tipo: 'apendice', id: 'pos_ap000002', titulo: 'Questionário' },
    { tipo: 'anexo', id: 'pos_an000001', titulo: 'Documento' },
  ],
  ativoId: 'pos_ap000001', somenteLeitura: false,
  rotulos: new Map([['pos_ap000001', 'APÊNDICE A — Roteiro'], ['pos_ap000002', 'APÊNDICE B — Questionário']]),
  aoEscolher: () => {}, aoIncluir: () => {}, aoRetirar: () => {}, aoRenomear: () => {}, aoMover: () => {},
};

describe('pós-textuais na barra lateral', () => {
  it('recebe rótulos da aplicação, mostra ações do ativo e impede repetir referências', () => {
    const html = renderToStaticMarkup(<PosTextuais {...props} />);
    expect(html).toContain('Elementos pós-textuais');
    expect(html).toContain('APÊNDICE A — Roteiro');
    expect(html).toContain('aria-current="true"');
    // O título é editado na linha de título do editor, não num campo aqui (revisão do M6).
    expect(html).toContain('O título do apêndice é a primeira linha do texto');
    expect(html).toMatch(/aria-label="Subir APÊNDICE A — Roteiro" disabled/);
    expect(html).not.toContain('<option value="referencias"');
    expect(html).toContain('Ctrl+Z restaura');
  });
  it('somente leitura conserva conteúdo e não oferece alterações', () => {
    const html = renderToStaticMarkup(<PosTextuais {...props} somenteLeitura />);
    expect(html).not.toContain('Incluir pós-textual');
    expect(html).not.toContain('aria-label="Retirar');
    expect(html).not.toContain('aria-label="Subir');
  });
  it('texto vindo do documento é escapado', () => {
    const html = renderToStaticMarkup(<PosTextuais {...props} rotulos={new Map()} elementos={[{ tipo: 'apendice', id: 'pos_ap000001', titulo: '<script>ataque</script>' }]} />);
    expect(html).toContain('&lt;script&gt;ataque&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
