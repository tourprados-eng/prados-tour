"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";

export function CardPaymentLinkButton({ invoiceUrl }: { invoiceUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!invoiceUrl) {
    return null;
  }

  async function handleCopy() {
    if (!invoiceUrl) return;
    try {
      await navigator.clipboard.writeText(invoiceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button href={invoiceUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLinkIcon className="h-4 w-4" />
        Pagar com cartão
      </Button>
      <Button variant="ghost" onClick={handleCopy}>
        <CopyIcon className="h-4 w-4" />
        {copied ? "Link copiado" : "Copiar link"}
      </Button>
    </div>
  );
}
