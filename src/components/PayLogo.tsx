/** MonCash / NatCash logos (public/brand), shown wherever customers pick or see a payment method. */
const LOGOS = {
  moncash: { src: "/brand/moncash.webp", alt: "MonCash", ratio: 391 / 96 },
  natcash: { src: "/brand/natcash.webp", alt: "NatCash", ratio: 370 / 96 },
} as const;

export function PayLogo({ brand, height = 24, className = "" }: { brand: keyof typeof LOGOS; height?: number; className?: string }) {
  const l = LOGOS[brand];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={l.src} alt={l.alt} width={Math.round(height * l.ratio)} height={height} className={`w-auto shrink-0 ${className}`} style={{ height }} />;
}
