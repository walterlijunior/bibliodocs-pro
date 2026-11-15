/**
 * Titulações oferecidas no seletor (Etapa 3 da especificação revista): a forma abreviada vai para a folha de rosto e a
 * folha de aprovação ("Orientador(a): Titulação/Nome", RN-132; banca, RN-144). Lista provisória (D-E3-09): as formas do
 * catálogo e as com "Prof." do desenho da Fig. 7 do Manual. Valor fora da lista é "outra titulação" e fica como foi
 * digitado (trabalhos existentes não mudam).
 */
export const TITULACOES: readonly { valor: string; rotulo: string }[] = [
  { valor: 'Dr.', rotulo: 'Doutor (Dr.)' },
  { valor: 'Dra.', rotulo: 'Doutora (Dra.)' },
  { valor: 'Me.', rotulo: 'Mestre (Me.)' },
  { valor: 'Ma.', rotulo: 'Mestra (Ma.)' },
  { valor: 'Esp.', rotulo: 'Especialista (Esp.)' },
  { valor: 'Prof. Dr.', rotulo: 'Professor doutor (Prof. Dr.)' },
  { valor: 'Prof.ª Dr.ª', rotulo: 'Professora doutora (Prof.ª Dr.ª)' },
  { valor: 'Prof. Me.', rotulo: 'Professor mestre (Prof. Me.)' },
  { valor: 'Prof.ª Ma.', rotulo: 'Professora mestra (Prof.ª Ma.)' },
];

/** A titulação está na lista (senão, é "outra"). */
export const titulacaoDaLista = (v: string | undefined): boolean => v !== undefined && TITULACOES.some((t) => t.valor === v);
