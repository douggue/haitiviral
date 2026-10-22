import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { minPrice, type ProductWithVariants } from "@/lib/catalog";
import { t } from "@/lib/text";
import { Price } from "./Money";
import { BoltIcon } from "./Icons";
import { ProductArt } from "./ProductArt";

export { ProductArt };

export async function ProductCard({ product }: { product: ProductWithVariants }) {
  const locale = await getLocale();
  const tr = await getTranslations("common");
  const tp = await getTranslations("product");
  const name = t(product.name, locale);
  const onSale = product.variants.some((v) => v.salePriceHtg);
  return (
    <Link href={`/products/${product.slug}`} className="card lift animate-rise group flex flex-col bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] p-3">
      <div className="relative">
        <ProductArt name={name} accent={product.accent} image={product.image} />
        {onSale && <span className="badge absolute left-2 top-2 bg-danger text-white">−%</span>}
        {product.tags?.[0] && <span className="badge absolute right-2 top-2 bg-[#060b1a]/60 text-[11px] text-white backdrop-blur">{product.tags.slice(0, 2).join(" · ")}</span>}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <h3 className="line-clamp-2 font-semibold leading-snug">{name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          {product.fulfillmentType === "CODE_INVENTORY" ? (
            <><BoltIcon width={13} height={13} className="text-success" /> {tp("instant")}</>
          ) : (
            t(product.deliveryEstimate, locale)
          )}
        </p>
        <div className="mt-auto flex flex-col gap-2.5 pt-3">
          <p className="text-sm">
            <span className="text-muted">{tr("from")} </span>
            <Price htg={minPrice(product)} className="font-bold text-text" />
          </p>
          {product.variants.length > 0 && product.variants.every((v) => v.soldOut) ? (
            <span className="flex min-h-10 w-full items-center justify-center rounded-xl bg-surface-2 px-3 text-sm font-bold text-danger">{tp("soldOut")}</span>
          ) : (
            <span className="flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-white transition-colors group-hover:bg-primary-hover">{tr("choose")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
