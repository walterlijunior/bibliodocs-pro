// Folhas de estilo importadas por efeito colateral (main.tsx); o Vite as emite como arquivos .css do build.
declare module '*.css';

// Texto embutido pelo Vite (`?raw`): licenças no Sobre (M3-T11).
declare module '*.txt?raw' {
  const texto: string;
  export default texto;
}
