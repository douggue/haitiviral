import { describe, expect, it } from "vitest";
import { isDisposableEmail, scoreTrial, socialHandle, trialDecision } from "@/lib/trial-risk";

describe("socialHandle", () => {
  it("finds the account in profile and video links", () => {
    expect(socialHandle("tiktok", "https://www.tiktok.com/@Mika.Ht")).toBe("tiktok:mika.ht");
    expect(socialHandle("tiktok", "https://www.tiktok.com/@mika.ht/video/7311111111111")).toBe("tiktok:mika.ht");
    expect(socialHandle("instagram", "https://www.instagram.com/mika_ht/")).toBe("instagram:mika_ht");
    expect(socialHandle("instagram", "https://www.instagram.com/stories/mika_ht/123")).toBe("instagram:mika_ht");
    expect(socialHandle("youtube", "https://www.youtube.com/@MikaHT/shorts")).toBe("youtube:mikaht");
    expect(socialHandle("facebook", "https://www.facebook.com/profile.php?id=1000123")).toBe("facebook:1000123");
  });
  it("returns null when the link doesn't show the account", () => {
    expect(socialHandle("instagram", "https://www.instagram.com/p/Cxyz123/")).toBeNull();
    expect(socialHandle("youtube", "https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(socialHandle("facebook", "https://www.facebook.com/watch?v=1")).toBeNull();
  });
});

describe("isDisposableEmail", () => {
  it("spots throwaway inboxes", () => {
    expect(isDisposableEmail("a@yopmail.com")).toBe(true);
    expect(isDisposableEmail("a@MAILINATOR.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
  });
});

const base = { proxy: false, country: "HT", accountAgeMinutes: 600, sameFingerprint: false, sameIp: false, sharedBrowser: false, hasDeposit: false } as const;
const policy = { autoBelow: 25, refuseAt: 70 };

describe("scoreTrial", () => {
  it("a normal customer in Haiti is sent automatically", () => {
    const r = scoreTrial(base);
    expect(r.score).toBe(0);
    expect(trialDecision(r.score, policy)).toBe("approve");
  });
  it("a brand-new account with an unchecked connection is still low", () => {
    expect(trialDecision(scoreTrial({ ...base, proxy: null, accountAgeMinutes: 5 }).score, policy)).toBe("approve");
  });
  it("abroad + new account goes to staff", () => {
    expect(trialDecision(scoreTrial({ ...base, country: "US", accountAgeMinutes: 5 }).score, policy)).toBe("review");
  });
  it("VPN + same phone print is refused", () => {
    const r = scoreTrial({ ...base, proxy: true, sameFingerprint: true });
    expect(r.score).toBe(75);
    expect(trialDecision(r.score, policy)).toBe("refuse");
    expect(r.reasons).toHaveLength(2);
  });
  it("a top-up lowers the score but never below 0", () => {
    expect(scoreTrial({ ...base, hasDeposit: true }).score).toBe(0);
    expect(scoreTrial({ ...base, sameIp: true, hasDeposit: true }).score).toBe(10);
  });
});
