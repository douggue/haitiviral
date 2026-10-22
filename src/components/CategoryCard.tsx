import Image from "next/image";
import { Link } from "@/i18n/navigation";

/** Bright backgrounds in turn (used when a category has no background picture yet). */
const TINTS = [
  "linear-gradient(135deg,#fff4e0 0%,#ffd7a8 55%,#ffb36b 100%)",
  "linear-gradient(135deg,#eef3ff 0%,#cddcff 55%,#a9c2ff 100%)",
  "linear-gradient(135deg,#f6edff 0%,#ddc6ff 55%,#bf98ff 100%)",
  "linear-gradient(135deg,#eafff3 0%,#bff2d6 55%,#8be3b5 100%)",
];

/**
 * Category card (Admin → Products → categories):
 * - cover: big picture filling the whole card (falls back to a colored gradient)
 * - image: small square picture in the white tile (falls back to the emoji icon)
 * The name and product count sit bottom-left: white on a dark bottom fade when there is a picture, dark on the plain gradient otherwise.
 */
export function CategoryCard({
  href, name, count, cover, image, icon, index, sub,
}: { href: string; name: string; count: string; cover?: string | null; image?: string | null; icon?: string | null; index: number; sub?: string }) {
  return (
    <Link
      href={href}
      className="lift animate-rise group relative flex min-h-[8.25rem] flex-col sm:aspect-[16/10] sm:min-h-0 justify-between overflow-hidden rounded-[var(--radius-card,1rem)] p-3 text-[#0b1426] shadow-[0_14px_34px_-22px_rgba(10,20,50,.6)] ring-1 ring-black/5 sm:p-5"
      style={{ background: TINTS[index % TINTS.length] }}
    >
      {cover && (
        <>
          <Image src={cover} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="ds-hide object-cover transition-transform duration-500 group-hover:scale-105" />
          {/* Dark fade from the bottom so the white name stays readable on any picture, however busy or bright */}
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,11,26,.92)_0%,rgba(6,11,26,.7)_30%,rgba(6,11,26,.15)_58%,transparent_75%)]" />
        </>
      )}
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white/95 text-2xl shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl" aria-hidden>
        {image ? <Image src={image} alt="" fill sizes="56px" className="object-cover" /> : icon || "🎮"}
      </span>
      <span className={`relative min-w-0 ${cover ? "max-w-full text-white [text-shadow:0_2px_10px_rgba(0,0,0,.7)]" : "max-w-[68%]"}`}>
        <span className="display block text-sm font-bold leading-tight sm:text-xl">{name}</span>
        <span className={`mt-0.5 block text-[11px] font-medium sm:text-sm ${cover ? "text-white/85" : "text-[#3b4870]"}`}>{count}</span>
        {sub && <span className={`mt-1 hidden truncate text-xs sm:block ${cover ? "text-white/80" : "text-[#3b4870]"}`}>{sub}</span>}
      </span>
    </Link>
  );
}
