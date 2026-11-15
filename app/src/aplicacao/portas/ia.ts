/**
 * Porta `ia`: contrato da API `window.bibliodocs.ia.*` (Etapa 8 da especificação de atualização).
 *
 * - Provedor: qualquer serviço com a API de chat no formato da OpenAI (`POST <url>/chat/completions`): OpenAI
 *   (ChatGPT), Google Gemini, Anthropic (Claude), OpenRouter, Ollama local ou um endereço informado pelo autor.
 *   Autenticação oficial desses serviços: chave de API no cabeçalho `Authorization: Bearer` (o Ollama local não pede).
 * - A chave fica só no processo principal, cifrada pelo sistema (DPAPI no Windows); a interface só sabe se há chave.
 * - Nada é enviado sem a autorização do autor na tela, que mostra o conteúdo exato antes. Com a IA desativada, nada
 *   sai do computador e os fluxos manuais continuam.
 * - Uso: o que o provedor informa (tokens da resposta, limites por minuto dos cabeçalhos) é separado do que o
 *   aplicativo estima; a cota restante da conta não é informada por esses serviços.
 * - Pontos de retomada: gravados pelo principal, um por trabalho, depois de cada etapa e quando o limite está perto.
 */

export const CANAIS_IA = {
  lerConfig: 'bibliodocs:ia:lerConfig',
  gravarConfig: 'bibliodocs:ia:gravarConfig',
  apagarChave: 'bibliodocs:ia:apagarChave',
  enviar: 'bibliodocs:ia:enviar',
  lerRetomada: 'bibliodocs:ia:lerRetomada',
  gravarRetomada: 'bibliodocs:ia:gravarRetomada',
  descartarRetomada: 'bibliodocs:ia:descartarRetomada',
} as const;

export type CanalIa = (typeof CANAIS_IA)[keyof typeof CANAIS_IA];

export type IdProvedor = 'openai' | 'gemini' | 'anthropic' | 'openrouter' | 'ollama' | 'personalizado';

export const PROVEDORES: readonly { id: IdProvedor; nome: string; url: string; modelo: string; exigeChave: boolean }[] = [
  { id: 'openai', nome: 'OpenAI (ChatGPT)', url: 'https://api.openai.com/v1', modelo: 'gpt-4o-mini', exigeChave: true },
  { id: 'gemini', nome: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', modelo: 'gemini-2.0-flash', exigeChave: true },
  { id: 'anthropic', nome: 'Anthropic (Claude)', url: 'https://api.anthropic.com/v1', modelo: 'claude-haiku-5-5', exigeChave: true },
  { id: 'openrouter', nome: 'OpenRouter (vários modelos)', url: 'https://openrouter.ai/api/v1', modelo: 'openai/gpt-4o-mini', exigeChave: true },
  { id: 'ollama', nome: 'Ollama (no computador)', url: 'http://localhost:11434/v1', modelo: 'llama3.1', exigeChave: false },
  { id: 'personalizado', nome: 'Outro serviço compatível', url: '', modelo: '', exigeChave: false },
];

export interface ConfigIA {
  ativa: boolean;
  provedor: IdProvedor;
  /** Base da API, sem `/chat/completions`. `https:`; `http:` só no próprio computador. */
  url: string;
  modelo: string;
  /** Limite de tokens por mês que o autor quer acompanhar (a barra de progresso usa o uso informado pelo provedor). */
  limiteTokensMes?: number;
}

export interface EstadoConfigIA extends ConfigIA {
  temChave: boolean;
  /** O sistema cifra a chave (DPAPI). Sem isso, a chave não é gravada. */
  cifraDisponivel: boolean;
  /** Tokens informados pelo provedor neste mês (AAAA-MM), somados pelo aplicativo. */
  usoMes: { mes: string; tokens: number };
}

export interface MensagemIA {
  papel: 'sistema' | 'usuario';
  texto: string;
  /** Imagem junto do texto (especificação revista, Etapa 9: tabela a partir de imagem); só em mensagem do usuário. */
  imagem?: { tipo: 'image/png' | 'image/jpeg'; base64: string };
}

/** Tamanho máximo da imagem enviada (em base64, cerca de 6 MB de arquivo). */
export const LIMITE_BASE64_IMAGEM_IA = 8_000_000;

export interface PedidoIA {
  mensagens: MensagemIA[];
  /** Teto de tokens da resposta. */
  maxTokens?: number;
}

/** Uso informado pelo provedor na resposta (`usage`). Campo ausente = não informado. */
export interface UsoInformado {
  entrada?: number;
  saida?: number;
  total?: number;
}

/** Limites por minuto dos cabeçalhos `x-ratelimit-*` (quando o provedor os manda). */
export interface LimitesInformados {
  tokensRestantes?: number;
  tokensLimite?: number;
  pedidosRestantes?: number;
  pedidosLimite?: number;
}

export type MotivoFalhaIA = 'DESATIVADA' | 'SEM_CHAVE' | 'CONFIG' | 'REDE' | 'TEMPO' | 'CHAVE_RECUSADA' | 'LIMITE' | 'PROVEDOR' | 'RESPOSTA';

export type ResultadoIA =
  | { ok: true; texto: string; uso: UsoInformado | null; limites: LimitesInformados | null; usoMes: { mes: string; tokens: number } }
  | { ok: false; motivo: MotivoFalhaIA; mensagem: string };

export type OperacaoIA = 'revisarTabelas' | 'interpretarModelo';

export interface EtapaRetomada {
  /** Id do elemento (tabela) ou da parte da tarefa. */
  chave: string;
  rotulo: string;
  /** `concluida`: resposta recebida; `aplicada`/`descartada`: o autor já decidiu (não se aplica duas vezes). */
  estado: 'pendente' | 'concluida' | 'aplicada' | 'descartada';
  resposta?: string;
  uso?: UsoInformado;
}

/** Ponto de retomada de uma tarefa de IA (um por trabalho). */
export interface PontoRetomada {
  versao: 1;
  trabalho: { id: string; nome: string };
  operacao: OperacaoIA;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  /** Por que o ponto foi gravado por último. */
  motivo: 'inicio' | 'etapa' | 'limite' | 'falha' | 'decisao';
  etapas: EtapaRetomada[];
}

export type ResultadoGravarIA = { ok: true } | { ok: false; mensagem: string };

export interface ApiIa {
  lerConfig(): Promise<EstadoConfigIA>;
  /** `chave`: nova chave a cifrar e guardar; ausente = mantém a atual. */
  gravarConfig(config: ConfigIA, chave?: string): Promise<ResultadoGravarIA>;
  apagarChave(): Promise<ResultadoGravarIA>;
  enviar(pedido: PedidoIA): Promise<ResultadoIA>;
  lerRetomada(idTrabalho: string): Promise<PontoRetomada | null>;
  gravarRetomada(ponto: PontoRetomada): Promise<ResultadoGravarIA>;
  descartarRetomada(idTrabalho: string): Promise<ResultadoGravarIA>;
}
