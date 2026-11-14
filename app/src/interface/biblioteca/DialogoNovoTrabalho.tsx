/**
 * Diálogo "Novo trabalho" (M2-T02; RF-02): o autor escolhe o tipo, e o trabalho nasce com os elementos e as seções do
 * tipo. `<dialog>` modal do próprio Chromium: prende o foco e fecha com Esc; o resto da janela fica inerte.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  campiDisponiveis,
  cursoDe,
  cursosDisponiveis,
  dadosInstitucionais,
  instituicaoDe,
  revisarSelecao,
  tiposDeTrabalhoDoNivel,
  type DadosDoCatalogo,
  type SelecaoCatalogo,
} from '../../aplicacao';
import { aoFecharDialogo } from '../casca/dialogo';
import type { TipoTrabalhoUft, VinculoInstitucional } from '../../dominio/modelo';
import { useCatalogo } from '../catalogo/ContextoCatalogo';
import { logotipoParaAplicar } from '../catalogo/logotipo';
import { ROTULOS_TIPO, TIPOS_NOVO_TRABALHO } from './selecao';

/** Etapa 3: dados institucionais escolhidos no diálogo, para o trabalho nascer com eles. */
export interface InstitucionalNovoTrabalho {
  dados: DadosDoCatalogo;
  vinculo: VinculoInstitucional;
  logotipo: { sha256: string; bytes: Uint8Array } | null;
}

const NIVEIS = { graduacao: 'graduação', especializacao: 'especialização', mestrado: 'mestrado', doutorado: 'doutorado' } as const;

export interface PropsDialogoNovoTrabalho {
  /** Tipo marcado ao abrir (o último escolhido na sessão). */
  inicial: TipoTrabalhoUft;
  /** Outra troca de trabalho em curso: "Criar trabalho" fica desativado. */
  ocupado?: boolean;
  aoCriar: (tipo: TipoTrabalhoUft, institucional: InstitucionalNovoTrabalho | null) => void;
  aoCancelar: () => void;
}

export function DialogoNovoTrabalho(p: PropsDialogoNovoTrabalho) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tipo, setTipo] = useState(p.inicial);
  const base = useId();
  // Etapa 3: instituição, câmpus e curso opcionais; o curso escolhido limita os tipos de trabalho ao nível dele.
  const { catalogo } = useCatalogo();
  const [sel, setSel] = useState<SelecaoCatalogo>({});
  const curso = cursoDe(catalogo, sel);
  const permitidos = tiposDeTrabalhoDoNivel(curso?.nivel);
  const tipos = useMemo(() => TIPOS_NOVO_TRABALHO.filter((t) => permitidos.includes(t.id)), [permitidos]);
  const tipoValido = permitidos.includes(tipo) ? tipo : tipos[0]!.id;
  const escolher = (campo: 'instituicao' | 'campus' | 'curso', valor: string) => {
    const pedida: SelecaoCatalogo = { ...sel };
    if (valor === '') delete pedida[campo];
    else pedida[campo] = valor;
    setSel(revisarSelecao(catalogo, pedida).selecao);
  };
  const lista = (campo: 'instituicao' | 'campus' | 'curso', rotulo: string, opcoes: readonly { id: string; nome: string }[], vazio: string, desativado: boolean) => (
    <div className="campo-catalogo">
      <label htmlFor={`${base}-${campo}`}>{rotulo}</label>
      <select id={`${base}-${campo}`} className="campo" value={sel[campo] ?? ''} disabled={desativado} onChange={(e) => escolher(campo, e.target.value)}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );

  // O diálogo sai da página ao fechar, e o Chromium só devolve o foco de um `<dialog>` que continua nela: o foco volta
  // aqui a quem abriu (se ainda existe; ao criar, a aba Escrever põe o foco no título depois).
  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      // O `autoFocus` do React age antes do `showModal` e não vale: o foco vai ao tipo marcado (revisão do M2-T02, M2).
      d.querySelector<HTMLInputElement>('input:checked')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={`${base}-titulo`}
      aria-describedby={`${base}-nota`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoCancelar();
      }}
      // Fechado à força pelo Chromium (Esc repetido sem ativação): o estado acompanha.
      onClose={aoFecharDialogo(p.aoCancelar)}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          p.aoCriar(
            tipoValido,
            sel.instituicao === undefined
              ? null
              : { dados: dadosInstitucionais(catalogo, sel, tipoValido), vinculo: { ...sel } as VinculoInstitucional, logotipo: logotipoParaAplicar(instituicaoDe(catalogo, sel.instituicao)) },
          );
        }}
      >
        <h2 id={`${base}-titulo`}>Novo trabalho</h2>
        <p id={`${base}-nota`} className="dica">
          O trabalho é gravado na pasta da Biblioteca assim que for criado.
        </p>
        <fieldset className="novo-trabalho__instituicao">
          <legend>Instituição e curso (opcional)</legend>
          <div className="seletor-institucional__grade">
            {lista('instituicao', 'Instituição', catalogo.instituicoes.map((i) => ({ id: i.id, nome: `${i.nome} (${i.sigla})` })), 'Preencher depois', false)}
            {lista('campus', 'Câmpus ou polo', campiDisponiveis(catalogo, sel).map((c) => ({ id: c.id, nome: c.nome })), sel.instituicao ? 'Escolha…' : 'Escolha a instituição', !sel.instituicao)}
            {lista('curso', 'Curso ou programa', cursosDisponiveis(catalogo, sel).map((c) => ({ id: c.id, nome: `${c.nome} (${NIVEIS[c.nivel]})` })), sel.campus ? 'Escolha…' : 'Escolha o câmpus', !sel.campus)}
          </div>
          {curso && <p className="dica">Tipos de trabalho do nível do curso ({NIVEIS[curso.nivel]}).</p>}
        </fieldset>
        <fieldset className="tipos-trabalho lista-rolavel">
          <legend>Tipo de trabalho</legend>
          {tipos.map((t) => (
            <label key={t.id} className="tipos-trabalho__opcao">
              <input
                type="radio"
                name={`${base}-tipo`}
                value={t.id}
                checked={tipoValido === t.id}
                onChange={() => setTipo(t.id)}
                // Nome só com o rótulo; a descrição vem uma vez, pelo `aria-describedby` (revisão do M2-T02, A1).
                aria-labelledby={`${base}-${t.id}-nome`}
                aria-describedby={`${base}-${t.id}`}
              />
              <span id={`${base}-${t.id}-nome`} className="tipos-trabalho__nome">
                {ROTULOS_TIPO[t.id]}
              </span>
              <span id={`${base}-${t.id}`} className="dica">
                {t.descricao}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn-principal" disabled={p.ocupado}>
            Criar trabalho
          </button>
        </div>
      </form>
    </dialog>
  );
}
