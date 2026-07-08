// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract DOCX Generator Service
 *
 * Generates a Word document (.docx) from contract data,
 * mirroring the structure of the PDF generator.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  ShadingType,
} from "docx";
import type { ContractData, CertificationData } from "./generator";

const LABELS: Record<string, Record<string, string>> = {
  en: {
    effectiveDate: "Effective Date",
    background: "Background",
    definitions: "Definitions",
    inThisAgreement: "In this Agreement:",
    negotiatedTerms: "Negotiated Terms",
    generalProvisions: "General Provisions",
    governingLaw: "Governing Law",
    signatures: "Signatures",
    inWitnessWhereof:
      "IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.",
    date: "Date:",
    partyA: "Party A",
    partyB: "Party B",
    parties: "Parties",
    termsAndConditions: "Terms and Conditions",
    certifiedBy: "Certified by TODO.LAW",
    uncertified: "UNVERIFIED — This document has not been certified",
    auditCertificate: "Audit Certificate",
    documentHash: "Document Hash (SHA-256)",
    certificationId: "Certification ID",
    signatureTimestamps: "Signature Timestamps",
    verification: "Verification",
    verifyInstructions: "To verify this document, visit the URL above and enter the document hash.",
  },
  es: {
    effectiveDate: "Fecha de Efecto",
    background: "Antecedentes",
    definitions: "Definiciones",
    inThisAgreement: "En el presente Acuerdo:",
    negotiatedTerms: "Términos Negociados",
    generalProvisions: "Disposiciones Generales",
    governingLaw: "Ley Aplicable",
    signatures: "Firmas",
    inWitnessWhereof:
      "EN FE DE LO CUAL, las partes han suscrito el presente Acuerdo en la Fecha de Efecto.",
    date: "Fecha:",
    partyA: "Parte A",
    partyB: "Parte B",
    parties: "Partes",
    termsAndConditions: "Términos y Condiciones",
    certifiedBy: "Certificado por TODO.LAW",
    uncertified: "SIN VERIFICAR — Este documento no ha sido certificado",
    auditCertificate: "Certificado de Auditoría",
    documentHash: "Hash del Documento (SHA-256)",
    certificationId: "ID de Certificación",
    signatureTimestamps: "Marcas de Tiempo de Firma",
    verification: "Verificación",
    verifyInstructions: "Para verificar este documento, visite la URL anterior e introduzca el hash del documento.",
  },
};

function formatDate(date: Date, language: string = "en"): string {
  const locale = language === "es" ? "es-ES" : "en-US";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateContractDocx(
  data: ContractData
): Promise<Buffer> {
  const lang = data.language || "en";
  const labels = LABELS[lang] || LABELS.en;
  const hasBoilerplate = data.boilerplate !== null;
  let sectionNumber = 1;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: hasBoilerplate
            ? data.boilerplate!.contractTitle
            : data.contractType,
          bold: true,
          size: 32,
          font: "Times New Roman",
          allCaps: true,
        }),
      ],
    })
  );

  // Effective date subtitle
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text:
            lang === "es"
              ? formatDate(data.createdAt, lang)
              : `${labels.effectiveDate}: ${formatDate(data.createdAt, lang)}`,
          size: 20,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );

  if (hasBoilerplate) {
    const bp = data.boilerplate!;

    // Preamble
    if (bp.preamble) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: bp.preamble,
              size: 22,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Background
    if (bp.background) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: labels.background.toUpperCase(),
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: bp.background,
              size: 22,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Definitions
    if (bp.definitions.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${sectionNumber++}. ${labels.definitions.toUpperCase()}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: labels.inThisAgreement,
              size: 20,
              font: "Times New Roman",
            }),
          ],
        })
      );
      for (const def of bp.definitions) {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `"${def.term}" `,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
              new TextRun({
                text: def.definition,
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      }
    }

    // Standard Clauses
    for (const clause of bp.standardClauses) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${sectionNumber++}. ${clause.title}`,
              bold: true,
              size: 22,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360 },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: clause.text,
              size: 20,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Negotiated Terms
    if (data.clauses.length > 0) {
      const ntSection = sectionNumber++;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          },
          children: [
            new TextRun({
              text: `${ntSection}. ${labels.negotiatedTerms.toUpperCase()}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );

      data.clauses.forEach((clause, index) => {
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({
                text: `${ntSection}.${index + 1} ${clause.title}`,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: 360 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: clause.legalText,
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      });
    }

    // General Provisions
    if (bp.generalProvisions.length > 0) {
      const gpSection = sectionNumber++;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${gpSection}. ${labels.generalProvisions.toUpperCase()}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );

      bp.generalProvisions.forEach((provision, index) => {
        children.push(
          new Paragraph({
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: `${gpSection}.${index + 1} ${provision.title}`,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: provision.text,
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      });
    }

    // Governing law and jurisdiction — its own top-level article (negotiated forum)
    if (data.governingLawArticle) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${sectionNumber++}. ${data.governingLawArticle.title}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 300 },
          children: [
            new TextRun({ text: data.governingLawArticle.text, size: 20, font: "Times New Roman" }),
          ],
        })
      );
    }

    // Jurisdiction-specific regulatory provision(s) — multi or single
    const jpList = bp.jurisdictionProvisions?.length
      ? bp.jurisdictionProvisions
      : bp.jurisdictionProvision
        ? [bp.jurisdictionProvision]
        : [];
    for (const jp of jpList) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${sectionNumber++}. ${jp.title}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: jp.text,
              size: 20,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Signatures
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 100 },
        children: [
          new TextRun({
            text: `${sectionNumber}. ${labels.signatures.toUpperCase()}`,
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: labels.inWitnessWhereof,
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );

    // Signature blocks as a table (two columns)
    addSignatureBlocks(children, data, labels, bp.partyLabels);
  } else {
    // Fallback: Simple format without boilerplate

    // Parties table
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: labels.parties.toUpperCase(),
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      })
    );
    addPartiesInfo(children, data, labels);

    // Governing Law Box
    children.push(
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: "F5F5F5" },
        spacing: { before: 200, after: 100 },
        indent: { left: 200, right: 200 },
        children: [
          new TextRun({
            text: labels.governingLaw.toUpperCase(),
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: "F5F5F5" },
        spacing: { after: 300 },
        indent: { left: 200, right: 200 },
        children: [
          new TextRun({
            text: data.governingLaw,
            bold: true,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      })
    );

    // Terms and Conditions
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: labels.termsAndConditions.toUpperCase(),
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      })
    );

    data.clauses.forEach((clause, index) => {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 60 },
          children: [
            new TextRun({
              text: `${index + 1}. ${clause.title}`,
              bold: true,
              size: 22,
              font: "Times New Roman",
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360 },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: clause.legalText,
              size: 20,
              font: "Times New Roman",
            }),
          ],
        })
      );
    });

    // Signatures
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 100 },
        children: [
          new TextRun({
            text: labels.signatures.toUpperCase(),
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: labels.inWitnessWhereof,
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );

    addSignatureBlocks(children, data, labels);
  }

  // Certification footer — only rendered when the document is actually
  // certified. Until the Firmas integration lands, the previous
  // "UNVERIFIED — This document has not been certified" banner read as
  // accusatory; better to print nothing.
  if (data.certification?.certified) {
    children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
    children.push(
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: labels.certifiedBy,
            size: 14,
            color: "166534",
            font: "Times New Roman",
          }),
          ...(data.certification?.documentHash
            ? [
                new TextRun({
                  text: `    SHA-256: ${data.certification.documentHash.slice(0, 16)}...`,
                  size: 12,
                  color: "999999",
                  font: "Times New Roman",
                }),
              ]
            : []),
        ],
      })
    );
  }

  // Build sections array
  const sections = [
    {
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    },
  ];

  // Annex pages — each annex as its own section (own page), AFTER the
  // signature blocks, mirroring the PDF/legal convention of annexes following
  // the signatures rather than sitting mid-document as numbered articles.
  if (data.boilerplate?.annexes?.length) {
    for (const annex of data.boilerplate.annexes) {
      sections.push({
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: buildAnnexSection(annex),
      });
    }
  }

  // Audit Certificate page (only when certified)
  if (data.certification?.certified) {
    sections.push({
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: buildAuditCertificateSection(data.certification, labels, data.dealName),
    });
  }

  const doc = new Document({
    title: `${data.contractType} - ${data.dealName}`,
    description: data.contractType,
    sections,
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function addPartiesInfo(
  children: Paragraph[],
  data: ContractData,
  labels: Record<string, string>
) {
  // Party A
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: labels.partyA,
          size: 18,
          color: "666666",
          allCaps: true,
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: data.partyA.name,
          bold: true,
          size: 24,
          font: "Times New Roman",
        }),
      ],
    })
  );
  if (data.partyA.company) {
    children.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: data.partyA.company,
            size: 20,
            color: "333333",
            font: "Times New Roman",
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: data.partyA.email,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Party B (skip if solo mode / null)
  if (data.partyB) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: labels.partyB,
            size: 18,
            color: "666666",
            allCaps: true,
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: data.partyB.name,
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      })
    );
    if (data.partyB.company) {
      children.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: data.partyB.company,
              size: 20,
              color: "333333",
              font: "Times New Roman",
            }),
          ],
        })
      );
    }
    children.push(
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: data.partyB.email,
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
  }
}

function addSignatureBlocks(
  children: Paragraph[],
  data: ContractData,
  labels: Record<string, string>,
  partyLabels?: { partyA: string; partyB: string }
) {
  const partyALabel = partyLabels?.partyA || labels.partyA;
  const partyBLabel = partyLabels?.partyB || labels.partyB;

  // Party A signature
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: partyALabel,
          size: 18,
          color: "666666",
          allCaps: true,
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
      children: [
        new TextRun({
          // Typed signature rendered graphically on the signature line.
          // Italic Times New Roman is the closest stock-font approximation
          // of a typed-to-sign mark; the rest of the contract is in the
          // same family so the line keeps a consistent feel.
          text: data.partyA.signature || "",
          italics: true,
          size: 36,
          color: "1A3A5C",
          font: "Times New Roman",
        }),
      ],
    })
  );
  // Spacer for signature line
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.partyA.legalName || data.partyA.company || data.partyA.name,
          bold: true,
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.partyA.signatoryName || data.partyA.name,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );
  if (data.partyA.signatoryTitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.partyA.signatoryTitle,
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({
          text: labels.date,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
      children: [
        new TextRun({
          text: data.partyA.signedAt
            ? data.partyA.signedAt.toLocaleDateString(data.language === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" })
            : "                              ",
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Party B signature (blank lines for manual signing when solo mode / null partyB)
  children.push(new Paragraph({ spacing: { after: 400 }, children: [] }));

  children.push(
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: partyBLabel,
          size: 18,
          color: "666666",
          allCaps: true,
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
      children: [
        new TextRun({
          text: data.partyB?.signature || "",
          italics: true,
          size: 36,
          color: "1A3A5C",
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  if (data.partyB) {
    // Named party B
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.partyB.legalName || data.partyB.company || data.partyB.name,
            bold: true,
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.partyB.signatoryName || data.partyB.name,
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
    if (data.partyB.signatoryTitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: data.partyB.signatoryTitle,
              size: 18,
              color: "666666",
              font: "Times New Roman",
            }),
          ],
        })
      );
    }
  } else {
    // Solo mode: blank lines for manual signing
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "[_________________]",
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "[_________________]",
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({
          text: labels.date,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
      children: [
        new TextRun({
          text: data.partyB?.signedAt
            ? data.partyB.signedAt.toLocaleDateString(data.language === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" })
            : "                              ",
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
}

function buildAnnexSection(annex: { title: string; text: string }): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Annex heading with a coloured rule underneath
  paragraphs.push(
    new Paragraph({
      spacing: { after: 240 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "1A3A5C" },
      },
      children: [
        new TextRun({
          text: annex.title.toUpperCase(),
          bold: true,
          size: 26,
          color: "1A3A5C",
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Annex body — one paragraph per non-empty line
  for (const line of annex.text.split("\n")) {
    if (!line.trim()) continue;
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: line,
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );
  }

  return paragraphs;
}

function buildAuditCertificateSection(
  certification: CertificationData,
  labels: Record<string, string>,
  dealName: string
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: labels.auditCertificate.toUpperCase(),
          bold: true,
          size: 28,
          font: "Times New Roman",
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: dealName,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Document Hash
  paragraphs.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: labels.documentHash,
          size: 18,
          color: "666666",
          allCaps: true,
          font: "Times New Roman",
        }),
      ],
    })
  );
  paragraphs.push(
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: "F5F5F5" },
      spacing: { after: 300 },
      indent: { left: 100, right: 100 },
      children: [
        new TextRun({
          text: certification.documentHash,
          size: 16,
          font: "Courier New",
          color: "333333",
        }),
      ],
    })
  );

  // Certification ID
  paragraphs.push(
    new Paragraph({
      spacing: { after: 60 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      },
      children: [
        new TextRun({
          text: `${labels.certificationId}: `,
          size: 18,
          color: "666666",
          font: "Times New Roman",
        }),
        new TextRun({
          text: certification.ceremonyId,
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Signature Timestamps
  paragraphs.push(
    new Paragraph({
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: labels.signatureTimestamps,
          bold: true,
          size: 22,
          font: "Times New Roman",
        }),
      ],
    })
  );

  for (const ts of certification.timestamps) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 200 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 3, color: "166534" },
        },
        children: [
          new TextRun({
            text: ts.partyRole === "INITIATOR" ? "Party A" : "Party B",
            bold: true,
            size: 20,
            font: "Times New Roman",
          }),
        ],
      })
    );
    paragraphs.push(
      new Paragraph({
        spacing: { after: 20 },
        indent: { left: 200 },
        children: [
          new TextRun({
            text: `Signed: ${ts.signedAt}`,
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
    paragraphs.push(
      new Paragraph({
        spacing: { after: 200 },
        indent: { left: 200 },
        children: [
          new TextRun({
            text: `RFC 3161: ${ts.rfc3161Timestamp || "N/A"}`,
            size: 16,
            color: "999999",
            font: "Courier New",
          }),
        ],
      })
    );
  }

  // Verification URL
  if (certification.verificationUrl) {
    paragraphs.push(
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: "F0FDF4" },
        spacing: { before: 200, after: 60 },
        indent: { left: 200, right: 200 },
        children: [
          new TextRun({
            text: `${labels.verification}: `,
            size: 18,
            color: "666666",
            font: "Times New Roman",
          }),
          new TextRun({
            text: certification.verificationUrl,
            size: 20,
            color: "166534",
            font: "Times New Roman",
          }),
        ],
      })
    );
    paragraphs.push(
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: "F0FDF4" },
        spacing: { after: 200 },
        indent: { left: 200, right: 200 },
        children: [
          new TextRun({
            text: labels.verifyInstructions,
            size: 16,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      })
    );
  }

  return paragraphs;
}
