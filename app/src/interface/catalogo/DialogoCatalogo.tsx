/**
 * Catálogo acadêmico (Etapa 3 da especificação de atualização): acrescentar e corrigir instituições, câmpus ou polos,
 * cursos ou programas, disciplinas e docentes. As mudanças ficam numa cópia até "Guardar"; guardadas, valem para todos os
 * trabalhos deste computador (o arquivo do trabalho guarda só a cópia dos textos). Registro corrigido ou acrescentado
 * passa a ser "do usuário"; o que veio dos dados iniciais mostra a fonte.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  gravarCampus,
  gravarCurso,
  gravarInstituicao,
  idDoNome,
  idsDoCatalogo,
  retirarRegistro,
  type Campus,
  type Catalogo,
  type Curso,
  type GrauCurso,
  type Instituicao,
  type NivelCurso,
  type SelecaoCatalogo,
} from '../../aplicacao';
import { aoFecharDialogo } from '../casca/dialogo';
import { useCatalogo } from './ContextoCatalogo';
import { FichaInstitucional } from './FichaInstitucional';
import { LogotipoInstituicao } from './LogotipoInstituicao';
import { origemDaEscolha } from './SeletorInstitucional';

export interface PropsDialogoCatalogo {
  inicial: SelecaoCatalogo;
  aoFechar: () => void;
}

const NIVEIS: readonly [NivelCurso, string][] = [
  ['graduacao', 'Graduação'],
  ['especializacao', 'Especialização'],
  ['mestrado', 'Mestrado'],
  ['doutorado', 'Doutorado'],
];
const GRAUS: readonly [GrauCurso, string][] = [
  ['bacharelado', 'Bacharelado'],
  ['licenciatura', 'Licenciatura'],
  ['tecnologia', 'Tecnologia'],
];

function Campo(p: { rotulo: string; valor: string; aoMudar: (v: string) => void; erro?: string | undefined; largura?: 'curta' }) {
  const id = useId();
  return (
    <div className={p.largura === 'curta' ? 'campo-catalogo campo-catalogo--curto' : 'campo-catalogo'}>
      <label htmlFor={id}>{p.rotulo}</label>
      <input id={id} className="campo" type="text" value={p.valor} aria-invalid={p.erro !== undefined || undefined} aria-describedby={p.erro ? `${id}-erro` : undefined} onChange={(e) => p.aoMudar(e.target.value)} />
      {p.erro && (
        <span className="dica dica--erro" id={`${id}-erro`}>
          {p.erro}
        </span>
      )}
    </div>
  );
}

const obrigatorio = (v: string) => (v.trim() === '' ? 'Obrigatório.' : undefined);

export function DialogoCatalogo(p: PropsDialogoCatalogo) {
  const { catalogo, alterar, api, ia } = useCatalogo();
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [cat, setCat] = useState<Catalogo>(catalogo);
  const [sel, setSel] = useState<SelecaoCatalogo>(p.inicial);
  const [mudou, setMudou] = useState(false);
  const [novaDisciplina, setNovaDisciplina] = useState('');
  const [novoDocente, setNovoDocente] = useState({ nome: '', titulacao: '' });
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('select')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true });
    };
  }, []);

  const inst = cat.instituicoes.find((i) => i.id === sel.instituicao);
  const campus = inst?.campi.find((c) => c.id === sel.campus);
  const curso = campus?.cursos.find((c) => c.id === sel.curso);
  const trocar = (novo: Catalogo) => {
    setCat(novo);
    setMudou(true);
    setMensagem(null);
  };
  const novoId = (prefixo: string, nome: string) => idDoNome(prefixo, nome, idsDoCatalogo(cat));

  const salvarInst = (i: Instituicao) => trocar(gravarInstituicao(cat, { ...i, origem: 'usuario' }));
  const salvarCampus = (c: Campus) => inst && trocar(gravarCampus(cat, inst.id, { ...c, origem: 'usuario' }));
  const salvarCurso = (c: Curso) => inst && campus && trocar(gravarCurso(cat, inst.id, campus.id, { ...c, origem: 'usuario' }));

  const incluirInstituicao = () => {
    const id = novoId('inst', `nova ${cat.instituicoes.length + 1}`);
    trocar(gravarInstituicao(cat, { id, nome: 'Nova instituição', sigla: 'SIGLA', perfis: [], campi: [], origem: 'usuario' }));
    setSel({ instituicao: id });
  };
  const incluirCampus = () => {
    if (!inst) return;
    const id = novoId(inst.id, `campus ${inst.campi.length + 1}`);
    trocar(gravarCampus(cat, inst.id, { id, nome: 'Novo câmpus', especie: 'campus', cursos: [], origem: 'usuario' }));
    setSel({ instituicao: inst.id, campus: id });
  };
  const incluirCurso = () => {
    if (!inst || !campus) return;
    const id = novoId(campus.id, `curso ${campus.cursos.length + 1}`);
    trocar(gravarCurso(cat, inst.id, campus.id, { id, nome: 'Novo curso', nivel: 'graduacao', disciplinas: [], docentes: [], origem: 'usuario' }));
    setSel({ instituicao: inst.id, campus: campus.id, curso: id });
  };
  const retirar = (id: string, nivel: 'instituicao' | 'campus' | 'curso') => {
    trocar(retirarRegistro(cat, id));
    setSel(nivel === 'instituicao' ? {} : nivel === 'campus' ? { instituicao: sel.instituicao! } : { instituicao: sel.instituicao!, campus: sel.campus! });
  };

  const erros = [
    ...(inst ? [obrigatorio(inst.nome), obrigatorio(inst.sigla)] : []),
    ...(campus ? [obrigatorio(campus.nome), campus.uf === undefined || /^[A-Z]{2}$/.test(campus.uf) ? undefined : 'UF'] : []),
    ...(curso ? [obrigatorio(curso.nome)] : []),
  ].filter(Boolean);

  const guardar = async () => {
    // Nomes com espaço nas pontas saem limpos (o esquema do principal recusa texto vazio ou com controle).
    const ok = await alterar(cat);
    if (ok) p.aoFechar();
    else setMensagem('Não foi possível guardar o catálogo. Tente de novo.');
  };

  const seletor = (rotulo: string, valor: string | undefined, opcoes: readonly { id: string; nome: string }[], aoEscolher: (id: string) => void, incluir: () => void, rotuloIncluir: string) => (
    <div className="catalogo__nivel">
      <label htmlFor={`${base}-${rotulo}`}>{rotulo}</label>
      <div className="catalogo__linha">
        <select id={`${base}-${rotulo}`} className="campo" value={valor ?? ''} onChange={(e) => aoEscolher(e.target.value)}>
          <option value="">Escolha…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secundario" onClick={incluir}>
          {rotuloIncluir}
        </button>
      </div>
    </div>
  );

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--catalogo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={aoFecharDialogo(p.aoFechar)}
    >
      <form
        className="dialogo__corpo"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <h2 id={`${base}-titulo`}>Catálogo acadêmico</h2>
        <p className="dica">Acrescente ou corrija instituições, câmpus, cursos, disciplinas e docentes, ou importe a ficha de uma instituição. Vale para todos os trabalhos deste computador.</p>

        {seletor('Instituição', sel.instituicao, cat.instituicoes.map((i) => ({ id: i.id, nome: `${i.nome} (${i.sigla})` })), (id) => setSel(id ? { instituicao: id } : {}), incluirInstituicao, 'Nova instituição')}
        {inst && (
          <div className="catalogo__registro">
            <Campo rotulo="Nome da instituição" valor={inst.nome} erro={obrigatorio(inst.nome)} aoMudar={(nome) => salvarInst({ ...inst, nome })} />
            <Campo rotulo="Sigla" largura="curta" valor={inst.sigla} erro={obrigatorio(inst.sigla)} aoMudar={(sigla) => salvarInst({ ...inst, sigla })} />
            <p className="dica">
              {origemDaEscolha(cat, { instituicao: inst.id })} {inst.perfis.length === 0 ? 'Sem perfil de formatação próprio: os trabalhos usam o perfil UFT 2022.' : ''}
            </p>
            <LogotipoInstituicao
              instituicao={inst}
              aoMudar={(logotipo) => {
                const { logotipo: _antigo, ...sem } = inst;
                salvarInst(logotipo ? { ...sem, logotipo } : sem);
              }}
            />
            <button type="button" className="btn-secundario" onClick={() => retirar(inst.id, 'instituicao')}>
              Retirar instituição
            </button>
          </div>
        )}

        {inst &&
          seletor('Câmpus ou polo', sel.campus, inst.campi.map((c) => ({ id: c.id, nome: c.especie === 'polo' ? `Polo ${c.nome}` : c.nome })), (id) => setSel(id ? { instituicao: inst.id, campus: id } : { instituicao: inst.id }), incluirCampus, 'Novo câmpus ou polo')}
        {campus && (
          <div className="catalogo__registro">
            <Campo rotulo="Nome do câmpus ou polo" valor={campus.nome} erro={obrigatorio(campus.nome)} aoMudar={(nome) => salvarCampus({ ...campus, nome })} />
            <div className="campo-catalogo campo-catalogo--curto">
              <label htmlFor={`${base}-especie`}>Tipo</label>
              <select id={`${base}-especie`} className="campo" value={campus.especie} onChange={(e) => salvarCampus({ ...campus, especie: e.target.value as Campus['especie'] })}>
                <option value="campus">Câmpus</option>
                <option value="polo">Polo (EaD)</option>
              </select>
            </div>
            <Campo
              rotulo="Cidade"
              valor={campus.cidade ?? ''}
              aoMudar={(cidade) => {
                const { cidade: _c, ...resto } = campus;
                salvarCampus(cidade.trim() === '' ? resto : { ...resto, cidade });
              }}
            />
            <Campo
              rotulo="UF"
              largura="curta"
              valor={campus.uf ?? ''}
              erro={campus.uf === undefined || /^[A-Z]{2}$/.test(campus.uf) ? undefined : 'Duas letras maiúsculas, como TO.'}
              aoMudar={(uf) => {
                const { uf: _u, ...resto } = campus;
                const v = uf.toUpperCase().slice(0, 2);
                salvarCampus(v === '' ? resto : { ...resto, uf: v });
              }}
            />
            {(campus.cidade === undefined || campus.uf === undefined) && <p className="dica">Sem cidade e UF, o local da capa fica para você digitar no trabalho.</p>}
            <p className="dica">{origemDaEscolha(cat, { instituicao: inst!.id, campus: campus.id })}</p>
            <button type="button" className="btn-secundario" onClick={() => retirar(campus.id, 'campus')}>
              Retirar câmpus ou polo
            </button>
          </div>
        )}

        {campus &&
          seletor('Curso ou programa', sel.curso, campus.cursos.map((c) => ({ id: c.id, nome: c.nome })), (id) => setSel(id ? { instituicao: inst!.id, campus: campus.id, curso: id } : { instituicao: inst!.id, campus: campus.id }), incluirCurso, 'Novo curso ou programa')}
        {curso && (
          <div className="catalogo__registro">
            <Campo rotulo="Nome do curso ou programa" valor={curso.nome} erro={obrigatorio(curso.nome)} aoMudar={(nome) => salvarCurso({ ...curso, nome })} />
            <div className="campo-catalogo campo-catalogo--curto">
              <label htmlFor={`${base}-nivel`}>Nível</label>
              <select id={`${base}-nivel`} className="campo" value={curso.nivel} onChange={(e) => salvarCurso({ ...curso, nivel: e.target.value as NivelCurso })}>
                {NIVEIS.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {curso.nivel === 'graduacao' && (
              <div className="campo-catalogo campo-catalogo--curto">
                <label htmlFor={`${base}-grau`}>Grau</label>
                <select
                  id={`${base}-grau`}
                  className="campo"
                  value={curso.grau ?? ''}
                  onChange={(e) => {
                    const { grau: _g, ...resto } = curso;
                    salvarCurso(e.target.value === '' ? resto : { ...resto, grau: e.target.value as GrauCurso });
                  }}
                >
                  <option value="">Não informado</option>
                  {GRAUS.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(curso.nivel === 'mestrado' || curso.nivel === 'doutorado') && (
              <Campo
                rotulo="Área de concentração"
                valor={curso.areaConcentracao ?? ''}
                aoMudar={(v) => {
                  const { areaConcentracao: _a, ...resto } = curso;
                  salvarCurso(v.trim() === '' ? resto : { ...resto, areaConcentracao: v });
                }}
              />
            )}
            <p className="dica">{origemDaEscolha(cat, { instituicao: inst!.id, campus: campus!.id, curso: curso.id })}</p>

            <fieldset className="catalogo__lista">
              <legend>Disciplinas</legend>
              {curso.disciplinas.length === 0 ? <p className="dica">Nenhuma.</p> : (
                <ul>
                  {curso.disciplinas.map((d) => (
                    <li key={d.id}>
                      {d.nome}{' '}
                      <button type="button" className="btn-link" aria-label={`Retirar a disciplina ${d.nome}`} onClick={() => salvarCurso({ ...curso, disciplinas: curso.disciplinas.filter((x) => x.id !== d.id) })}>
                        Retirar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="catalogo__linha">
                <Campo rotulo="Nova disciplina" valor={novaDisciplina} aoMudar={setNovaDisciplina} />
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={novaDisciplina.trim() === ''}
                  onClick={() => {
                    salvarCurso({ ...curso, disciplinas: [...curso.disciplinas, { id: novoId(curso.id, novaDisciplina), nome: novaDisciplina.trim(), origem: 'usuario' }] });
                    setNovaDisciplina('');
                  }}
                >
                  Incluir disciplina
                </button>
              </div>
            </fieldset>

            <fieldset className="catalogo__lista">
              <legend>Docentes</legend>
              {curso.docentes.length === 0 ? <p className="dica">Nenhum.</p> : (
                <ul>
                  {curso.docentes.map((d) => (
                    <li key={d.id}>
                      {d.titulacao ? `${d.titulacao} ` : ''}
                      {d.nome}{' '}
                      <button type="button" className="btn-link" aria-label={`Retirar ${d.nome}`} onClick={() => salvarCurso({ ...curso, docentes: curso.docentes.filter((x) => x.id !== d.id) })}>
                        Retirar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="catalogo__linha">
                <Campo rotulo="Titulação" largura="curta" valor={novoDocente.titulacao} aoMudar={(titulacao) => setNovoDocente((d) => ({ ...d, titulacao }))} />
                <Campo rotulo="Nome do docente" valor={novoDocente.nome} aoMudar={(nome) => setNovoDocente((d) => ({ ...d, nome }))} />
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={novoDocente.nome.trim() === ''}
                  onClick={() => {
                    const titulacao = novoDocente.titulacao.trim().slice(0, 40);
                    salvarCurso({ ...curso, docentes: [...curso.docentes, { id: novoId(curso.id, novoDocente.nome), nome: novoDocente.nome.trim(), ...(titulacao ? { titulacao } : {}), origem: 'usuario' }] });
                    setNovoDocente({ nome: '', titulacao: '' });
                  }}
                >
                  Incluir docente
                </button>
              </div>
            </fieldset>
            <button type="button" className="btn-secundario" onClick={() => retirar(curso.id, 'curso')}>
              Retirar curso ou programa
            </button>
          </div>
        )}

        <FichaInstitucional catalogo={cat} instituicao={inst} api={api} ia={ia} aoTrocar={trocar} aoEscolherInstituicao={(id) => setSel({ instituicao: id })} />

        <p className="dica" role="status">
          {mensagem ?? (erros.length > 0 ? 'Preencha os campos marcados para guardar.' : '')}
        </p>
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-principal" disabled={!mudou || erros.length > 0}>
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}
