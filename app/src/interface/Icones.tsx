// Ícones SVG originais do BiblioDocs Pro (desenhados no protótipo da Etapa 4; nenhum pacote de terceiros).
// Os símbolos ficam num único <svg> oculto e são reaproveitados por <use href="#...">.

export const NOMES_ICONES = [
  'anterior',
  'proxima',
  'preview',
  'lista',
  'grade',
  'busca',
  'esq',
  'dir',
  'relogio',
  'doc',
  'pilha',
  'pasta',
  'mais',
  'ok',
  'alerta',
  'erro',
] as const;

export type NomeIcone = (typeof NOMES_ICONES)[number];

/** Desenho de cada ícone num quadro 24×24. */
const DESENHOS: Readonly<Record<NomeIcone, readonly string[]>> = {
  anterior: ['M11 5v14L2 12zM21 5v14l-9-7z'],
  proxima: ['M13 5v14l9-7zM3 5v14l9-7z'],
  preview: ['M6 2h9l5 5v15H6zM14 3v5h5'],
  lista: ['M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z'],
  grade: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  busca: ['M10 3a7 7 0 015.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z'],
  esq: ['M15 4l1.4 1.4L9.8 12l6.6 6.6L15 20l-8-8z'],
  dir: ['M9 4L7.6 5.4l6.6 6.6-6.6 6.6L9 20l8-8z'],
  relogio: ['M12 2a10 10 0 110 20 10 10 0 010-20zm0 2a8 8 0 100 16 8 8 0 000-16zm-1 3h2v5.4l3.5 2.1-1 1.7L11 13.6z'],
  doc: ['M6 2h9l5 5v15H6zm8 1.5V8h4.5z'],
  pilha: ['M3 5h18v3H3zM3 10h18v3H3zM3 15h18v3H3z'],
  pasta: ['M2 5h7l2 2h11v13H2z'],
  mais: ['M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z'],
  ok: ['M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'],
  alerta: ['M12 2L1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z'],
  erro: ['M12 2a10 10 0 110 20 10 10 0 010-20zm-1 5v7h2V7zm0 9v2h2v-2z'],
};

/** Símbolos usados pela interface; renderizado uma vez na raiz do aplicativo. */
export function SimbolosSvg() {
  return (
    <svg width="0" height="0" className="sr-only" aria-hidden="true" focusable="false">
      <defs>
        {/* Pequi: meia casca verde (corte em creme) com três caroços de polpa. Desenho original (Etapa 4). */}
        <symbol id="pequi" viewBox="0 0 64 64">
          <ellipse cx="32" cy="37" rx="27" ry="6" fill="var(--cor-pequi-miolo)" stroke="var(--cor-pequi-casca-escura)" strokeWidth="1.5" />
          <ellipse cx="19" cy="31" rx="10" ry="12.5" fill="var(--cor-pequi-polpa)" stroke="var(--cor-pequi-polpa-escura)" strokeWidth="1.5" />
          <ellipse cx="45" cy="31" rx="10" ry="12.5" fill="var(--cor-pequi-polpa)" stroke="var(--cor-pequi-polpa-escura)" strokeWidth="1.5" />
          <ellipse cx="32" cy="27" rx="11" ry="14" fill="var(--cor-pequi-polpa)" stroke="var(--cor-pequi-polpa-escura)" strokeWidth="1.5" />
          <path d="M26 19 q3 -5 8 -4" fill="none" stroke="var(--cor-pequi-brilho)" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M5 37 A27 6 0 0 0 59 37 A27 23 0 0 1 5 37 Z"
            fill="var(--cor-pequi-casca)"
            stroke="var(--cor-pequi-casca-escura)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M6.5 38.5 A26 5 0 0 0 57.5 38.5" fill="none" stroke="var(--cor-pequi-miolo)" strokeWidth="2.4" />
          <path
            d="M14 47 q4 6 10 8 M50 47 q-4 6 -10 8"
            fill="none"
            stroke="var(--cor-pequi-casca-escura)"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />
        </symbol>
        {NOMES_ICONES.map((nome) => (
          <symbol key={nome} id={`i-${nome}`} viewBox="0 0 24 24">
            {DESENHOS[nome].map((d) => (
              <path key={d} d={d} />
            ))}
            {nome === 'preview' && <path d="M9 12h8v1.6H9zM9 15h8v1.6H9zM9 18h5v1.6H9z" fill="var(--cor-barras)" />}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/** Ícone decorativo: o nome acessível fica no controle que o contém. */
export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg aria-hidden="true" focusable="false">
      <use href={`#i-${nome}`} />
    </svg>
  );
}

/** Pequi decorativo (estado vazio) ou com nome acessível (visor). */
export function Pequi({ className, rotulo }: { className?: string; rotulo?: string }) {
  return rotulo === undefined ? (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <use href="#pequi" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={rotulo}>
      <use href="#pequi" />
    </svg>
  );
}
