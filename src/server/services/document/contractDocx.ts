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
import type { ContractData } from "./generator";

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

    // Jurisdiction Provision
    if (bp.jurisdictionProvision) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `${sectionNumber++}. ${bp.jurisdictionProvision.title}`,
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
              text: bp.jurisdictionProvision.text,
              size: 20,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

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

  const doc = new Document({
    title: `${data.contractType} - ${data.dealName}`,
    description: data.contractType,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // ~1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
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

  // Party B
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
          text: "",
          size: 20,
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
          text: data.partyA.company || data.partyA.name,
          bold: true,
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
  if (data.partyA.company) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.partyA.name,
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
          text: "                              ",
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Spacing between parties
  children.push(new Paragraph({ spacing: { after: 400 }, children: [] }));

  // Party B signature
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
          text: "",
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.partyB.company || data.partyB.name,
          bold: true,
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
  if (data.partyB.company) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.partyB.name,
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
          text: "                              ",
          size: 20,
          font: "Times New Roman",
        }),
      ],
    })
  );
}
