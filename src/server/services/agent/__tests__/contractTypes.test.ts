// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/brand", () => ({ brand: { appDomain: "dealroom.test" } }));

import {
  contractTypeFromInput,
  resetContractTypesCache,
  sortContractTypes,
  governingLawsFor,
  inputsFor,
  listContractTypes,
} from "@/server/services/agent/contractTypes";

describe("contract types", () => {
  it("maps jurisdiction tags to governing laws without repeats", () => {
    expect(governingLawsFor(["CALIFORNIA", "SPAIN"])).toEqual(["CALIFORNIA", "SPAIN"]);
    expect(governingLawsFor(["DELAWARE", "CALIFORNIA"])).toEqual(["CALIFORNIA"]);
    expect(governingLawsFor(["ATLANTIS"])).toEqual([]);
  });

  it("reads a code, a code in any case or a guide slug", () => {
    const codes = ["NDA", "DPA", "SAAS"];
    expect(contractTypeFromInput("NDA", codes)).toBe("NDA");
    expect(contractTypeFromInput("saas", codes)).toBe("SAAS");
    expect(contractTypeFromInput("data-processing-agreement", codes)).toBe("DPA");
    expect(contractTypeFromInput("employment-agreement", codes)).toBeNull(); // page exists, template not seeded
    expect(contractTypeFromInput("  ", codes)).toBeNull();
  });

  it("describes inputs in the asked language, with their conditions", () => {
    const inputs = inputsFor(
      {
        version: "1.0",
        parameters: [
          {
            id: "dispute-forum-city",
            token: "dispute forum city",
            scope: "dispute-resolution",
            type: "text",
            required: true,
            default: "Madrid",
            jurisdictions: ["SPAIN"],
            label: { en: "City of the competent courts", es: "Ciudad de los juzgados" },
          },
        ],
      },
      "es",
    );
    expect(inputs).toEqual([
      {
        id: "dispute-forum-city",
        label: "Ciudad de los juzgados",
        type: "text",
        required: true,
        onlyUnder: ["SPAIN"],
        default: "Madrid",
      },
    ]);
  });

  it("lists the catalogue without agent-to-agent templates, with guides and roles", async () => {
    const findMany = vi.fn(async () => [
      {
        contractType: "DPA",
        displayName: "Data Processing Agreement",
        displayNameLocalized: { es: "Contrato de encargo del tratamiento" },
        description: "DPA",
        descriptionLocalized: null,
        jurisdictions: ["CALIFORNIA", "SPAIN"],
        languages: ["en", "es"],
        parameterSchema: null,
        category: "privacy",
        categoryLocalized: null,
        _count: { clauses: 12 },
      },
      {
        contractType: "STUB",
        displayName: "Catalogue stub",
        displayNameLocalized: null,
        description: null,
        descriptionLocalized: null,
        jurisdictions: ["CALIFORNIA"],
        languages: ["en"],
        parameterSchema: null,
        category: null,
        categoryLocalized: null,
        _count: { clauses: 0 },
      },
    ]);
    resetContractTypesCache();
    const list = await listContractTypes({ contractTemplate: { findMany } } as never, { lang: "es" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, NOT: { contractType: { startsWith: "A2A_" } } },
      }),
    );
    expect(list).toHaveLength(1); // the clause-less stub is left out
    expect(list[0]).toMatchObject({
      contractType: "DPA",
      group: { id: "privacy", name: "Protección de datos y privacidad" },
      slug: "data-processing-agreement",
      name: "Contrato de encargo del tratamiento",
      governingLaws: ["CALIFORNIA", "SPAIN"],
      roles: ["PROCESSOR", "CONTROLLER"],
      clauseCount: 12,
      guide: {
        en: "https://dealroom.todo.law/contracts/data-processing-agreement",
        es: "https://dealroom.todo.law/es/contracts/data-processing-agreement",
      },
      details: "https://dealroom.test/api/v1/agent/templates/DPA",
    });
  });

  it("orders by the /contracts groups, then by name within a group", () => {
    const t = (contractType: string, name: string, group: string) =>
      ({ contractType, name, group: { id: group, name: group } }) as never;
    const sorted = sortContractTypes(
      [t("SAAS", "SaaS", "commercial"), t("X", "Zeta", "category-misc"), t("DPA", "DPA", "privacy"), t("NDA", "NDA", "commercial")],
      "en",
    );
    expect(sorted.map((x: { contractType: string }) => x.contractType)).toEqual(["NDA", "SAAS", "DPA", "X"]);
  });
});
