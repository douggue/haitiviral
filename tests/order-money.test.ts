import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getBalances, post, systemAccount, walletAccount } from "@/lib/ledger";
import { chargeOrder, refundPart } from "@/lib/wallet";
import { onceOnly, refundOrCancel } from "@/lib/orders";

afterAll(() => prisma.$disconnect());

/** A customer with 500 HTG and a paid 2-line order of 300 HTG (200 + 100), or a free order. */
async function setup(opts: { total?: number } = {}) {
  const total = opts.total ?? 300_00;
  const user = await prisma.user.create({ data: { id: `u_${Math.random().toString(36).slice(2)}`, name: "Money Test", email: `${Math.random()}@t.test` } });
  await prisma.$transaction(async (tx) => {
    const w = await walletAccount(tx, user.id, "HTG");
    const c = await systemAccount(tx, "clearing", "HTG", "test");
    await post(tx, { type: "DEPOSIT", idempotencyKey: `f:${user.id}`, description: "t", entries: [{ accountId: c.id, currency: "HTG", amount: -500_00 }, { accountId: w.id, currency: "HTG", amount: 500_00 }] });
  });
  const category = await prisma.category.upsert({ where: { slug: "test-cat" }, create: { slug: "test-cat", name: { en: "Test" } }, update: {} });
  const product = await prisma.product.create({ data: { slug: `p-${Math.random().toString(36).slice(2)}`, categoryId: category.id, name: { en: "P" }, description: {}, isPublished: true, variants: { create: { name: { en: "V" }, priceHtg: 100_00 } } }, include: { variants: true } });
  const v = product.variants[0].id;
  const order = await prisma.order.create({
    data: {
      userId: user.id, currency: "HTG", subtotal: total, total, paymentMethod: "WALLET", accessToken: `t${Math.random()}`, status: "PROCESSING", paidAt: new Date(),
      items: { create: total ? [
        { variantId: v, productName: { en: "P" }, variantName: { en: "A" }, quantity: 1, unitPrice: 200_00 },
        { variantId: v, productName: { en: "P" }, variantName: { en: "B" }, quantity: 1, unitPrice: 100_00 },
      ] : [{ variantId: v, productName: { en: "P" }, variantName: { en: "Trial" }, quantity: 1, unitPrice: 0 }] },
    },
    include: { items: true },
  });
  if (total) await prisma.$transaction((tx) => chargeOrder(tx, order));
  return { order, userId: user.id };
}

const balance = async (userId: string) => (await getBalances(prisma, userId)).HTG.available;

describe("refunds never pay more than the order", () => {
  it("a pack line refunded first, then the whole order: total back = order total", async () => {
    const { order, userId } = await setup();
    expect(await balance(userId)).toBe(200_00);
    // line B (100 HTG) not delivered: refunded alone
    await prisma.$transaction(async (tx) => {
      await refundPart(tx, order, 100_00, order.items[1].id, "line failed");
      await tx.orderItem.update({ where: { id: order.items[1].id }, data: { status: "FAILED" } });
    });
    expect(await balance(userId)).toBe(300_00);
    // then the whole order is refunded (staff or auto-refund)
    expect(await refundOrCancel(order.id, null, "nothing delivered")).toBe("refunded");
    expect(await balance(userId)).toBe(500_00); // was 600 before the fix
  });

  it("a partial refund can't exceed what's left", async () => {
    const { order, userId } = await setup();
    await prisma.$transaction((tx) => refundPart(tx, order, 250_00, order.items[0].id, "a"));
    await prisma.$transaction((tx) => refundPart(tx, order, 250_00, order.items[1].id, "b"));
    expect(await balance(userId)).toBe(500_00); // 300 back, not 500
  });

  it("refunding twice is a no-op", async () => {
    const { order, userId } = await setup();
    await refundOrCancel(order.id, null, "x");
    await expect(refundOrCancel(order.id, null, "x")).rejects.toThrow();
    expect(await balance(userId)).toBe(500_00);
  });
});

describe("free orders (trials)", () => {
  it("a refused free order is canceled, not stuck", async () => {
    const { order, userId } = await setup({ total: 0 });
    expect(await refundOrCancel(order.id, null, "provider refused")).toBe("canceled");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELED");
    expect(await balance(userId)).toBe(500_00);
  });
});

describe("double tap (onceOnly)", () => {
  it("the same requestId returns the first order and never creates a second", async () => {
    const { userId } = await setup();
    let created = 0;
    const rid = `req${Math.random().toString(36).slice(2, 12)}`;
    const make = () => onceOnly(userId, rid, async () => {
      created++;
      return prisma.order.create({ data: { userId, currency: "HTG", subtotal: 1, total: 1, paymentMethod: "WALLET", accessToken: `t${Math.random()}`, requestId: rid } });
    });
    const [a, b] = await Promise.all([make(), make()]);
    expect(a.id).toBe(b.id);
    expect(await prisma.order.count({ where: { requestId: rid } })).toBe(1);
    const c = await make();
    expect(c.id).toBe(a.id);
    expect(created).toBeGreaterThanOrEqual(1);
  });
});
