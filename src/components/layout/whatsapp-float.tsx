"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";

export type WhatsAppFloatOption = {
  id: string;
  title: string;
  description: string;
  href: string;
};

/**
 * Botão flutuante de WhatsApp exibido em todas as páginas públicas.
 * Em vez de abrir direto um número, abre uma escolha de atendimento
 * ("Como podemos ajudar?") e cada opção usa a finalidade correta do
 * sistema de contatos. As opções são resolvidas no layout com a mensagem
 * adequada ao cliente logado.
 */
export function WhatsAppFloat({
  options,
}: {
  options: WhatsAppFloatOption[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (options.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-20 right-4 z-[60] flex flex-col items-end gap-3 md:bottom-6 md:right-6"
    >
      {open ? (
        <div
          role="dialog"
          aria-label="Como podemos ajudar?"
          className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]">
                <WhatsAppIcon className="h-5 w-5" />
              </span>
              <p className="text-sm font-extrabold tracking-tight text-brand-ink">
                Como podemos ajudar?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar opções de WhatsApp"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand-faint transition hover:bg-brand-tint hover:text-brand-ink"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="grid gap-2 p-3">
            {options.map((option) => (
              <a
                key={option.id}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-brand-tint"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366] transition group-hover:bg-[#25D366] group-hover:text-white">
                  <WhatsAppIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-brand-ink">
                    {option.title}
                  </span>
                  <span className="block truncate text-xs text-brand-muted">
                    {option.description}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <span
          aria-hidden="true"
          className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-brand-ink shadow-[0_6px_18px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
        >
          Como podemos ajudar?
        </span>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          open
            ? "Fechar opções de WhatsApp"
            : "Fale conosco no WhatsApp - escolha o atendimento"
        }
        className="grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgba(37,211,102,0.45)] ring-4 ring-[#25D366]/20 transition duration-300 hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-[0_14px_30px_rgba(37,211,102,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:ring-offset-2"
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <WhatsAppIcon className="h-7 w-7" />
        )}
      </button>
    </div>
  );
}