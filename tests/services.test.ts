import { describe, expect, it } from "vitest";
import { checkLink, cleanDrip, dripPlan, parseComments, servicePrice, wantsPost } from "@/lib/services";
import { withDiscount } from "@/lib/vip-math";

describe("service links", () => {
  it("accepts the right kind of link and cleans tracking extras", () => {
    expect(checkLink("https://www.tiktok.com/@mika_ht?is_from_webapp=1", "tiktok", false)).toEqual({ ok: true, url: "https://www.tiktok.com/@mika_ht" });
    expect(checkLink("instagram.com/reel/ABC123/?igsh=xyz", "instagram", true)).toEqual({ ok: true, url: "https://instagram.com/reel/ABC123/" });
    expect(checkLink("https://youtu.be/dQw4w9WgXcQ", "youtube", true).ok).toBe(true);
    expect(checkLink("https://vm.tiktok.com/ZMabc123/", "tiktok", true).ok).toBe(true);
    // short links are opened on the server, so they pass here for profiles too
    expect(checkLink("https://vm.tiktok.com/ZMabc123/", "tiktok", false).ok).toBe(true);
  });
  it("refuses a video where a profile is needed, and the reverse", () => {
    expect(checkLink("https://www.tiktok.com/@mika_ht/video/123", "tiktok", false)).toEqual({ ok: false, error: "need_profile" });
    expect(checkLink("https://www.instagram.com/mika", "instagram", true)).toEqual({ ok: false, error: "need_post" });
  });
  it("refuses another platform or text that is not a link", () => {
    expect(checkLink("https://www.instagram.com/mika", "tiktok", false)).toEqual({ ok: false, error: "not_platform" });
    expect(checkLink("bonjou.html", "tiktok", false)).toEqual({ ok: false, error: "not_platform" });
  });
  it("live viewers take a profile or a live link", () => {
    expect(wantsPost("live", "live")).toBe(false);
    expect(checkLink("https://www.tiktok.com/@mika_ht/live", "tiktok", false).ok).toBe(true);
  });
});

describe("service prices", () => {
  it("prices per 1,000, live by duration, never below 1 gourde", () => {
    expect(servicePrice(42000, 1000, "default")).toBe(42000);
    expect(servicePrice(42000, 500, "default")).toBe(21000);
    expect(servicePrice(90000, 100, "live", 60)).toBe(18000);
    expect(servicePrice(800, 1, "default")).toBe(100);
  });
  it("applies the VIP discount", () => {
    expect(withDiscount(42000, 0)).toBe(42000);
    expect(withDiscount(42000, 5)).toBe(39900);
  });
  it("one comment per line, without blanks or repeats", () => {
    expect(parseComments("Bèl!\n\n  Bravo \nbèl!\nKontinye konsa, frè m")).toEqual(["Bèl!", "Bravo", "Kontinye konsa, frè m"]);
  });
});

describe("smarter link check", () => {
  it("turns a username into the profile link", () => {
    expect(checkLink("@mika_ht", "tiktok", false)).toEqual({ ok: true, url: "https://www.tiktok.com/@mika_ht" });
    expect(checkLink("mika.ht", "instagram", false).ok).toBe(false); // looks like an address, not a username
    expect(checkLink("@mika.ht", "instagram", false)).toEqual({ ok: true, url: "https://www.instagram.com/mika.ht" });
    expect(checkLink("@mika", "tiktok", true)).toEqual({ ok: false, error: "need_post" });
  });
  it("enforces reels, Shorts or normal videos when the service asks", () => {
    expect(checkLink("https://www.instagram.com/p/ABC/", "instagram", true, "reel")).toEqual({ ok: false, error: "need_reel" });
    expect(checkLink("https://www.instagram.com/reel/ABC/", "instagram", true, "reel").ok).toBe(true);
    expect(checkLink("https://www.youtube.com/watch?v=x", "youtube", true, "shorts")).toEqual({ ok: false, error: "need_shorts" });
    expect(checkLink("https://www.youtube.com/shorts/abc", "youtube", true, "video")).toEqual({ ok: false, error: "need_video" });
    expect(checkLink("https://youtu.be/abc", "youtube", true, "video").ok).toBe(true);
  });
});

describe("dripPlan", () => {
  const base = { drip: true, min: 100, dripAuto: { runs: 5, interval: 60, from: 500 } };
  it("splits big orders into the staff batches", () => {
    expect(dripPlan(1000, base)).toEqual({ runs: 5, perRun: 200, interval: 60 });
  });
  it("small orders go in one go", () => {
    expect(dripPlan(400, base)).toBeNull();
  });
  it("keeps each batch above the service minimum", () => {
    expect(dripPlan(250, { ...base, dripAuto: { runs: 5, interval: 30, from: 0 } })).toEqual({ runs: 2, perRun: 125, interval: 30 });
  });
  it("off when staff didn't set it or the provider can't", () => {
    expect(dripPlan(1000, { ...base, dripAuto: undefined })).toBeNull();
    expect(dripPlan(1000, { ...base, drip: false })).toBeNull();
  });
  it("cleans stored settings", () => {
    expect(cleanDrip({ runs: "3", interval: "45", from: "" })).toEqual({ runs: 3, interval: 45, from: 0 });
    expect(cleanDrip({ runs: 1, interval: 45 })).toBeUndefined();
  });
});
