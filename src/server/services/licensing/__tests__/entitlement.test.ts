/**
 * Licensing entitlement tests.
 *
 * checkEntitlement / checkDealCreationEntitlement gate every premium skill.
 * These tests pin down the deny-by-default behavior (missing package, missing
 * entitlement, suspended/expired status, lapsed expiry, jurisdiction not in
 * the license) and the two allow paths (free template, launch promo).
 *
 * @/lib/prisma and @/config/features are mocked at the module boundary — no
 * real DB, and the promo flag is toggled per-test via a hoisted state object.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ allSkillsFree: false }));

const p = vi.hoisted(() => ({
  skillPackage: { findUnique: vi.fn() },
  skillEntitlement: { findUnique: vi.fn(), update: vi.fn() },
  contractTemplate: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: p, default: p }));
vi.mock("@/config/features", () => ({
  features: {
    get allSkillsFree() {
      return state.allSkillsFree;
    },
  },
}));

import {
  checkEntitlement,
  checkEntitlementByLicenseKey,
  checkDealCreationEntitlement,
} from "@/server/services/licensing/entitlement";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

function activeEntitlement(overrides: Record<string, unknown> = {}) {
  return {
    id: "ent-1",
    status: "ACTIVE",
    licenseType: "SUBSCRIPTION",
    jurisdictions: ["CALIFORNIA", "SPAIN"],
    expiresAt: FUTURE,
    _count: { activations: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.allSkillsFree = false;
});

describe("checkEntitlement", () => {
  it("short-circuits to entitled during the all-skills-free promo without touching the DB", async () => {
    state.allSkillsFree = true;
    const result = await checkEntitlement("cust-1", "nda-premium");
    expect(result.entitled).toBe(true);
    expect(p.skillPackage.findUnique).not.toHaveBeenCalled();
  });

  it("denies when the skill package does not exist", async () => {
    p.skillPackage.findUnique.mockResolvedValue(null);
    const result = await checkEntitlement("cust-1", "no-such-skill");
    expect(result).toEqual({ entitled: false, reason: "Skill package not found" });
  });

  it("denies when the customer has no entitlement for the skill", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(null);
    const result = await checkEntitlement("cust-1", "nda-premium");
    expect(result.entitled).toBe(false);
    expect(result.reason).toBe("No entitlement found for this skill");
  });

  it("denies a SUSPENDED entitlement", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(
      activeEntitlement({ status: "SUSPENDED" }),
    );
    const result = await checkEntitlement("cust-1", "nda-premium");
    expect(result.entitled).toBe(false);
    expect(result.reason).toBe("License has been suspended");
  });

  it("denies an EXPIRED entitlement", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(
      activeEntitlement({ status: "EXPIRED" }),
    );
    const result = await checkEntitlement("cust-1", "nda-premium");
    expect(result.entitled).toBe(false);
    expect(result.reason).toBe("License has expired");
  });

  it("denies a lapsed expiresAt and flips the stored status to EXPIRED", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(
      activeEntitlement({ expiresAt: PAST }),
    );
    p.skillEntitlement.update.mockResolvedValue({});

    const result = await checkEntitlement("cust-1", "nda-premium");

    expect(result.entitled).toBe(false);
    expect(result.reason).toBe("License has expired");
    expect(p.skillEntitlement.update).toHaveBeenCalledWith({
      where: { id: "ent-1" },
      data: { status: "EXPIRED" },
    });
  });

  it("denies a jurisdiction that is not in the entitlement, reporting the licensed ones", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(activeEntitlement());

    const result = await checkEntitlement("cust-1", "nda-premium", "ENGLAND_WALES");

    expect(result.entitled).toBe(false);
    expect(result.reason).toContain("ENGLAND_WALES");
    expect(result.jurisdictions).toEqual(["CALIFORNIA", "SPAIN"]);
  });

  it("grants an active, in-window entitlement for a licensed jurisdiction", async () => {
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(activeEntitlement());

    const result = await checkEntitlement("cust-1", "nda-premium", "CALIFORNIA");

    expect(result).toMatchObject({
      entitled: true,
      entitlementId: "ent-1",
      licenseType: "SUBSCRIPTION",
      jurisdictions: ["CALIFORNIA", "SPAIN"],
      expiresAt: FUTURE,
    });
    expect(p.skillEntitlement.update).not.toHaveBeenCalled();
  });
});

describe("checkEntitlementByLicenseKey", () => {
  it("rejects a malformed license key before querying the DB", async () => {
    const result = await checkEntitlementByLicenseKey("not-a-license-key");
    expect(result).toEqual({ entitled: false, reason: "Invalid license key format" });
    expect(p.skillEntitlement.findUnique).not.toHaveBeenCalled();
  });
});

describe("checkDealCreationEntitlement", () => {
  it("short-circuits to entitled during the promo without touching the DB", async () => {
    state.allSkillsFree = true;
    const result = await checkDealCreationEntitlement("cust-1", "NDA", "CALIFORNIA");
    expect(result.entitled).toBe(true);
    expect(p.contractTemplate.findUnique).not.toHaveBeenCalled();
  });

  it("denies an unknown contract template", async () => {
    p.contractTemplate.findUnique.mockResolvedValue(null);
    const result = await checkDealCreationEntitlement("cust-1", "NOPE", "CALIFORNIA");
    expect(result).toEqual({ entitled: false, reason: "Contract template not found" });
  });

  it("grants templates with no linked skill package as free", async () => {
    p.contractTemplate.findUnique.mockResolvedValue({
      id: "tpl-1",
      skillPackageId: null,
      skillPackage: null,
    });
    const result = await checkDealCreationEntitlement("cust-1", "NDA", "CALIFORNIA");
    expect(result).toEqual({ entitled: true, reason: "Free template" });
  });

  it("delegates licensed templates to checkEntitlement with the skill and jurisdiction", async () => {
    p.contractTemplate.findUnique.mockResolvedValue({
      id: "tpl-1",
      skillPackageId: "sp-1",
      skillPackage: { id: "sp-1", skillId: "nda-premium" },
    });
    p.skillPackage.findUnique.mockResolvedValue({ id: "sp-1", skillId: "nda-premium" });
    p.skillEntitlement.findUnique.mockResolvedValue(activeEntitlement());

    const result = await checkDealCreationEntitlement("cust-1", "NDA", "SPAIN");

    expect(result.entitled).toBe(true);
    expect(result.entitlementId).toBe("ent-1");
    expect(p.skillPackage.findUnique).toHaveBeenCalledWith({
      where: { skillId: "nda-premium" },
    });
  });
});
