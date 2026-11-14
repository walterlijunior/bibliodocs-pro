/**
 * Perfil com um modelo de evento (Etapa 7 da especificação de atualização). O perfil continua o da UFT; o modelo só
 * acrescenta regras no fim (dentro do mesmo alvo, a última vence no motor) para o que ele define: página e margens,
 * fonte, corpo, entrelinha, alinhamento e recuo do texto, e os títulos dos três primeiros níveis. O que o modelo não
 * define continua com a regra do Manual. As regras novas têm id `MOD-*` e fonte "modelo do evento", para a origem de
 * cada formatação continuar conferível.
 */
import type { ModeloEvento, EstiloTituloModelo } from '../modelo';
import type { Perfil, PropriedadesFormatacao, RegraNormativa, AlvoRegra } from './perfil';

const FONTE = 'Modelo do evento (DOCX importado pelo autor)';

function regra(id: string, alvo: AlvoRegra, propriedades: PropriedadesFormatacao): RegraNormativa | null {
  const limpas = Object.fromEntries(Object.entries(propriedades).filter(([, v]) => v !== undefined)) as PropriedadesFormatacao;
  return Object.keys(limpas).length === 0 ? null : { id, status: 'CONFIRMADA', fonte: FONTE, tipo: 'estilo', alvo, propriedades: limpas };
}

function titulo(n: 1 | 2 | 3, t: EstiloTituloModelo | undefined, entrelinha: PropriedadesFormatacao['entrelinha']): RegraNormativa | null {
  return regra(`MOD-TITULO${n}`, `titulo.nivel${n}`, {
    corpoPt: t?.corpoPt,
    negrito: t?.negrito,
    italico: t?.italico,
    maiusculas: t?.maiusculas,
    alinhamento: t?.alinhamento,
    // Artigo de evento não abre seção em página nova, salvo se o modelo pedir.
    quebraPaginaAntes: t === undefined ? undefined : (t.quebraPagina ?? false),
    entrelinha,
  });
}

export function perfilComModelo(perfil: Perfil, modelo: ModeloEvento | undefined): Perfil {
  if (!modelo) return perfil;
  const m = modelo.regras;
  const novas = [
    regra('MOD-PAGINA', 'pagina', {
      larguraMm: m.larguraMm,
      alturaMm: m.alturaMm,
      margemSuperiorCm: m.margemSuperiorCm,
      margemInferiorCm: m.margemInferiorCm,
      margemEsquerdaCm: m.margemEsquerdaCm,
      margemDireitaCm: m.margemDireitaCm,
    }),
    regra('MOD-DOCUMENTO', 'documento', { corpoPt: m.corpoPt }),
    regra('MOD-CORPO', 'corpo.paragrafo', { entrelinha: m.entrelinha, alinhamento: m.alinhamento, recuoPrimeiraLinhaCm: m.recuoPrimeiraLinhaCm }),
    titulo(1, m.titulo1, m.entrelinha),
    titulo(2, m.titulo2, m.entrelinha),
    titulo(3, m.titulo3, m.entrelinha),
  ].filter((r): r is RegraNormativa => r !== null);
  const fonte = perfil.parametros['fonte'];
  const parametros =
    m.fonte && fonte ? { ...perfil.parametros, fonte: { ...fonte, valor: m.fonte, opcoes: [m.fonte], origem: 'modelo-evento' } } : perfil.parametros;
  return { ...perfil, nome: `${perfil.nome} + modelo “${modelo.nome}”`, parametros, regras: [...perfil.regras, ...novas] };
}
