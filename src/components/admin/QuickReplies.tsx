"use client";

/** Tap a ready-made answer to put it in the reply box (added after what is already written). */
export function QuickReplies({ items, target = "message" }: { items: string[]; target?: string }) {
  const insert = (text: string, el: HTMLElement) => {
    const box = el.closest("form")?.querySelector<HTMLTextAreaElement>(`textarea[name="${target}"]`);
    if (!box) return;
    box.value = box.value.trim() ? `${box.value.trim()}\n${text}` : text;
    box.focus();
  };
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer py-1 font-semibold">Quick replies (Kreyòl) · tap to add</summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((x) => (
          <button key={x} type="button" onClick={(e) => insert(x, e.currentTarget)} className="min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-left text-[13px] text-text hover:border-primary">{x}</button>
        ))}
      </div>
    </details>
  );
}
