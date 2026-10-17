import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicativo } from './Aplicativo';
import './estilos/tokens.css';
import './estilos/casca.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html.');

createRoot(raiz).render(
  <StrictMode>
    <Aplicativo api={window.bibliodocs} />
  </StrictMode>,
);
