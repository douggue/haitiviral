/** Uploaded logo (Settings → Brand images) or the built-in Haiti Gaming logo (blue/red controller + HAITI GAMING). */
export function Logo({ className = "", src, darkSrc, alt = "Haiti Gaming" }: { className?: string; src?: string; darkSrc?: string; alt?: string }) {
  if (src) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`h-8 w-auto max-w-[160px] object-contain ${darkSrc ? "dark:hidden" : ""}`} />
        {darkSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={darkSrc} alt={alt} className="hidden h-8 w-auto max-w-[160px] object-contain dark:block" />
        )}
      </span>
    );
  }
  // Built-in logo (public/brand): full logo, or the controller alone on very narrow phones.
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.webp" alt={alt} width={151} height={36} className="h-8 w-auto max-[349px]:hidden min-[400px]:h-9" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.webp" alt={alt} width={49} height={32} className="hidden h-8 w-auto max-[349px]:block" />
    </span>
  );
}
