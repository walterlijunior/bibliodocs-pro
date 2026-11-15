/**
 * Canais `bibliodocs:ia:*` (Etapa 8 da especificação de atualização).
 *
 * - Configuração em `%LOCALAPPDATA%\BiblioDocsPro\ia-config.json`: provedor, endereço, modelo, limite mensal, uso do
 *   mês e a chave **cifrada pelo sistema** (`safeStorage`, DPAPI no Windows). Sem cifra disponível, a chave não é
 *   gravada. A chave nunca volta para a interface.
 * - `enviar`: confere o pedido (até 20 mensagens, 400 mil caracteres) e a configuração, decifra a chave e chama o
 *   cliente; soma ao uso do mês o total que o provedor informar.
 * - Pontos de retomada em `ia-retomada.json`, um por trabalho (até 50), conferidos pelo esquema ao gravar e ao ler.
 * - Arquivos gravados por cópia temporária e troca (a queda no meio não deixa o arquivo pela metade).
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { CANAIS_IA, type CanalIa, type ConfigIA, type EstadoConfigIA, type PontoRetomada, type ResultadoGravarIA, type ResultadoIA } from '../../aplicacao/portas/ia';
import { enviarChat, urlBaseValida, type Buscar } from '../../integracoes';
import type { OrigemPermitida } from '../seguranca/politica-urls';
import { criarConferencia, criarFila, type Manipulador } from './chamada';

export interface CifraSistema {
  disponivel(): boolean;
  cifrar(texto: string): Uint8Array;
  decifrar(bytes: Uint8Array): string;
}

export interface DependenciasIa {
  origem: OrigemPermitida;
  conteudosPermitidos: () => ReadonlySet<number>;
  arquivoConfig: string;
  arquivoRetomada: string;
  cifra: CifraSistema;
  buscar: Buscar;
  agora?: () => Date;
  log?: (m: string) => void;
}

const texto = (max: number) => z.string().max(max).regex(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F]*$/u);
const esquemaConfig = z.strictObject({
  ativa: z.boolean(),
  provedor: z.enum(['openai', 'gemini', 'anthropic', 'openrouter', 'ollama', 'personalizado']),
  url: texto(500),
  modelo: texto(200),
  limiteTokensMes: z.int().min(1).max(1_000_000_000).optional(),
});
const esquemaPedido = z.strictObject({
  mensagens: z
    .array(
      z.strictObject({
        papel: z.enum(['sistema', 'usuario']),
        texto: texto(400_000),
        imagem: z.strictObject({ tipo: z.enum(['image/png', 'image/jpeg']), base64: z.string().max(8_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).optional(),
      }),
    )
    .min(1)
    .max(20)
    // Revisão do ciclo da especificação revista (R-RV-01): uma imagem por pedido, só na mensagem do usuário (sem isso,
    // 20 imagens de 8 MB passariam numa chamada).
    .refine((ms) => ms.filter((m) => m.imagem).length <= 1 && ms.every((m) => !m.imagem || m.papel === 'usuario'), { error: 'no máximo uma imagem, na mensagem do usuário' }),
  maxTokens: z.int().min(1).max(32_000).optional(),
});
const uso = z.strictObject({ entrada: z.int().min(0).optional(), saida: z.int().min(0).optional(), total: z.int().min(0).optional() });
const esquemaPonto = z.strictObject({
  versao: z.literal(1),
  trabalho: z.strictObject({ id: texto(64).min(1), nome: texto(500) }),
  operacao: z.enum(['revisarTabelas', 'interpretarModelo']),
  titulo: texto(500),
  criadoEm: z.iso.datetime(),
  atualizadoEm: z.iso.datetime(),
  motivo: z.enum(['inicio', 'etapa', 'limite', 'falha', 'decisao']),
  etapas: z
    .array(
      z.strictObject({
        chave: texto(64).min(1),
        rotulo: texto(2000),
        estado: z.enum(['pendente', 'concluida', 'aplicada', 'descartada']),
        resposta: texto(100_000).optional(),
        uso: uso.optional(),
      }),
    )
    .min(1)
    .max(500),
});
const esquemaArquivoConfig = z.strictObject({
  versao: z.literal(1),
  config: esquemaConfig,
  chave: z.string().max(20_000).optional(),
  usoMes: z.strictObject({ mes: z.string().regex(/^\d{4}-\d{2}$/), tokens: z.int().min(0) }),
});
const esquemaArquivoRetomada = z.strictObject({ versao: z.literal(1), pontos: z.record(z.string().max(64), esquemaPonto) });

const MAX_PONTOS = 50;
const CONFIG_PADRAO: ConfigIA = { ativa: false, provedor: 'openai', url: 'https://api.openai.com/v1', modelo: 'gpt-4o-mini' };

async function gravarJson(arquivo: string, valor: unknown): Promise<void> {
  await mkdir(dirname(arquivo), { recursive: true });
  const temp = `${arquivo}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(valor), 'utf8');
  await rename(temp, arquivo);
}

async function lerJson<T>(arquivo: string, esquema: z.ZodType<T>): Promise<T | null> {
  try {
    const r = esquema.safeParse(JSON.parse(await readFile(arquivo, 'utf8')));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function criarManipuladoresIa(dep: DependenciasIa): Readonly<Record<CanalIa, Manipulador>> {
  const log = dep.log ?? ((m: string) => console.warn(m));
  const agora = dep.agora ?? (() => new Date());
  const { conferir, recusarArgumento } = criarConferencia(dep.origem, dep.conteudosPermitidos, log);
  const fila = criarFila();
  const mesAtual = () => agora().toISOString().slice(0, 7);

  type ArquivoConfig = z.infer<typeof esquemaArquivoConfig>;
  const lerArquivoConfig = async (): Promise<ArquivoConfig> =>
    (await lerJson(dep.arquivoConfig, esquemaArquivoConfig)) ?? { versao: 1, config: CONFIG_PADRAO, usoMes: { mes: mesAtual(), tokens: 0 } };
  const usoDoMes = (a: ArquivoConfig) => (a.usoMes.mes === mesAtual() ? a.usoMes : { mes: mesAtual(), tokens: 0 });
  const estado = (a: ArquivoConfig): EstadoConfigIA => ({ ...(a.config as ConfigIA), temChave: a.chave !== undefined, cifraDisponivel: dep.cifra.disponivel(), usoMes: usoDoMes(a) });

  const lerConfig: Manipulador = async (r, argumentos) => {
    conferir(CANAIS_IA.lerConfig, r, argumentos, 0);
    return fila(async () => estado(await lerArquivoConfig()));
  };

  const gravarConfig: Manipulador = async (r, argumentos): Promise<ResultadoGravarIA> => {
    const canal = CANAIS_IA.gravarConfig;
    conferir(canal, r, argumentos, 2);
    const c = esquemaConfig.safeParse(argumentos[0]);
    if (!c.success) return recusarArgumento(canal, 'configuração');
    // `null` = mantém a chave guardada.
    const chave = argumentos[1];
    if (chave !== null && (typeof chave !== 'string' || chave.length > 4_000 || /[\s\u0000-\u001F]/.test(chave.trim()) || chave.trim() === '')) return recusarArgumento(canal, 'chave');
    if (c.data.url !== '' && urlBaseValida(c.data.url) === null) return { ok: false, mensagem: 'Endereço inválido: use https:// (ou http:// só no próprio computador, como o Ollama).' };
    return fila(async () => {
      const a = await lerArquivoConfig();
      let cifrada = a.chave;
      if (typeof chave === 'string') {
        if (!dep.cifra.disponivel()) return { ok: false, mensagem: 'O sistema não oferece cifra para guardar a chave com segurança: ela não foi gravada.' };
        cifrada = Buffer.from(dep.cifra.cifrar(chave.trim())).toString('base64');
      }
      await gravarJson(dep.arquivoConfig, { versao: 1, config: c.data, ...(cifrada !== undefined ? { chave: cifrada } : {}), usoMes: usoDoMes(a) });
      return { ok: true };
    });
  };

  const apagarChave: Manipulador = async (r, argumentos): Promise<ResultadoGravarIA> => {
    conferir(CANAIS_IA.apagarChave, r, argumentos, 0);
    return fila(async () => {
      const { chave: _c, ...resto } = await lerArquivoConfig();
      await gravarJson(dep.arquivoConfig, resto);
      return { ok: true };
    });
  };

  const enviar: Manipulador = async (r, argumentos): Promise<ResultadoIA> => {
    const canal = CANAIS_IA.enviar;
    conferir(canal, r, argumentos, 1);
    const p = esquemaPedido.safeParse(argumentos[0]);
    if (!p.success) return recusarArgumento(canal, 'pedido');
    const total = p.data.mensagens.reduce((n, m) => n + m.texto.length, 0);
    if (total > 400_000) return recusarArgumento(canal, 'pedido (tamanho)');
    const a = await fila(lerArquivoConfig);
    if (!a.config.ativa) return { ok: false, motivo: 'DESATIVADA', mensagem: 'A IA está desativada. Os recursos manuais continuam disponíveis.' };
    let chave: string | null = null;
    if (a.chave !== undefined) {
      try {
        chave = dep.cifra.decifrar(Buffer.from(a.chave, 'base64'));
      } catch {
        return { ok: false, motivo: 'SEM_CHAVE', mensagem: 'A chave guardada não pôde ser lida neste computador. Informe a chave de novo.' };
      }
    } else if (a.config.provedor !== 'ollama' && a.config.provedor !== 'personalizado') {
      return { ok: false, motivo: 'SEM_CHAVE', mensagem: 'Informe a chave de API do serviço na configuração da IA.' };
    }
    const resposta = await enviarChat(a.config, chave, p.data, dep.buscar);
    if (!resposta.ok) {
      log(`[ia] envio sem sucesso: ${resposta.motivo}`);
      return resposta;
    }
    const usoMes = await fila(async () => {
      const atual = await lerArquivoConfig();
      const u = { mes: mesAtual(), tokens: usoDoMes(atual).tokens + (resposta.uso?.total ?? 0) };
      await gravarJson(dep.arquivoConfig, { ...atual, usoMes: u });
      return u;
    });
    return { ...resposta, usoMes };
  };

  type ArquivoRetomada = z.infer<typeof esquemaArquivoRetomada>;
  const lerPontos = async (): Promise<ArquivoRetomada> => (await lerJson(dep.arquivoRetomada, esquemaArquivoRetomada)) ?? { versao: 1, pontos: {} };

  const lerRetomada: Manipulador = async (r, argumentos) => {
    conferir(CANAIS_IA.lerRetomada, r, argumentos, 1);
    const id = argumentos[0];
    if (typeof id !== 'string' || id.length > 64) return recusarArgumento(CANAIS_IA.lerRetomada, 'trabalho');
    return fila(async () => ((await lerPontos()).pontos[id] as PontoRetomada | undefined) ?? null);
  };

  const gravarRetomada: Manipulador = async (r, argumentos): Promise<ResultadoGravarIA> => {
    conferir(CANAIS_IA.gravarRetomada, r, argumentos, 1);
    const p = esquemaPonto.safeParse(argumentos[0]);
    if (!p.success) return recusarArgumento(CANAIS_IA.gravarRetomada, 'ponto de retomada');
    return fila(async () => {
      const a = await lerPontos();
      const pontos = { ...a.pontos, [p.data.trabalho.id]: p.data };
      // Mais de 50 trabalhos com tarefa aberta: sai o ponto mais antigo.
      const ordem = Object.values(pontos).sort((x, y) => (x.atualizadoEm < y.atualizadoEm ? -1 : 1));
      while (ordem.length > MAX_PONTOS) delete pontos[ordem.shift()!.trabalho.id];
      try {
        await gravarJson(dep.arquivoRetomada, { versao: 1, pontos });
        return { ok: true };
      } catch {
        log('[ia] ponto de retomada não gravado');
        return { ok: false, mensagem: 'O ponto de retomada não pôde ser gravado.' };
      }
    });
  };

  const descartarRetomada: Manipulador = async (r, argumentos): Promise<ResultadoGravarIA> => {
    conferir(CANAIS_IA.descartarRetomada, r, argumentos, 1);
    const id = argumentos[0];
    if (typeof id !== 'string' || id.length > 64) return recusarArgumento(CANAIS_IA.descartarRetomada, 'trabalho');
    return fila(async () => {
      const a = await lerPontos();
      const { [id]: _x, ...pontos } = a.pontos;
      await gravarJson(dep.arquivoRetomada, { versao: 1, pontos });
      return { ok: true };
    });
  };

  return {
    [CANAIS_IA.lerConfig]: lerConfig,
    [CANAIS_IA.gravarConfig]: gravarConfig,
    [CANAIS_IA.apagarChave]: apagarChave,
    [CANAIS_IA.enviar]: enviar,
    [CANAIS_IA.lerRetomada]: lerRetomada,
    [CANAIS_IA.gravarRetomada]: gravarRetomada,
    [CANAIS_IA.descartarRetomada]: descartarRetomada,
  } as Record<CanalIa, Manipulador>;
}
