"use client";

import { useState } from "react";

export function CardInvoiceLink({ invoiceUrl }: { invoiceUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invoiceUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={invoiceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
      >
        Abrir link de pagamento
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-xs font-semibold hover:bg-black/5"
      >
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
