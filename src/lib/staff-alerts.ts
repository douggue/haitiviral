import "server-only";
import { prisma } from "./db";
import { can, isStaff, type Permission } from "./permissions";
import { sendPush } from "./push";

/**
 * Alerts for the owner and staff, on the phones where they turned on "Alerts on this phone" in the admin.
 * Each alert goes to the staff who can act on it (e.g. deposits → payments.review). Never throws.
 * `tag` groups repeats: a phone shows the latest alert of a tag instead of piling them up.
 */
export async function alertStaff(permission: Permission, msg: { title: string; body: string; url: string; tag: string }) {
  try {
    const withPush = new Set((await prisma.pushSubscription.findMany({ where: { user: { role: { not: "CUSTOMER" } } }, select: { userId: true }, distinct: ["userId"] })).map((s) => s.userId));
    const staff = await prisma.user.findMany({ where: { role: { not: "CUSTOMER" }, status: "ACTIVE", id: { in: [...withPush] } }, select: { id: true, role: true, customRoleId: true } });
    const roles = new Map((await prisma.customRole.findMany({ select: { id: true, permissions: true } })).map((r) => [r.id, r.permissions]));
    const targets = staff.filter((u) => isStaff(u.role) && can({ role: u.role, permissions: u.customRoleId ? roles.get(u.customRoleId) ?? [] : [] }, permission));
    await Promise.all(targets.map((u) => sendPush(u.id, { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag })));
  } catch (e) {
    console.error("staff alert failed", e);
  }
}

/**
 * Alerts that come from a regular check (cron): sent at most once per `everyMinutes` for the same key, so the owner
 * gets one "3 orders stuck" message, not one every 5 minutes.
 */
export async function alertStaffOnce(key: string, everyMinutes: number, permission: Permission, msg: { title: string; body: string; url: string }) {
  const settingKey = `alert:${key}`;
  await prisma.siteSetting.createMany({ data: [{ key: settingKey, value: { at: new Date(0).toISOString() } }], skipDuplicates: true });
  // Atomic: only the first caller in the period gets to send.
  const n = await prisma.$executeRaw`UPDATE "SiteSetting" SET value = jsonb_build_object('at', ${new Date().toISOString()}::text) WHERE key = ${settingKey} AND (value->>'at')::timestamptz < now() - make_interval(mins => ${everyMinutes})`;
  if (n !== 1) return false;
  await alertStaff(permission, { ...msg, tag: key });
  return true;
}
