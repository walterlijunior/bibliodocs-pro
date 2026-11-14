/**
 * Ajuda contextual (Etapa 2 da especificação de atualização): botão "?" ao lado de um recurso, com um texto curto sobre
 * para que serve, quando usar e como começar.
 *
 * - Abre e fecha pelo clique, por Enter ou Espaço (é um botão com `aria-expanded`), e aparece ao passar o mouse.
 * - Esc fecha (com o foco no botão ou no editor: o clique no "?" não tira o foco do texto); clicar fora fecha a que foi
 *   aberta pelo clique. Na metade direita da janela, o balão abre para a esquerda.
 * - Aberto, o texto fica num elemento ligado ao botão por `aria-controls` e `aria-describedby`; fechado, não está na
 *   página (nem na árvore de acessibilidade, nem na busca de texto).
 * - O clique não tira o foco do editor (`mousedown` cancelado), como nos botões da barra de formatação.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface PropsAjudaContextual {
  /** Nome do recurso ("Parágrafo"): o botão se chama "Ajuda: Parágrafo". */
  titulo: string;
  /** Balão alinhado pela direita do botão (perto da borda direita da janela). */
  aDireita?: boolean;
  children: ReactNode;
}

type Abertura = 'clique' | 'passar' | null;

export function AjudaContextual({ titulo, aDireita, children }: PropsAjudaContextual) {
  const [aberta, setAberta] = useState<Abertura>(null);
  // Balão para a esquerda quando o botão está na metade direita da janela (não sai da tela nem cria rolagem).
  const [paraEsquerda, setParaEsquerda] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const refBotao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberta === null) return;
    const r = ref.current?.getBoundingClientRect();
    setParaEsquerda(r !== undefined && r.left > window.innerWidth / 2);
    // Esc fecha mesmo com o foco em outro lugar (o clique no "?" não tira o foco do editor).
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAberta(null);
    };
    const fora = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) setAberta(null);
    };
    document.addEventListener('keydown', tecla, true);
    if (aberta === 'clique') document.addEventListener('pointerdown', fora);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('pointerdown', fora);
    };
  }, [aberta]);

  return (
    <span
      ref={ref}
      className={`ajuda-ctx${aDireita || paraEsquerda ? ' ajuda-ctx--direita' : ''}`}
      onMouseEnter={() => setAberta((a) => a ?? 'passar')}
      onMouseLeave={() => setAberta((a) => (a === 'passar' ? null : a))}
    >
      <button
        ref={refBotao}
        type="button"
        className="ajuda-ctx__botao"
        aria-label={`Ajuda: ${titulo}`}
        aria-expanded={aberta !== null}
        aria-controls={aberta !== null ? id : undefined}
        aria-describedby={aberta !== null ? id : undefined}
        title={`Ajuda: ${titulo}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setAberta((a) => (a === 'clique' ? null : 'clique'))}
      >
        ?
      </button>
      {/* Só na página quando aberto: o texto escondido não entra na busca da página nem nas leituras de texto. */}
      {aberta !== null && (
        <span id={id} role="note" className="ajuda-ctx__balao">
          <span className="ajuda-ctx__titulo">{titulo}</span>
          {children}
        </span>
      )}
    </span>
  );
}

/** Parágrafo do texto da ajuda (o balão é inline: `<p>` não cabe dentro de botões nem de títulos). */
export function TextoAjuda({ children }: { children: ReactNode }) {
  return <span className="ajuda-ctx__texto">{children}</span>;
}
