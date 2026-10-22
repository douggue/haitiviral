import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { ExchangeEditor } from "@/components/admin/ExchangeEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Money exchange" };

const nameOf = (n: unknown) => ((n ?? {}) as Record<string, string>).ht || ((n ?? {}) as Record<string, string>).fr || "—";

export default async function MoneyExchange() {
  await requireStaff("settings.manage");
  const settings = await getSettings();
  const p = settings.moneyExchange;
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, parentId: true } }),
    p.categoryId
      ? prisma.product.findMany({
          where: { OR: [{ categoryId: p.categoryId }, { category: { parentId: p.categoryId } }] },
          select: { id: true, name: true, isPublished: true },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const options = categories.map((c) => {
    const parent = categories.find((x) => x.id === c.parentId);
    return { id: c.id, name: parent ? `${nameOf(parent.name)} › ${nameOf(c.name)}` : nameOf(c.name) };
  });
  return (
    <>
      <PageTitle title="Money exchange" sub="One set of rules for every product in your exchange category: the customer types the USD amount, the page shows the rate, the fee and the price in HTG." />
      <ExchangeEditor initial={p} categories={options} />
      <section className="card mt-6 p-5 text-sm">
        <h2 className="font-bold">Products following these rules</h2>
        {!p.categoryId ? (
          <p className="mt-2 text-muted">Pick the exchange category above and save.</p>
        ) : products.length === 0 ? (
          <p className="mt-2 text-muted">No products in this category yet. Add one in Products and choose this category.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {products.map((x) => (
              <li key={x.id}>
                <a className="font-semibold text-primary underline" href={`/admin/products/${x.id}`}>{nameOf(x.name)}</a>
                {!x.isPublished && <span className="ml-2 text-muted">(not published)</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">For the "account / email / merutag" box, add a customer field on each product (see the customer fields guide).</p>
      </section>
    </>
  );
}
