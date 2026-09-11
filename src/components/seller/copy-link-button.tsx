"use client";

import { useRef, useState } from "react";
import { Link as LinkIcon, Check } from "lucide-react";

export function CopyLinkButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      ref.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-black/10 bg-[#FAF7F8] px-3 py-2.5 font-mono text-sm text-[#5C4B53] outline-none focus:border-[#E84C91]"
      />
      <button
        type="button"
        onClick={copy}
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${
          copied
            ? "bg-emerald-100 text-emerald-700"
            : "bg-[#FCE4EE] text-[#C52D70] hover:bg-[#FBD0E1]"
        }`}
      >
        {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
        {copied ? "Copiado!" : label}
      </button>
    </div>
  );
}