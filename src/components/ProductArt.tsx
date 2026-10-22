import Image from "next/image";

/** Original artwork: an accent-colored tile with the product's initials, so no third-party imagery is needed. */
export function ProductArt({ name, accent, image, size = "md", priority = false }: { name: string; accent?: string | null; image?: string | null; size?: "md" | "lg"; priority?: boolean }) {
  if (image) {
    return (
      <div className={`relative aspect-[4/3] overflow-hidden bg-surface-2 ${size === "lg" ? "rounded-3xl" : "rounded-xl"}`}>
        <Image
          src={image}
          alt={name}
          fill
          priority={priority}
          sizes={size === "lg" ? "(min-width: 1024px) 45vw, 100vw" : "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"}
          className="object-cover"
        />
      </div>
    );
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const color = accent ?? "#1467F5";
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${size === "lg" ? "aspect-[4/3] rounded-3xl" : "aspect-[4/3] rounded-xl"}`}
      style={{ background: `radial-gradient(circle at 50% 42%, ${color} 0%, color-mix(in srgb, ${color} 45%, #060b1a) 55%, #060b1a 100%)` }}
      aria-hidden
    >
      <div className="absolute inset-x-6 bottom-0 h-1/3 rounded-full bg-black/25 blur-2xl" />
      <span className={`display relative font-bold tracking-tight text-white [text-shadow:0_6px_24px_rgba(0,0,0,.35)] ${size === "lg" ? "text-7xl" : "text-4xl"}`}>{initials}</span>
    </div>
  );
}
