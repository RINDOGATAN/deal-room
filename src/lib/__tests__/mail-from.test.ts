import { describe, it, expect } from "vitest";
import { mailFrom, mailProductName, signInSubject } from "../mail-from";

describe("mailFrom", () => {
  it("uses the title-case product name and the fallback address by default", () => {
    expect(mailProductName).toBe("Dealroom");
    expect(mailFrom(undefined)).toBe("Dealroom by TODO.LAW <noreply@todo.law>");
    expect(mailFrom("")).toBe("Dealroom by TODO.LAW <noreply@todo.law>");
  });

  it("keeps a bare address from the variable", () => {
    expect(mailFrom("noreply@firm.example")).toBe("Dealroom by TODO.LAW <noreply@firm.example>");
  });

  it("discards a display name the variable already carries", () => {
    expect(mailFrom("DEALROOM <noreply@todo.law>")).toBe("Dealroom by TODO.LAW <noreply@todo.law>");
    expect(mailFrom('"Someone Else" <mail@firm.example>')).toBe(
      "Dealroom by TODO.LAW <mail@firm.example>",
    );
  });

  it("falls back when the variable is malformed", () => {
    expect(mailFrom("Broken <")).toBe("Dealroom by TODO.LAW <noreply@todo.law>");
  });
});

describe("signInSubject", () => {
  it("names the product in title case, with a door suffix where given", () => {
    expect(signInSubject()).toBe("Sign in to Dealroom");
    expect(signInSubject("administrator")).toBe("Sign in to Dealroom (administrator)");
    expect(signInSubject("supervisor")).toBe("Sign in to Dealroom (supervisor)");
  });
});
