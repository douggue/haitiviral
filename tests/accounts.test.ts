import { describe, expect, it } from "vitest";
import { accountPrice, findSmsCode, parseAccountMeta, parseCredential, parseSmsLine, totp } from "@/lib/accounts";

describe("totp", () => {
  it("matches the RFC 6238 test vectors (SHA-1, 6 digits)", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
    expect(await totp(secret, 59_000)).toBe("287082");
    expect(await totp(secret, 1_111_111_109_000)).toBe("081804");
    expect(await totp(secret, 2_000_000_000_000)).toBe("279037");
  });
  it("accepts spaces and lower case, refuses bad keys", async () => {
    expect(await totp("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000)).toBe("287082");
    expect(await totp("not a key!", 59_000)).toBeNull();
  });
});

describe("parseCredential", () => {
  it("reads email:password:recovery", () => {
    expect(parseCredential("a@gmail.com:Pw1!:rec@outlook.com")).toEqual([
      { label: "login", value: "a@gmail.com" }, { label: "password", value: "Pw1!" }, { label: "recovery", value: "rec@outlook.com" },
    ]);
  });
  it("reads login|password|2fa", () => {
    expect(parseCredential("ig_user|Pw1|JBSWY3DPEHPK3PXP").map((p) => p.label)).toEqual(["login", "password", "twofa"]);
  });
  it("keeps odd lines whole", () => {
    expect(parseCredential("KEY-XXXX-AAAA")).toEqual([{ label: "other", value: "KEY-XXXX-AAAA" }]);
    expect(parseCredential("see https://x.com/a:b")).toEqual([{ label: "other", value: "see https://x.com/a:b" }]);
  });
});

describe("SMS lines", () => {
  it("finds the number and the code page", () => {
    expect(parseSmsLine("+1 (305) 555-0199 | https://ytseller.com/sms/abc")).toEqual({ number: "+13055550199", url: "https://ytseller.com/sms/abc" });
  });
  it("finds a code in a message", () => {
    expect(findSmsCode("<p>Your WhatsApp code: 123-456</p><p>Your code is 482913</p>")).toBe("482913");
    expect(findSmsCode("G-551234 is your Google verification code")).toBe("551234");
    expect(findSmsCode("nothing here")).toBeNull();
  });
});

describe("accountPrice / meta", () => {
  it("adds the margin and rounds up to 5 HTG", () => {
    expect(accountPrice(0.45, 132, 60)).toBe(10_000); // 95.04 HTG → 100 HTG
    expect(accountPrice(0.5, 120, 50)).toBe(9_000); // exactly 90 HTG stays
  });
  it("never under 5 HTG", () => {
    expect(accountPrice(0.001, 132, 0)).toBe(500);
  });
  it("parses the stored JSON", () => {
    expect(parseAccountMeta({ kind: "sms", min: 1, max: 5, delivery: "x", warrantyHours: 0 })?.delivery).toBe("instant");
    expect(parseAccountMeta({ kind: "boost" })).toBeNull();
  });
});
