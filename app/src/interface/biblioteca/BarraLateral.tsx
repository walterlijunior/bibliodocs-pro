// Barra lateral da biblioteca: Recentes, Todos e Por tipo (só os tipos presentes na pasta). As coleções do usuário
// (equivalente das playlists) precisam de onde guardar a lista e ficam para depois do M1.
import { Fragment } from 'react';
import { Icone, type NomeIcone } from '../Icones';
import { mesmoFiltro, type Contagens, type Filtro } from './selecao';

export interface PropsBarraLateral {
  contagens: Contagens | null;
  filtro: Filtro;
  aoFiltrar: (f: Filtro) => void;
  nomePasta: string | null;
}

export function BarraLateral({ contagens, filtro, aoFiltrar, nomePasta }: PropsBarraLateral) {
  const botao = (f: Filtro, icone: NomeIcone, rotulo: string, quantidade: number | undefined) => (
    <li>
      <button type="button" aria-current={mesmoFiltro(f, filtro) ? 'true' : undefined} onClick={() => aoFiltrar(f)}>
        <Icone nome={icone} />
        {rotulo}
        {quantidade !== undefined && (
          <span className="contagem" aria-label={quantidade === 1 ? '1 trabalho' : `${quantidade} trabalhos`}>
            {quantidade}
          </span>
        )}
      </button>
    </li>
  );
  return (
    <aside className="lateral" aria-label="Biblioteca">
      <h2 id="g-bib">Biblioteca</h2>
      <ul aria-labelledby="g-bib">
        {botao({ tipo: 'recentes' }, 'relogio', 'Recentes', contagens?.recentes)}
        {botao({ tipo: 'todos' }, 'pilha', 'Todos', contagens?.todos)}
      </ul>
      {contagens !== null && contagens.porTipo.length > 0 && (
        <>
          <h2 id="g-tipo">Por tipo</h2>
          <ul aria-labelledby="g-tipo">
            {contagens.porTipo.map((t) => (
              <Fragment key={t.id}>{botao({ tipo: 'tipoTrabalho', id: t.id }, 'doc', t.rotulo, t.quantidade)}</Fragment>
            ))}
          </ul>
        </>
      )}
      {nomePasta !== null && <p className="lateral__pasta">Pasta: {nomePasta}</p>}
    </aside>
  );
}

