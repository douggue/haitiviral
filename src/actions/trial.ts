"use server";
import { z } from "zod";
import { assertUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { requestTrial, TrialError } from "@/lib/trials";

const input = z.object({
  offer: z.string().max(40), link: z.string().max(500), phone: z.string().max(30).optional(),
  localId: z.string().max(64).optional(), fp: z.string().max(64).optional(), captcha: z.string().max(2048).optional(),
});

type Result = { ok: true; status: string; code: string | null; wa: string | null } | { ok: false; error: string };

/** Free trial request (mockup "Eseye gratis"). */
export async function submitTrial(raw: unknown): Promise<Result> {
  let user;
  try {
    user = await assertUser();
  } catch {
    return { ok: false, error: "signin" };
  }
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "link" };
  try {
    const r = await requestTrial(user.id, parsed.data);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof TrialError) return { ok: false, error: e.code };
    console.error("submitTrial failed", e);
    return { ok: false, error: "generic" };
  }
}

/** The trial page asks this every few seconds while it waits for the WhatsApp code. */
export async function trialStatus(): Promise<string | null> {
  try {
    const user = await assertUser();
    const t = await prisma.trialRequest.findUnique({ where: { userId: user.id }, select: { status: true } });
    return t?.status ?? null;
  } catch {
    return null;
  }
}
