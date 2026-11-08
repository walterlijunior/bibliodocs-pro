/**
 * Janela da figura (M5-T06; RF-10): imagem PNG ou JPEG, espécie, título, largura, fonte e nota. Mostra a imagem, o
 * tamanho em pixels, a largura impressa e a resolução efetiva, com o aviso abaixo de 150 ppi (RNF-17, D-M5-09). Só a
 * figura que o formato aceita vai para o texto. Texto sempre como texto (nunca HTML).
 *
 * A imagem escolhida só entra no trabalho ao confirmar (`aoConfirmar` leva os bytes novos); cancelar não deixa nada.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  avaliarImagem,
  ESPECIES_FIGURA,
  LARGURA_FIGURA_MM,
  lerInfoImagem,
  rascunhoDeFigura,
  rascunhoFiguraNova,
  validarFigura,
  type DadosFigura,
  type InfoImagem,
  type RascunhoFigura,
} from '../../aplicacao';
import type { EspecieIlustracao } from '../../dominio/modelo';
import { Icone } from '../Icones';

/** Teto do arquivo escolhido (o do formato é 64 MB; acima disto a janela recusa antes de ler). */
const LIMITE_BYTES_IMAGEM = 64 * 1024 * 1024;

export interface ImagemEscolhida {
  bytes: Uint8Array;
  sha256: string;
}

export interface PropsDialogoFigura {
  /** Figura a alterar; `null` = nova. */
  inicial: DadosFigura | null;
  /** Bytes de uma imagem que já está no trabalho. */
  lerMidia: (sha256: string) => Uint8Array | null;
  /** `imagem`: os bytes novos, quando o arquivo foi escolhido nesta janela. */
  aoConfirmar: (dados: DadosFigura, imagem: ImagemEscolhida | null) => void;
  aoFechar: () => void;
}

const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export function DialogoFigura(p: PropsDialogoFigura) {
  const ref = useRef<HTMLDialogElement>(null);
  const refArquivo = useRef<HTMLInputElement>(null);
  const base = useId();
  const nova = p.inicial === null;
  const [r, setR] = useState<RascunhoFigura>(() => (p.inicial ? rascunhoDeFigura(p.inicial) : rascunhoFiguraNova()));
  const [escolhida, setEscolhida] = useState<ImagemEscolhida | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [larguraTexto, setLarguraTexto] = useState(() => (p.inicial?.larguraMm !== undefined ? String(p.inicial.larguraMm) : ''));

  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('button, input, select')?.focus();
    }
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  const bytes = escolhida?.bytes ?? (r.midia !== null ? p.lerMidia(r.midia) : null);
  const info: InfoImagem | null = useMemo(() => (bytes ? lerInfoImagem(bytes) : null), [bytes]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes || !info) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: info.tipo }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, info]);

  const avaliacao = bytes && info ? avaliarImagem(info, bytes, r.larguraMm) : null;
  const validacao = validarFigura(r);
  const nome = ESPECIES_FIGURA.find((e) => e.especie === r.especie)?.nome ?? 'Figura';

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > LIMITE_BYTES_IMAGEM) {
      setErroArquivo(`“${arquivo.name}” passa de ${LIMITE_BYTES_IMAGEM / 1024 / 1024} MB.`);
      return;
    }
    const lidos = new Uint8Array(await arquivo.arrayBuffer());
    if (lerInfoImagem(lidos) === null) {
      setErroArquivo(`“${arquivo.name}” não é uma imagem PNG ou JPEG que o app consiga ler.`);
      return;
    }
    const sha256 = hex(await crypto.subtle.digest('SHA-256', lidos));
    setErroArquivo(null);
    setEscolhida({ bytes: lidos, sha256 });
    setR((x) => ({ ...x, midia: sha256 }));
  };

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--tabela"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={p.aoFechar}
    >
      <form
        className="dialogo__corpo"
        aria-labelledby={`${base}-titulo`}
        onSubmit={(e) => {
          e.preventDefault();
          if (validacao.ok) p.aoConfirmar(validacao.dados, escolhida);
        }}
      >
        <h2 id={`${base}-titulo`}>{nova ? 'Inserir figura' : `Alterar ${nome.toLowerCase()}`}</h2>

        <fieldset className="elemento__grupo figura-edicao__imagem">
          <legend>Imagem</legend>
          <div className="tabela-planilha__entrada">
            <button type="button" className="btn-secundario" onClick={() => refArquivo.current?.click()}>
              {r.midia === null ? 'Escolher imagem…' : 'Trocar imagem…'}
            </button>
            <input
              ref={refArquivo}
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              hidden
              aria-label="Arquivo de imagem"
              onChange={(ev) => {
                const arquivo = ev.target.files?.[0];
                ev.target.value = '';
                void escolher(arquivo);
              }}
            />
            <span className="dica">PNG ou JPEG. Para impressão nítida, pelo menos 150 ppi no tamanho em que a figura sai.</span>
          </div>
          {erroArquivo !== null && (
            <p className="aviso aviso--erro" role="alert">
              <Icone nome="erro" />
              <span className="aviso__texto">{erroArquivo}</span>
            </p>
          )}
          {url !== null && info !== null && avaliacao !== null && (
            <>
              <div className="figura-edicao__previa">
                <img src={url} alt={r.titulo.texto || 'Imagem escolhida'} className="figura-edicao__img" />
              </div>
              <p className="dica" role="status">
                {info.larguraPx} × {info.alturaPx} px{info.ppi !== null ? `, ${Math.round(info.ppi)} ppi no arquivo` : ''}. Sai com {avaliacao.larguraMm.toFixed(0)} mm de largura,
                a {Math.floor(avaliacao.ppi + 1e-6)} ppi.
              </p>
              {avaliacao.aviso !== null && (
                <p className="aviso">
                  <Icone nome="alerta" />
                  <span className="aviso__texto">Resolução baixa: {avaliacao.aviso}</span>
                </p>
              )}
            </>
          )}
        </fieldset>

        <div className="elemento__campo">
          <label htmlFor={`${base}-especie`}>Espécie</label>
          <select
            id={`${base}-especie`}
            className="campo"
            value={r.especie}
            aria-describedby={`${base}-especie-dica`}
            onChange={(ev) => setR({ ...r, especie: ev.target.value as EspecieIlustracao })}
          >
            {ESPECIES_FIGURA.map((e) => (
              <option key={e.especie} value={e.especie}>
                {e.nome}
              </option>
            ))}
          </select>
          <span id={`${base}-especie-dica`} className="dica">
            A palavra que vem antes do número. Cada espécie numera à parte: Fotografia 1, Figura 1, Gráfico 1.
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-titulo-campo`}>Título</label>
          <input
            id={`${base}-titulo-campo`}
            className="campo"
            value={r.titulo.texto}
            aria-describedby={`${base}-titulo-dica`}
            onChange={(ev) => setR({ ...r, titulo: { ...r.titulo, texto: ev.target.value } })}
          />
          <span id={`${base}-titulo-dica`} className="dica">
            Sem o número: “{nome} 1 –” é posto sozinho, na ordem do texto.
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-largura`}>Largura (mm)</label>
          <input
            id={`${base}-largura`}
            className="campo campo--curto"
            inputMode="numeric"
            value={larguraTexto}
            aria-describedby={`${base}-largura-dica`}
            onChange={(ev) => {
              const t = ev.target.value.trim();
              setLarguraTexto(ev.target.value);
              setR({ ...r, larguraMm: t === '' ? null : Number(t.replace(',', '.')) });
            }}
          />
          <span id={`${base}-largura-dica`} className="dica">
            Em branco: o tamanho natural da imagem, até a largura do texto ({avaliacao ? avaliacao.areaUtilMm.toFixed(0) : '160'} mm). De {LARGURA_FIGURA_MM.minimo} a{' '}
            {LARGURA_FIGURA_MM.maximo} mm.
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-fonte`}>Fonte</label>
          <input
            id={`${base}-fonte`}
            className="campo"
            value={r.fonte.texto}
            aria-describedby={`${base}-fonte-dica`}
            onChange={(ev) => setR({ ...r, fonte: { ...r.fonte, texto: ev.target.value } })}
          />
          <span id={`${base}-fonte-dica`} className="dica">
            Depois de “Fonte:”. Obrigatória mesmo quando a imagem é sua. Ex.: Elaborada pelo autor (2026).
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-nota`}>Nota</label>
          <textarea id={`${base}-nota`} className="campo" rows={2} value={r.nota.texto} onChange={(ev) => setR({ ...r, nota: { ...r.nota, texto: ev.target.value } })} />
        </div>

        {!validacao.ok && (
          <ul className="avisos" aria-label="O que impede gravar a figura">
            {validacao.erros.map((e) => (
              <li key={`${e.campo}-${e.mensagem}`} className="aviso aviso--erro">
                <Icone nome="erro" />
                <span className="aviso__texto">
                  {e.campo}: {e.mensagem}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="dialogo__acoes">
          <button type="submit" className="btn-principal" disabled={!validacao.ok}>
            {nova ? 'Inserir figura' : `Alterar ${nome.toLowerCase()}`}
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
