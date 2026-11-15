// Folhas de estilo importadas por efeito colateral (main.tsx); o Vite as emite como arquivos .css do build.
declare module '*.css';

// Texto embutido pelo Vite (`?raw`): licenças no Sobre (M3-T11).
declare module '*.txt?raw' {
  const texto: string;
  export default texto;
}

// Endereço de um arquivo do build (`?url`): o worker do pdf.js (ficha catalográfica em PDF, D-E3-04).
declare module '*?url' {
  const url: string;
  export default url;
}
