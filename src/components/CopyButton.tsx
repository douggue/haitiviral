"use client";
import { useState } from "react";
import { CopyIcon } from "./Icons";

export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary min-h-9 shrink-0 px-3 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      <CopyIcon width={14} height={14} /> {copied ? done : label}
    </button>
  );
}
