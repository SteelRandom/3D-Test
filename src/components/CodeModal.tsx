import { useEffect, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';

interface CodeModalProps {
  open: boolean;
  htmlCode: string;
  onClose: () => void;
  onDownload: () => void;
}

export function CodeModal({
  open,
  htmlCode,
  onClose,
  onDownload,
}: CodeModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback via textarea selection
      const ta = document.createElement('textarea');
      ta.value = htmlCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-modal-title"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <h2
              id="code-modal-title"
              className="truncate text-base font-semibold text-white"
            >
              Archivo único HTML (Three.js + Cannon-es)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Contiene HTML, CSS y JS con importmap desde CDN listo para ejecutar
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onDownload}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar .html
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar visor"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <pre className="font-mono flex-1 overflow-auto bg-slate-950 p-4 text-xs leading-relaxed text-slate-200">
          <code>{htmlCode}</code>
        </pre>
      </div>
    </div>
  );
}
