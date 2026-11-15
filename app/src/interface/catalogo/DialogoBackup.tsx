/**
 * Backup e restauração dos cadastros e configurações (Etapa 10 da especificação de atualização, D-E10-01).
 *
 * - Criar: diz o que entra (catálogo acadêmico com logotipos, campi, cursos, disciplinas, docentes, vínculos, manuais e
 *   perfis; configuração da IA sem a chave; preferências da interface) e o que não entra (trabalhos, referências e
 *   anexos, chave de IA). O destino é escolhido na janela do sistema: pasta, pendrive ou outra unidade.
 * - Restaurar: lê o arquivo escolhido, mostra o que será restaurado e os conflitos com o catálogo atual, e só grava
 *   depois que o usuário confirma ("substituir" ou "só acrescentar o que falta"). Arquivo inválido, cancelamento ou falha não
 *   mudam nada. A chave de IA é configurada de novo.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  CATALOGO_INICIAL,
  catalogoRestaurado,
  criarBackup,
  idsRetirados,
  lerBackup,
  LIMITE_BYTES_BACKUP,
  NAO_INCLUIDO_NO_BACKUP,
  previaRestauracao,
  resumoDoCatalogo,
  type Backup,
  type PreviaRestauracao,
} from '../../aplicacao';
import { aoFecharDialogo } from '../casca/dialogo';
import { Icone } from '../Icones';
import { useCatalogo } from './ContextoCatalogo';

const PREFIXO_PREFERENCIAS = 'bibliodocs.';

function preferenciasLocais(): Record<string, string> {
  const saida: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO_PREFERENCIAS)) saida[k] = localStorage.getItem(k) ?? '';
    }
  } catch {
    /* sem armazenamento local: sem preferências */
  }
  return saida;
}

const dataBr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
};

function Resumo({ r }: { r: Backup['resumo'] }) {
  return (
    <ul className="backup__resumo">
      <li>{r.instituicoes} instituições ({r.logotipos} com logotipo)</li>
      <li>{r.campi} câmpus ou polos</li>
      <li>{r.cursos} cursos</li>
      <li>
        {r.disciplinas} disciplinas e {r.docentes} docentes, com os vínculos
      </li>
      <li>
        {r.manuais} manuais e {r.perfis} perfis de formatação
      </li>
    </ul>
  );
}

export function DialogoBackup(p: { modo: 'criar' | 'restaurar'; appVersao: string; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const refArquivo = useRef<HTMLInputElement>(null);
  const base = useId();
  const { catalogo, alterar, api, ia } = useCatalogo();
  const [mensagem, setMensagem] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lido, setLido] = useState<{ nome: string; backup: Backup; previa: PreviaRestauracao } | null>(null);
  const [modo, setModo] = useState<'substituir' | 'acrescentar'>('acrescentar');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const criar = async () => {
    if (!api) return setMensagem({ texto: 'O backup não está disponível nesta janela.', erro: true });
    setOcupado(true);
    setMensagem(null);
    try {
      const cfg = ia ? await ia.lerConfig().catch(() => null) : null;
      const texto = criarBackup({
        usuario: { catalogo, removidos: idsRetirados(CATALOGO_INICIAL, catalogo) },
        ...(cfg ? { ia: { ativa: cfg.ativa, provedor: cfg.provedor, url: cfg.url, modelo: cfg.modelo, ...(cfg.limiteTokensMes ? { limiteTokensMes: cfg.limiteTokensMes } : {}) } } : {}),
        preferencias: preferenciasLocais(),
        appVersao: p.appVersao,
        agora: new Date(),
      });
      const hoje = new Date().toISOString().slice(0, 10);
      const r = await api.exportarBackup(texto, `BiblioDocsPro-backup-${hoje}.bdbackup.json`);
      if (r.ok) setMensagem({ texto: `Backup gravado em “${r.nome}”. Guarde-o fora deste computador (pendrive, nuvem) para recuperar os cadastros numa instalação nova.` });
      else if (r.cancelado) setMensagem({ texto: 'Backup cancelado. Nada foi gravado.' });
      else setMensagem({ texto: r.mensagem, erro: true });
    } catch {
      setMensagem({ texto: 'Não foi possível criar o backup. Tente de novo.', erro: true });
    } finally {
      setOcupado(false);
    }
  };

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setLido(null);
    if (f.size > LIMITE_BYTES_BACKUP) return setMensagem({ texto: `“${f.name}” é grande demais para um backup. Nada foi alterado.`, erro: true });
    const r = lerBackup(await f.text());
    if (!r.ok) return setMensagem({ texto: `“${f.name}”: ${r.mensagem}`, erro: true });
    setMensagem(null);
    const previa = previaRestauracao(catalogo, r.backup);
    setModo(previa.conflitos.length > 0 ? 'acrescentar' : 'substituir');
    setLido({ nome: f.name, backup: r.backup, previa });
  };

  const restaurar = async () => {
    if (!lido) return;
    setOcupado(true);
    try {
      const novo = catalogoRestaurado(CATALOGO_INICIAL, catalogo, lido.backup, modo);
      const ok = await alterar(novo);
      if (!ok) return setMensagem({ texto: 'Não foi possível gravar o catálogo restaurado. O catálogo deste computador continua como estava.', erro: true });
      const partes = ['Cadastros restaurados.'];
      const cfgIa = lido.backup.conteudo.ia;
      if (cfgIa && ia) {
        const g = await ia.gravarConfig({ ativa: cfgIa.ativa, provedor: cfgIa.provedor as never, url: cfgIa.url, modelo: cfgIa.modelo, ...(cfgIa.limiteTokensMes ? { limiteTokensMes: cfgIa.limiteTokensMes } : {}) }).catch(() => ({ ok: false }));
        partes.push(g.ok ? 'Configuração da IA restaurada: informe a chave de API de novo em Trabalho › Assistente de IA….' : 'A configuração da IA não pôde ser restaurada.');
      }
      try {
        for (const [k, v] of Object.entries(lido.backup.conteudo.preferencias ?? {})) localStorage.setItem(k, v);
      } catch {
        /* preferências são conveniências: sem armazenamento local, seguem as atuais */
      }
      if ((lido.backup.conteudo.preferencias && Object.keys(lido.backup.conteudo.preferencias).length > 0)) partes.push('Preferências da interface valem ao reabrir o aplicativo.');
      setMensagem({ texto: partes.join(' ') });
      setLido(null);
    } finally {
      setOcupado(false);
    }
  };

  const atual = resumoDoCatalogo(catalogo);
  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--backup"
      aria-labelledby={`${base}-t`}
      onCancel={(e) => {
        e.preventDefault();
        if (!ocupado) p.aoFechar();
      }}
      onClose={aoFecharDialogo(p.aoFechar)}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-t`}>{p.modo === 'criar' ? 'Criar backup de cadastros e configurações' : 'Restaurar backup de cadastros e configurações'}</h2>
        {p.modo === 'criar' ? (
          <>
            <p>O backup leva o catálogo acadêmico deste computador e as suas configurações:</p>
            <Resumo r={atual} />
            <p>Também entram a configuração da IA (provedor, modelo, limite) e as preferências da interface (zoom, largura do painel).</p>
            <p className="aviso">
              <Icone nome="alerta" />
              <span className="aviso__texto">Não entram: {NAO_INCLUIDO_NO_BACKUP.join('; ')}. Os trabalhos ficam nos arquivos .bdp da biblioteca e nas cópias de segurança (Arquivo › Cópias de segurança…).</span>
            </p>
            <div className="dialogo__acoes">
              <button type="button" className="btn-principal" disabled={ocupado} onClick={() => void criar()}>
                Escolher onde gravar…
              </button>
              <button type="button" className="btn-secundario" disabled={ocupado} onClick={p.aoFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Escolha um arquivo de backup (.bdbackup.json). Antes de gravar, a janela mostra o que será restaurado e o que muda no catálogo deste computador.</p>
            <input
              ref={refArquivo}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Arquivo de backup"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = '';
                void escolher(f);
              }}
            />
            <div className="acoes">
              <button type="button" className="btn-secundario" disabled={ocupado} onClick={() => refArquivo.current?.click()}>
                Escolher arquivo de backup…
              </button>
            </div>
            {lido && (
              <section aria-labelledby={`${base}-previa`} className="backup__previa">
                <h3 id={`${base}-previa`}>O que será restaurado</h3>
                <p className="dica">
                  “{lido.nome}”, criado em {dataBr(lido.previa.criadoEm)} pelo BiblioDocs Pro {lido.previa.appVersao}.
                </p>
                <Resumo r={lido.previa.resumo} />
                <ul className="backup__resumo">
                  {lido.previa.novas.length > 0 && <li>Entram: {lido.previa.novas.join('; ')}.</li>}
                  {lido.previa.iguais.length > 0 && <li>Iguais às deste computador: {lido.previa.iguais.join('; ')}.</li>}
                  {lido.previa.temIa && <li>Configuração da IA, sem a chave (informe-a de novo depois).</li>}
                  {lido.previa.preferencias > 0 && <li>{lido.previa.preferencias} preferências da interface.</li>}
                </ul>
                {lido.previa.conflitos.length > 0 && (
                  <p className="aviso">
                    <Icone nome="alerta" />
                    <span className="aviso__texto">Com dados diferentes neste computador: {lido.previa.conflitos.join('; ')}.</span>
                  </p>
                )}
                <fieldset className="tipos-trabalho">
                  <legend>Como restaurar</legend>
                  <label className="tipos-trabalho__opcao">
                    <input type="radio" name={`${base}-modo`} checked={modo === 'acrescentar'} onChange={() => setModo('acrescentar')} />
                    <span className="tipos-trabalho__nome">Manter os meus cadastros e só acrescentar o que falta</span>
                  </label>
                  <label className="tipos-trabalho__opcao">
                    <input type="radio" name={`${base}-modo`} checked={modo === 'substituir'} onChange={() => setModo('substituir')} />
                    <span className="tipos-trabalho__nome">Substituir pelos do backup{lido.previa.conflitos.length > 0 ? ' (os valores diferentes deste computador saem)' : ''}</span>
                  </label>
                </fieldset>
                <div className="dialogo__acoes">
                  <button type="button" className="btn-principal" disabled={ocupado} onClick={() => void restaurar()}>
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    disabled={ocupado}
                    onClick={() => {
                      setLido(null);
                      setMensagem({ texto: 'Restauração cancelada. Nada foi alterado.' });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            )}
            {!lido && (
              <div className="dialogo__acoes">
                <button type="button" className="btn-secundario" disabled={ocupado} onClick={p.aoFechar}>
                  Fechar
                </button>
              </div>
            )}
          </>
        )}
        {mensagem && (
          <p role="status" className={mensagem.erro ? 'aviso' : 'dica'}>
            {mensagem.texto}
          </p>
        )}
      </div>
    </dialog>
  );
}
