/** Elementos pós-textuais (M6-T05). A aplicação entrega a ordem e os rótulos; o conteúdo usa o editor da seção. */
import { useEffect, useId, useState } from 'react';
import type { ElementoPosTextual } from '../../dominio/modelo';

type Tipo = ElementoPosTextual['tipo'];
const NOMES: Readonly<Record<Tipo, string>> = {
  referencias: 'Referências', glossario: 'Glossário', apendice: 'Apêndice', anexo: 'Anexo', indice: 'Índice',
};

export interface PropsPosTextuais {
  elementos: readonly ElementoPosTextual[];
  somenteLeitura: boolean;
  ativoId: string | null;
  rotulos?: ReadonlyMap<string, string>;
  aoEscolher: (id: string) => void;
  aoIncluir: (tipo: Tipo) => void;
  aoRetirar: (id: string) => void;
  aoRenomear: (id: string, titulo: string) => void;
  aoMover: (id: string, sentido: 'cima' | 'baixo') => void;
}

export function PosTextuais(p: PropsPosTextuais) {
  const base = useId();
  const [tipo, setTipo] = useState<Tipo>('apendice');
  const ativo = p.elementos.find((e) => e.id === p.ativoId);
  const textoExterno = ativo && 'titulo' in ativo ? ativo.titulo ?? '' : '';
  const [titulo, setTitulo] = useState(textoExterno);
  useEffect(() => { setTitulo(textoExterno); }, [p.ativoId, textoExterno]);
  const rotulo = (e: ElementoPosTextual) => p.rotulos?.get(e.id) ?? `${NOMES[e.tipo]}${'titulo' in e && e.titulo ? ` — ${e.titulo}` : ''}`;
  const tipos = (Object.keys(NOMES) as Tipo[]).filter((t) => t === 'apendice' || t === 'anexo' || !p.elementos.some((e) => e.tipo === t));
  const escolhido = tipos.includes(tipo) ? tipo : tipos[0];

  return (
    <nav className="elementos" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>Elementos pós-textuais</h2>
      {p.elementos.length === 0 ? <p className="dica">Nenhum elemento pós-textual incluído.</p> : (
        <ul className="elementos__lista">
          {p.elementos.map((e) => {
            const nome = rotulo(e);
            const repetivel = e.tipo === 'apendice' || e.tipo === 'anexo';
            const grupo = p.elementos.filter((x) => x.tipo === e.tipo);
            const i = grupo.findIndex((x) => x.id === e.id);
            return (
              <li key={e.id}>
                <button type="button" className="elementos__item" aria-current={e.id === p.ativoId ? 'true' : undefined} onClick={() => p.aoEscolher(e.id)}>{nome}</button>
                {!p.somenteLeitura && e.id === p.ativoId && (
                  <div className="acoes" role="group" aria-label={`Ações de ${nome}`}>
                    {repetivel && <>
                      <button type="button" className="btn-secundario" aria-label={`Subir ${nome}`} disabled={i === 0} onClick={() => p.aoMover(e.id, 'cima')}>Subir</button>
                      <button type="button" className="btn-secundario" aria-label={`Baixar ${nome}`} disabled={i === grupo.length - 1} onClick={() => p.aoMover(e.id, 'baixo')}>Baixar</button>
                    </>}
                    <button type="button" className="btn-secundario" aria-label={`Retirar ${nome}`} onClick={() => p.aoRetirar(e.id)}>Retirar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ativo && (ativo.tipo === 'apendice' || ativo.tipo === 'anexo') && (
        <div className="elemento__campo">
          <label htmlFor={`${base}-nome`}>Título do {ativo.tipo === 'apendice' ? 'apêndice' : 'anexo'}</label>
          <input id={`${base}-nome`} className="campo" type="text" value={titulo} readOnly={p.somenteLeitura} spellCheck={false} onChange={(ev) => {
            const v = ev.target.value;
            setTitulo(v);
            p.aoRenomear(ativo.id, v);
          }} />
          <p className="dica">A letra é calculada pela posição no trabalho.</p>
        </div>
      )}
      {!p.somenteLeitura && escolhido && (
        <div className="elementos__incluir">
          <label htmlFor={`${base}-incluir`}>Incluir pós-textual</label>
          <select id={`${base}-incluir`} className="campo" value={escolhido} onChange={(ev) => setTipo(ev.target.value as Tipo)}>
            {tipos.map((t) => <option key={t} value={t}>{NOMES[t]}</option>)}
          </select>
          <button type="button" className="btn-secundario" onClick={() => p.aoIncluir(escolhido)}>Incluir pós-textual</button>
        </div>
      )}
      {!p.somenteLeitura && <p className="dica">Retirar um elemento preserva a possibilidade de desfazer. Ctrl+Z restaura.</p>}
    </nav>
  );
}
