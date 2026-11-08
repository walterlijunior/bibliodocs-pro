// Registro e serializador usam os tipos DOM do renderer, mas a serialização de texto roda sem uma janela.
import { Slice } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { copiaComChamadas, RegistroChamadas } from '../../src/interface/editor/chamada-view';
import { esquemaEditor } from '../../src/interface/editor/esquema';
import { RegistroSiglas } from '../../src/interface/editor/sigla-view';

describe('siglas: texto exibido e cópia', () => {
  it('mudar o cadastro atualiza o registro; quebrada nunca some na cópia', () => {
    const s = { id: 'sig_cadastro0001', sigla: 'UFT', extenso: 'Universidade Federal do Tocantins' };
    const registro = new RegistroSiglas();
    registro.definir([s]);
    expect(registro.texto(s.id)).toBe('UFT');
    registro.definir([{ ...s, sigla: 'UFTO' }]);
    expect(registro.texto(s.id)).toBe('UFTO');
    const no = esquemaEditor.nodes['sigla']!.create({ id: 'sig_inline0001', sigla: s.id });
    const fatia = new Slice(esquemaEditor.nodes['paragrafo']!.create({ id: 'par_siglas0001' }, no).content, 0, 0);
    const copiar = copiaComChamadas(new RegistroChamadas(), undefined, registro).clipboardTextSerializer!;
    expect(copiar(fatia, {} as never)).toBe('UFTO');
    registro.definir([]);
    expect(copiar(fatia, {} as never)).toBe('[sigla sem cadastro]');
    expect(copiaComChamadas(new RegistroChamadas()).clipboardTextSerializer!(fatia, {} as never)).toBe('[sigla sem cadastro]');
  });
});
