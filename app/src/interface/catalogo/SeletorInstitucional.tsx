/**
 * Dados institucionais pelo catálogo (Etapa 3 da especificação de atualização): instituição → câmpus ou polo → curso ou
 * programa → disciplina e docentes, cada lista filtrada pela escolha de cima. Cada escolha vai na hora para o trabalho
 * (`aoAplicar`): os textos da capa e da folha de rosto são preenchidos, o que vinha da escolha anterior e não vale mais
 * sai, e os dados do autor (autoria, título, subtítulo, ano) nunca são tocados. "Digitar à mão" desfaz o vínculo e deixa
 * os textos como estão, para editar nos campos de baixo.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  campiDisponiveis,
  campusDe,
  cursoDe,
  cursosDisponiveis,
  dadosInstitucionais,
  disciplinasDisponiveis,
  docentesDisponiveis,
  instituicaoDe,
  revisarSelecao,
  type CampoSelecao,
  type Catalogo,
  type DadosDoCatalogo,
  type SelecaoCatalogo,
} from '../../aplicacao';
import type { TipoTrabalhoId, VinculoInstitucional } from '../../dominio/modelo';
import { AjudaContextual, TextoAjuda } from '../casca/AjudaContextual';
import { useCatalogo } from './ContextoCatalogo';
import { DialogoCatalogo } from './DialogoCatalogo';

export interface PropsSeletorInstitucional {
  vinculo: VinculoInstitucional | undefined;
  natureza: string | undefined;
  tipoTrabalho: TipoTrabalhoId;
  somenteLeitura: boolean;
  aoAplicar: (dados: DadosDoCatalogo, vinculo: VinculoInstitucional | null, opcoes?: { substituirNatureza?: boolean }) => void;
}

const NOMES_CAMPO: Readonly<Record<CampoSelecao, string>> = {
  instituicao: 'a instituição',
  campus: 'o câmpus',
  curso: 'o curso',
  disciplina: 'a disciplina',
  orientador: 'o orientador',
  coorientador: 'o coorientador',
};

const NIVEIS = { graduacao: 'graduação', especializacao: 'especialização', mestrado: 'mestrado', doutorado: 'doutorado' } as const;

/** Texto da origem do registro mais fundo escolhido. */
export function origemDaEscolha(c: Catalogo, s: SelecaoCatalogo): string {
  const r = cursoDe(c, s) ?? campusDe(c, s) ?? instituicaoDe(c, s.instituicao);
  if (!r) return '';
  if (r.origem === 'usuario') return 'Cadastrado ou corrigido neste computador.';
  if (!r.fonte) return 'Sem fonte confirmada: confira os dados.';
  const [a, m, d] = r.fonte.consultadoEm.split('-');
  return `Fonte: ${r.fonte.url.replace(/^https:\/\//, '')}, consultada em ${d}/${m}/${a}.`;
}

const vinculoDe = (s: SelecaoCatalogo): VinculoInstitucional | null => (s.instituicao === undefined ? null : ({ ...s } as VinculoInstitucional));

export function SeletorInstitucional(p: PropsSeletorInstitucional) {
  const { catalogo } = useCatalogo();
  const base = useId();
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const selecao = useMemo<SelecaoCatalogo>(() => revisarSelecao(catalogo, p.vinculo ?? {}).selecao, [catalogo, p.vinculo]);
  const dados = useMemo(() => dadosInstitucionais(catalogo, selecao, p.tipoTrabalho), [catalogo, selecao, p.tipoTrabalho]);
  const so = p.somenteLeitura;

  // Vínculo que aponta para registro que o catálogo não tem mais (outro computador, registro retirado): só avisa.
  const perdidos = useMemo(() => revisarSelecao(catalogo, p.vinculo ?? {}).descartados, [catalogo, p.vinculo]);
  useEffect(() => {
    if (perdidos.length > 0) setAnuncio(`Este trabalho foi ligado a ${perdidos.map((k) => NOMES_CAMPO[k]).join(', ')} que o catálogo deste computador não tem. Os textos continuam no trabalho.`);
  }, [perdidos]);

  const escolher = (campo: CampoSelecao, valor: string) => {
    const pedida: SelecaoCatalogo = { ...selecao, [campo]: valor === '' ? undefined : valor };
    if (valor === '') delete pedida[campo];
    const { selecao: nova, descartados } = revisarSelecao(catalogo, pedida);
    setAnuncio(descartados.length > 0 ? `Saiu da escolha ${descartados.map((k) => NOMES_CAMPO[k]).join(', ')}, que não pertence ao que foi escolhido acima.` : null);
    p.aoAplicar(dadosInstitucionais(catalogo, nova, p.tipoTrabalho), vinculoDe(nova));
  };

  const lista = (campo: CampoSelecao, rotulo: string, opcoes: readonly { id: string; nome: string }[], vazio: string, desativado: boolean) => (
    <div className="campo-catalogo">
      <label htmlFor={`${base}-${campo}`}>{rotulo}</label>
      <select id={`${base}-${campo}`} className="campo" value={selecao[campo] ?? ''} disabled={so || desativado} onChange={(e) => escolher(campo, e.target.value)}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );

  const curso = cursoDe(catalogo, selecao);
  const docentes = docentesDisponiveis(catalogo, selecao).map((d) => ({ id: d.id, nome: d.titulacao ? `${d.titulacao} ${d.nome}` : d.nome }));
  const naturezaDiferente = dados.natureza !== undefined && (p.natureza ?? '').trim() !== '' && dados.natureza !== p.natureza;

  return (
    <fieldset className="seletor-institucional">
      <legend>
        Dados institucionais
        <AjudaContextual titulo="Dados institucionais">
          <TextoAjuda>Escolha a instituição, o câmpus e o curso: a capa, a folha de rosto e a natureza do trabalho são preenchidas com os textos do catálogo, no modelo do Manual.</TextoAjuda>
          <TextoAjuda>Cada lista mostra só o que pertence à escolha de cima. Autoria, título e ano continuam seus e não mudam.</TextoAjuda>
          <TextoAjuda>Não achou? Use “Catálogo acadêmico…” para cadastrar ou corrigir, ou escolha “Digitar à mão” e preencha os campos abaixo.</TextoAjuda>
        </AjudaContextual>
      </legend>
      <div className="seletor-institucional__grade">
        {lista('instituicao', 'Instituição do catálogo', catalogo.instituicoes.map((i) => ({ id: i.id, nome: `${i.nome} (${i.sigla})` })), 'Digitar à mão', false)}
        {lista('campus', 'Câmpus ou polo do catálogo', campiDisponiveis(catalogo, selecao).map((c) => ({ id: c.id, nome: c.especie === 'polo' ? `Polo ${c.nome}` : c.nome })), selecao.instituicao ? 'Escolha…' : 'Escolha a instituição', !selecao.instituicao)}
        {lista('curso', 'Curso ou programa do catálogo', cursosDisponiveis(catalogo, selecao).map((c) => ({ id: c.id, nome: `${c.nome} (${NIVEIS[c.nivel]})` })), selecao.campus ? 'Escolha…' : 'Escolha o câmpus', !selecao.campus)}
        {curso && curso.disciplinas.length > 0 && lista('disciplina', 'Disciplina do catálogo', disciplinasDisponiveis(catalogo, selecao), 'Nenhuma', false)}
        {curso && docentes.length > 0 && lista('orientador', 'Orientador(a) do catálogo', docentes, 'Digitar à mão', false)}
        {curso && docentes.length > 0 && lista('coorientador', 'Coorientador(a) do catálogo', docentes, 'Nenhum(a)', false)}
      </div>
      {curso && docentes.length === 0 && <p className="dica">Este curso ainda não tem docentes no catálogo: cadastre em “Catálogo acadêmico…” ou digite o orientador abaixo.</p>}
      {selecao.instituicao && <p className="dica">{origemDaEscolha(catalogo, selecao)}</p>}
      {curso?.nivel === 'graduacao' && curso.grau === undefined && <p className="dica">Informe o grau do curso (bacharelado, licenciatura ou tecnologia) no catálogo para o aplicativo propor a natureza do trabalho.</p>}
      {naturezaDiferente && !so && (
        <p className="dica">
          A natureza do trabalho é diferente da proposta pelo catálogo.{' '}
          <button type="button" className="btn-link" onClick={() => p.aoAplicar(dados, vinculoDe(selecao), { substituirNatureza: true })}>
            Usar a proposta
          </button>
        </p>
      )}
      <p className="dica" role="status">
        {anuncio}
      </p>
      {!so && (
        <button type="button" className="btn-secundario" onClick={() => setEditando(true)}>
          Catálogo acadêmico…
        </button>
      )}
      {/* Portal no `body`: o seletor fica dentro do formulário da capa, e formulário dentro de formulário enviaria o de fora. */}
      {editando && createPortal(<DialogoCatalogo inicial={selecao} aoFechar={() => setEditando(false)} />, document.body)}
    </fieldset>
  );
}
