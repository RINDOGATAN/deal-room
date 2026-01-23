---
name: nda
description: |
  **Mutual NDA Generator & Legal Review Tool**: Creates plain-language, multi-jurisdictional Non-Disclosure Agreements for business partnerships and reviews NDAs for material changes.
  - MANDATORY TRIGGERS: NDA, non-disclosure, confidentiality agreement, mutual NDA, business partnership agreement, review NDA, check NDA changes
  - Supports California (USA), England & Wales (UK), and Spain (EU) jurisdictions
  - Two modes: (1) Generate new NDA with interactive questions, (2) Review/compare NDA for material alterations
---

# NDA Skill

Generate mutual NDAs for business partnerships or review NDAs for material changes.

## Modes

| User Intent | Mode | Action |
|-------------|------|--------|
| "Create an NDA", "Generate NDA", "I need an NDA" | **Generate** | Ask questions, then create NDA |
| "Review this NDA", "Check NDA changes", "Compare NDA" | **Review** | Analyze document for material alterations |

---

## Mode 1: Generate NDA

### Step 1: Gather Requirements

Use `AskUserQuestion` to collect all options:

```
Question 1 - Jurisdictions (multiSelect: true):
Header: "Jurisdictions"
Question: "Which jurisdictions should this NDA cover?"
Options:
- California (USA) | Governed by CUTSA and California Civil Code
- England & Wales (UK) | Common law with equitable remedies
- Spain (EU) | Civil law under Law 1/2019 on Trade Secrets
- All three | Maximum flexibility for international partnerships

Question 2 - Confidentiality Duration:
Header: "Duration"
Question: "How long should confidentiality obligations survive after the agreement ends?"
Options:
- 2 years (Recommended) | Standard for most business discussions
- 3 years | Extended protection for sensitive industries
- 5 years | Maximum protection for highly sensitive information

Question 3 - Dispute Resolution:
Header: "Disputes"
Question: "How should disputes be resolved?"
Options:
- Courts (Recommended) | Traditional litigation in chosen jurisdiction
- Arbitration | Private, typically faster, internationally enforceable
- Mediation first, then courts | Attempt settlement before litigation

Question 4 - Output Format:
Header: "Format"
Question: "What format do you need?"
Options:
- Markdown (.md) (Recommended) | Universal, editable, easy to convert to other formats
- HTML (.html) | View in any browser, works everywhere
- PDF (.pdf) | Final format for distribution or signing
- Word (.docx) | Traditional legal document format
```

### Step 2: Generate NDA

After collecting answers:

1. Read `references/nda-template.md` for the full template structure
2. Customize based on user's jurisdiction selection:
   - Single jurisdiction: Use that jurisdiction's governing law
   - Multiple jurisdictions: Include jurisdiction-specific provisions section
3. Generate document in requested format (see Output Formats below)
4. Use placeholders in `[BRACKETS]` for variable information

---

## Output Formats

### Format Selection Matrix

| User Choice | Action | Notes |
|-------------|--------|-------|
| **Markdown (.md)** | Write directly to `.md` file | Primary format; universal compatibility |
| **HTML (.html)** | Generate styled HTML document | Self-contained with embedded CSS |
| **PDF (.pdf)** | Use pdf skill | For final distribution |
| **Word (.docx)** | Use docx skill | For traditional legal workflows |

### Markdown (Recommended Default)

**Why Markdown first:**
- Works in any text editor
- Version control friendly (Git, etc.)
- Easy to convert to any other format
- Readable as plain text
- Imports cleanly into Google Docs, Notion, Word, etc.

**Structure:**
```markdown
# MUTUAL NON-DISCLOSURE AGREEMENT

**Effective Date:** [DATE]

This Mutual Non-Disclosure Agreement ("Agreement") is between:

## 1. Parties

### First Party
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

### Second Party
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

## 2. Purpose
...
```

### HTML (Universal Viewing)

Generate a self-contained HTML file with embedded CSS for professional appearance:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mutual Non-Disclosure Agreement</title>
  <style>
    body {
      font-family: Georgia, "Times New Roman", serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      text-align: center;
      font-size: 1.5rem;
      border-bottom: 2px solid #333;
      padding-bottom: 0.5rem;
    }
    h2 {
      font-size: 1.2rem;
      margin-top: 2rem;
      color: #222;
    }
    h3 { font-size: 1rem; }
    .parties-box {
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 1rem;
      margin: 1rem 0;
    }
    .placeholder {
      background: #fff3cd;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.5rem;
      text-align: left;
    }
    th { background: #f5f5f5; }
    .signature-block {
      margin-top: 3rem;
      page-break-inside: avoid;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      width: 250px;
      margin: 2rem 0 0.5rem;
    }
    @media print {
      body { max-width: none; margin: 0; }
      .placeholder { background: #eee; }
    }
  </style>
</head>
<body>
  <!-- NDA content here -->
</body>
</html>
```

**Benefits:**
- Opens in any browser
- Print to PDF from browser
- Works on any device
- No software dependencies
- Can be emailed directly

### PDF (Final Distribution)

When PDF is selected, use the **pdf skill** to create the document directly.

### Word (.docx) (Traditional Workflow)

When Word is selected, use the **docx skill** with these typography guidelines:

**Font preferences (cross-platform):**
1. Georgia (available everywhere)
2. Times New Roman (universal fallback)

**Document structure:**
- Title: 18pt, bold, centered
- Heading 1: 14pt, bold
- Heading 2: 12pt, bold
- Body: 11pt, 1.15 line spacing
- Margins: 1 inch all sides

---

## Language Style

All output formats should follow these principles:
- Plain English, no archaic legalese
- Use "must" instead of "shall"
- Active voice, short sentences
- Define technical terms when first used

---

## Mode 2: Review NDA

When user provides an NDA for review (file path or pasted text):

### Step 1: Read the Document

Read the provided file using appropriate tool (Read for .txt/.md, docx skill for .docx, pdf skill for .pdf).

### Step 2: Analyze Against Checklist

Read `references/review-checklist.md` and systematically check each category.

### Step 3: Generate Review Report

Output format follows user preference (Markdown recommended for review reports):

```markdown
# NDA Legal Review Report

**Document:** [filename]
**Review Date:** [date]

## Executive Summary
[1-2 sentence assessment: Standard / Minor Issues / Material Concerns]

## Material Findings

### Critical Issues
[Issues that significantly alter risk or obligations - or "None identified"]

### Notable Deviations
[Non-standard terms warranting attention - or "None identified"]

### Standard Provisions Confirmed
[List of expected clauses present and acceptable]

## Clause-by-Clause Analysis

| Section | Status | Finding |
|---------|--------|---------|
| Parties | ✅/⚠️/❌ | [Brief note] |
| Definition of Confidential Info | ✅/⚠️/❌ | [Brief note] |
| Exclusions | ✅/⚠️/❌ | [Brief note] |
| Obligations | ✅/⚠️/❌ | [Brief note] |
| Term & Survival | ✅/⚠️/❌ | [Brief note] |
| Remedies | ✅/⚠️/❌ | [Brief note] |
| General Provisions | ✅/⚠️/❌ | [Brief note] |

## Jurisdiction Notes
[Any jurisdiction-specific concerns for CA/UK/Spain if applicable]

## Recommendations
1. [Actionable recommendation]
2. [Actionable recommendation]
```

### Critical Issue Flags

Always flag these as **Critical**:
- Unilateral modification rights
- Unlimited liability exposure
- Non-mutual obligations in supposedly mutual NDA
- Overly broad confidential information definition (no reasonable limits)
- Perpetual or unreasonably long confidentiality (>5 years without justification)
- Missing standard exclusions (public info, prior knowledge, independent development)
- Assignment without consent
- Waiver of injunctive relief
- Indemnification for receiving party's own negligence

---

## Quick Reference

| Jurisdiction | Key Statute | Watch For |
|--------------|-------------|-----------|
| California | CUTSA | Employee mobility; no non-compete implications |
| England & Wales | Common law | Equitable remedies available; GDPR if personal data |
| Spain | Law 1/2019 | Civil law specificity required; LOPDGDD compliance |

| Element | Standard Default |
|---------|-----------------|
| Agreement term | 2 years |
| Confidentiality survival | 2-3 years post-termination |
| Notice period | 30 days written |
| Return of materials | 10 business days |
