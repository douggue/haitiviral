"use client";
import { useState } from "react";
import Image from "next/image";
import { ProductArt } from "./ProductArt";

/** Main image with thumbnails. Falls back to the generated tile when the product has no photos. */
export function ProductGallery({ name, accent, images }: { name: string; accent?: string | null; images: string[] }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return <ProductArt name={name} accent={accent} size="lg" />;
  return (
    <div className="space-y-3">
      <ProductArt name={name} accent={accent} image={images[active]} size="lg" priority />
      {images.length > 1 && (
        <div className="ds-hide flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${name} ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
