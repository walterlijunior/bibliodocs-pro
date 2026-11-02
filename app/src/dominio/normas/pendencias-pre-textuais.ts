/**
 * Pendências dos elementos pré-textuais (M2-T08; RF-04): o que falta preencher, com a RN de cada item. O verificador
 * completo é do M7; aqui fica só o que o Manual exige dos elementos e dos campos que o autor preenche.
 *
 * - `pendencia`: o Manual exige e está faltando. Nunca impede de salvar: o trabalho incompleto é válido.
 * - `aviso`: fora da faixa do Manual (RN-154, RN-155, decisões C-B6 e C-B7) ou incoerente (RN-133).
 *
 * Elemento `sugerido` nunca gera pendência por faltar, nem pelos campos vazios (C-B18); só os avisos sobre o que o autor
 * escreveu valem para ele.
 */
import { ehTipoTrabalhoUft, ORDEM_PRE_TEXTUAIS, type Documento, type ElementoPreTextual, type ElementoPreTextualId } from '../modelo';
import type { Perfil } from './perfil';

export interface PendenciaPreTextual {
  elemento: ElementoPreTextualId;
  rn: string;
  nivel: 'pendencia' | 'aviso';
  mensagem: string;
}

const NOMES: Readonly<Record<ElementoPreTextualId, string>> = {
  capa: 'Capa',
  folhaRosto: 'Folha de rosto',
  fichaCatalografica: 'Ficha catalográfica',
  errata: 'Errata',
  folhaAprovacao: 'Folha de aprovação',
  dedicatoria: 'Dedicatória',
  agradecimentos: 'Agradecimentos',
  epigrafe: 'Epígrafe',
  resumo: 'Resumo',
  abstract: 'Resumo em língua estrangeira',
  listaIlustracoes: 'Lista de ilustrações',
  listaTabelas: 'Lista de tabelas',
  listaSiglas: 'Lista de abreviaturas e siglas',
  listaSimbolos: 'Lista de símbolos',
  sumario: 'Sumário',
};

const preenchido = (v: string | undefined): boolean => v !== undefined && v.trim() !== '';

export const contarPalavras = (texto: string): number => {
  const t = texto.trim();
  return t === '' ? 0 : t.split(/\s+/u).length;
};

/** Pendências e avisos do documento, na ordem do Quadro 5. O tipo `generico` e os tipos desconhecidos não têm nenhum. */
export function pendenciasPreTextuais(doc: Pick<Documento, 'tipoTrabalho' | 'metadados' | 'preTextuais'>, perfil: Perfil): PendenciaPreTextual[] {
  if (!ehTipoTrabalhoUft(doc.tipoTrabalho)) return [];
  const estrutura = perfil.tiposTrabalho[doc.tipoTrabalho].preTextuais;
  // RN-154, a), com C-B6; RN-155, com C-B7.
  const faixaResumo = perfil.parametros['resumoPalavras']!.valor as { minimo: number; maximo: number };
  const maximoPalavrasChave = perfil.parametros['palavrasChaveMaximo']!.valor as number;
  const m = doc.metadados;
  const lista: PendenciaPreTextual[] = [];
  const presentes = new Map<ElementoPreTextualId, ElementoPreTextual>((doc.preTextuais ?? []).map((e) => [e.tipo, e]));

  for (const tipo of ORDEM_PRE_TEXTUAIS) {
    const presenca = estrutura[tipo].presenca;
    const e = presentes.get(tipo);
    const pendencia = (rn: string, mensagem: string) => lista.push({ elemento: tipo, rn, nivel: 'pendencia', mensagem });
    const aviso = (rn: string, mensagem: string) => lista.push({ elemento: tipo, rn, nivel: 'aviso', mensagem });
    const exigir = (rn: string, nome: string, v: string | undefined) => {
      if (!preenchido(v)) pendencia(rn, `${NOMES[tipo]}: falta ${nome}.`);
    };

    if (e === undefined) {
      if (presenca === 'obrigatorio') pendencia(estrutura[tipo].rn[1] ?? estrutura[tipo].rn[0]!, `${NOMES[tipo]}: elemento obrigatório ausente.`);
      if (tipo === 'agradecimentos' && presenca === 'condicional' && m.bolsista === true) {
        pendencia('RN-147', 'Agradecimentos: obrigatórios para autor bolsista.');
      }
      continue;
    }

    // Só o que o autor escreveu; vale para qualquer presença.
    if (e.tipo === 'resumo' && preenchido(e.texto)) {
      const n = contarPalavras(e.texto!);
      if (n < faixaResumo.minimo || n > faixaResumo.maximo) {
        aviso('RN-154', `Resumo: ${n} palavras; o Manual pede de ${faixaResumo.minimo} a ${faixaResumo.maximo}.`);
      }
    }
    if ((e.tipo === 'resumo' || e.tipo === 'abstract') && (e.palavrasChave?.length ?? 0) > maximoPalavrasChave) {
      aviso('RN-155', `${NOMES[tipo]}: ${e.palavrasChave!.length} palavras-chave; o Manual pede no máximo ${maximoPalavrasChave}.`);
    }
    if (e.tipo === 'folhaRosto' && preenchido(m.natureza)) {
      if (doc.tipoTrabalho === 'tese' && /\bmestr/iu.test(m.natureza!)) aviso('RN-133', 'Folha de rosto: a natureza cita mestrado, mas o trabalho é uma tese.');
      if (doc.tipoTrabalho === 'dissertacao' && /\bdout/iu.test(m.natureza!)) aviso('RN-133', 'Folha de rosto: a natureza cita doutorado, mas o trabalho é uma dissertação.');
    }
    if (e.tipo === 'agradecimentos' && presenca === 'condicional' && m.bolsista === true) exigir('RN-147', 'o texto (obrigatório para autor bolsista)', e.texto);

    if (presenca !== 'obrigatorio') continue;
    switch (e.tipo) {
      case 'capa':
        exigir('RN-117', 'a instituição', m.instituicao);
        exigir('RN-117', 'o câmpus', m.campus);
        exigir('RN-117', 'o curso ou programa', m.curso);
        exigir('RN-117', 'a autoria', m.autoria);
        exigir('RN-117', 'o título', m.titulo.map((t) => t.texto).join(''));
        exigir('RN-117', 'o local', m.local);
        exigir('RN-117', 'o ano', m.ano);
        break;
      case 'folhaRosto':
        exigir('RN-127', 'a autoria', m.autoria);
        exigir('RN-127', 'o título', m.titulo.map((t) => t.texto).join(''));
        exigir('RN-127', 'a natureza do trabalho', m.natureza);
        exigir('RN-127', 'o nome do(a) orientador(a)', m.orientador?.nome);
        exigir('RN-127', 'a titulação do(a) orientador(a)', m.orientador?.titulacao);
        exigir('RN-127', 'o local', m.local);
        exigir('RN-127', 'o ano', m.ano);
        break;
      case 'fichaCatalografica':
        exigir('RN-135', 'o texto da ficha', e.texto);
        break;
      case 'folhaAprovacao':
        exigir('RN-140', 'a natureza do trabalho (na folha de rosto)', m.natureza);
        exigir('RN-140', 'a data de aprovação', e.dataAprovacao);
        if ((e.banca?.length ?? 0) === 0) pendencia('RN-140', 'Folha de aprovação: falta a banca.');
        (e.banca ?? []).forEach((b, i) => {
          const quem = `do membro ${i + 1} da banca`;
          exigir('RN-140', `o nome ${quem}`, b.nome);
          exigir('RN-140', `a titulação ${quem}`, b.titulacao);
          exigir('RN-140', `a instituição ${quem}`, b.instituicao);
        });
        break;
      case 'resumo':
        exigir('RN-150', 'o texto', e.texto);
        if ((e.palavrasChave?.length ?? 0) === 0) pendencia('RN-150', 'Resumo: faltam as palavras-chave.');
        break;
      case 'abstract':
        exigir('RN-157', 'o texto', e.texto);
        if ((e.palavrasChave?.length ?? 0) === 0) pendencia('RN-157', 'Resumo em língua estrangeira: faltam as palavras-chave.');
        break;
      default:
        break;
    }
  }
  return lista;
}
