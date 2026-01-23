---
name: dpa
description: |
  **Data Processing Agreement Generator & Legal Review Tool**: Creates GDPR-compliant Controller-to-Processor DPAs with EU SCCs, and reviews DPAs for compliance gaps.
  - MANDATORY TRIGGERS: DPA, data processing agreement, GDPR, data protection, processor agreement, sub-processor, SCCs, standard contractual clauses, international data transfer
  - Supports EU GDPR, UK GDPR, and California CCPA/CPRA
  - Two modes: (1) Generate new DPA with interactive questions, (2) Review/audit DPA for compliance issues
---

# DPA Skill

Generate GDPR-compliant Data Processing Agreements or review existing DPAs for compliance gaps.

## Modes

| User Intent | Mode | Action |
|-------------|------|--------|
| "Create a DPA", "Generate DPA", "I need a data processing agreement" | **Generate** | Ask questions, then create DPA |
| "Review this DPA", "Check DPA compliance", "Audit this processor agreement" | **Review** | Analyze document against GDPR requirements |

---

## Mode 1: Generate DPA

### Step 1: Gather Requirements

Use `AskUserQuestion` to collect all options:

```
Question 1 - Jurisdictions (multiSelect: true):
Header: "Jurisdictions"
Question: "Which data protection regimes should this DPA cover?"
Options:
- EU GDPR | European Union General Data Protection Regulation
- UK GDPR | United Kingdom data protection (post-Brexit)
- California CCPA/CPRA | California Consumer Privacy Act and Privacy Rights Act
- All three (Recommended) | Maximum coverage for international operations

Question 2 - International Transfers:
Header: "Transfers"
Question: "Will personal data be transferred outside the EEA/UK?"
Options:
- Yes - include EU SCCs (Recommended) | Include Standard Contractual Clauses for international transfers
- No - EEA/UK only | Data stays within adequate jurisdictions
- Unsure - include SCCs | Better to include if uncertain

Question 3 - Sub-processors:
Header: "Sub-processors"
Question: "How should sub-processor appointments be handled?"
Options:
- General authorization (Recommended) | Controller approves categories; processor maintains list with notification of changes
- Specific authorization | Controller must approve each sub-processor individually
- No sub-processors | Processor may not engage any sub-processors

Question 4 - Output Format:
Header: "Format"
Question: "What format do you need?"
Options:
- Markdown (.md) (Recommended) | Universal, editable, easy to convert to other formats
- HTML (.html) | View in any browser, works everywhere
- PDF (.pdf) | Final format for distribution or signing
- Word (.docx) | Traditional legal document format
```

### Step 2: Generate DPA

After collecting answers:

1. Read `references/dpa-template.md` for the full template structure
2. If international transfers selected, read `references/eu-sccs.md` for Standard Contractual Clauses
3. Customize based on user's jurisdiction and transfer selections
4. Generate document in requested format (see Output Formats below)
5. Use placeholders in `[BRACKETS]` for variable information

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
# DATA PROCESSING AGREEMENT

**Effective Date:** [DATE]

This Data Processing Agreement ("DPA") forms part of the [MAIN AGREEMENT NAME]...

## 1. Parties

### Data Controller
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

## 2. Background and Scope
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
  <title>Data Processing Agreement</title>
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
  <!-- DPA content here -->
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

## Mode 2: Review DPA

When user provides a DPA for review:

### Step 1: Read the Document

Read the provided file using appropriate tool.

### Step 2: Analyze Against Checklist

Read `references/review-checklist.md` and systematically check each GDPR Article 28 requirement.

### Step 3: Generate Compliance Report

Output format follows user preference (Markdown recommended for review reports):

```markdown
# DPA Compliance Review Report

**Document:** [filename]
**Review Date:** [date]

## Executive Summary
[1-2 sentence assessment: Compliant / Minor Gaps / Material Deficiencies]

## GDPR Article 28 Compliance

### Missing Mandatory Provisions
[Required elements absent from the DPA]

### Incomplete or Weak Provisions
[Present but insufficient for full compliance]

### Compliant Provisions
[Properly addressed requirements]

## Requirement-by-Requirement Analysis

| Art. 28 Requirement | Status | Finding |
|---------------------|--------|---------|
| Processing only on instructions | ✅/⚠️/❌ | [Note] |
| Confidentiality obligations | ✅/⚠️/❌ | [Note] |
| Security measures | ✅/⚠️/❌ | [Note] |
| Sub-processor controls | ✅/⚠️/❌ | [Note] |
| Data subject rights assistance | ✅/⚠️/❌ | [Note] |
| Breach notification | ✅/⚠️/❌ | [Note] |
| Deletion/return obligations | ✅/⚠️/❌ | [Note] |
| Audit rights | ✅/⚠️/❌ | [Note] |

## International Transfer Analysis
[SCCs present? Adequate? Transfer Impact Assessment referenced?]

## Jurisdiction-Specific Notes
[EU GDPR / UK GDPR / CCPA gaps if applicable]

## Recommendations
1. [Priority remediation action]
2. [Secondary action]
```

### Critical Compliance Flags

Always flag as **Missing Mandatory**:
- No documented instructions requirement
- No sub-processor flow-down obligations
- No breach notification timeline (must be "without undue delay")
- No deletion/return on termination
- No audit rights for controller
- Processor can determine purposes (makes them a controller)
- No security measures specified
- No confidentiality obligations on personnel

---

## GDPR Article 28 Quick Reference

| Requirement | What It Means |
|-------------|---------------|
| **28(3)(a)** | Process only on documented instructions |
| **28(3)(b)** | Ensure personnel confidentiality |
| **28(3)(c)** | Implement appropriate security (Art. 32) |
| **28(3)(d)** | Sub-processor conditions and flow-down |
| **28(3)(e)** | Assist with data subject rights |
| **28(3)(f)** | Assist with security, breach, DPIA, consultation |
| **28(3)(g)** | Delete or return data on termination |
| **28(3)(h)** | Allow and contribute to audits |

## Standard Timelines

| Element | Standard |
|---------|----------|
| Breach notification to controller | Without undue delay (24-72 hours recommended) |
| Sub-processor change notice | 30 days before engagement |
| Data return/deletion | 30-90 days after termination |
| Audit notice | 30 days (reasonable notice) |
