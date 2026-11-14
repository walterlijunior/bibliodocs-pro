/**
 * Logotipo da instituição na janela do catálogo (Etapa 3; RN-118): escolher uma imagem PNG ou JPEG (até 2 MB), ver a
 * prévia e retirar. A imagem fica no catálogo deste computador e vai para a capa dos trabalhos da instituição.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Instituicao } from '../../aplicacao';
import { base64DosBytes, bytesDoLogotipo, BYTES_MAX_LOGOTIPO, hexDoHash, tipoDaImagem } from './logotipo';

export function LogotipoInstituicao(p: { instituicao: Instituicao; aoMudar: (logotipo: Instituicao['logotipo'] | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const logo = p.instituicao.logotipo;
  const url = useMemo(() => (logo ? URL.createObjectURL(new Blob([bytesDoLogotipo(logo.dados) as BlobPart], { type: logo.tipo })) : null), [logo]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="catalogo__logotipo">
      <span className="catalogo__rotulo">Logotipo para a capa dos trabalhos</span>
      {url ? <img src={url} alt={`Logotipo de ${p.instituicao.sigla}`} /> : <span className="dica">Sem logotipo: a capa sai sem o brasão.</span>}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (!arquivo) return;
          if (arquivo.size > BYTES_MAX_LOGOTIPO) return setAviso('A imagem passa de 2 MB.');
          const bytes = new Uint8Array(await arquivo.arrayBuffer());
          const tipo = tipoDaImagem(bytes);
          if (tipo === null) return setAviso('O arquivo não é uma imagem PNG ou JPEG.');
          const sha256 = hexDoHash(await crypto.subtle.digest('SHA-256', bytes));
          setAviso(null);
          p.aoMudar({ sha256, tipo, dados: base64DosBytes(bytes) });
        }}
      />
      <button type="button" className="btn-secundario" onClick={() => ref.current?.click()}>
        {logo ? 'Trocar logotipo…' : 'Escolher logotipo…'}
      </button>
      {logo && (
        <button type="button" className="btn-secundario" onClick={() => p.aoMudar(null)}>
          Retirar logotipo
        </button>
      )}
      <span className="dica" role="status">
        {aviso}
      </span>
    </div>
  );
}
