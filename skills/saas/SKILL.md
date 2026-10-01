---
name: saas
description: |
  **SaaS Agreement Generator & Legal Review Tool**: Creates Software-as-a-Service Agreements with an uptime commitment, support levels and data terms, under California, England & Wales or Spanish law.
  - MANDATORY TRIGGERS: saas agreement, saas contract, software as a service, subscription agreement, cloud services agreement, software subscription
  - Negotiated terms: uptime, support, data ownership, termination, price changes, renewal, data export, liability cap, security standards, dispute resolution
  - Governing law: California, England & Wales, Spain (or a custom law and courts named by the parties)
  - Two modes: (1) Generate new SaaS Agreement, (2) Review/audit SaaS Agreement for risks
---

# SaaS Agreement Skill

Generate and review Software-as-a-Service (SaaS) Agreements with clear structure, plain language, and multi-jurisdictional support. The generated agreement contains exactly the clauses in `clauses.json` and `boilerplate.json`; the service tier, number of users, Fees, billing and initial term belong in the Order Form.

## Modes

| User Intent | Mode | Action |
|-------------|------|--------|
| "Create a SaaS agreement", "Generate subscription agreement", "I need a cloud services contract" | **Generate** | Ask questions, then create agreement |
| "Review this SaaS agreement", "Check this subscription contract", "Audit this cloud agreement" | **Review** | Analyze document for risks and issues |

---

## Mode 1: Generate SaaS Agreement

### Step 1: Gather Requirements

Use `AskUserQuestion` to collect all options:

```
Question 1 - Uptime Commitment:
Header: "Uptime"
Question: "What uptime commitment should the agreement include?"
Options:
- 99.9% (Three Nines) | Availability of at least 99.9% each calendar month
- 99.5% | Availability of at least 99.5% each calendar month
- 99.99% (Four Nines) | Availability of at least 99.99% each calendar month
- Commercially reasonable | Reasonable efforts, no uptime percentage

Question 2 - Support:
Header: "Support"
Question: "Which support level applies?"
Options:
- Premium | 24/7/365, 1-hour response for critical issues
- Standard | Business hours, 4-hour response for critical issues
- Basic | Email during business hours, 24 business hours

Question 3 - Governing Law:
Header: "Jurisdiction"
Question: "Which jurisdiction's law should govern this agreement?"
Options:
- California | California law
- England & Wales | English law
- Spain | Spanish law

Question 4 - Disputes:
Header: "Disputes"
Question: "Where are disputes resolved?"
Options:
- Default courts | Courts of the governing-law jurisdiction
- Delaware courts | Court of Chancery of Delaware as the forum (governing law unchanged)
- Arbitration | JAMS, AAA or ICC (seated in the governing-law jurisdiction) or LCIA (London)
- Custom | A governing law and courts named by the parties

Question 5 - Output Format:
Header: "Format"
Question: "What format do you need?"
Options:
- Markdown (.md) (Recommended) | Universal, editable, easy to convert to other formats
- HTML (.html) | View in any browser, works everywhere
- PDF (.pdf) | Final format for distribution or signing
- Word (.docx) | Traditional legal document format
```

### Step 2: Generate the Agreement

Using the template in `references/saas-template.md`:

1. **Read the template** from the references folder
2. **Customize** based on user selections:
   - Insert the selected uptime commitment and support level (the agreement provides no service credits)
   - Insert the remaining negotiated terms: data ownership, termination rights, price change notice, renewal, data export period, liability cap and security standards
   - Apply the governing law and the selected dispute resolution option
   - Add the jurisdiction-specific provisions for California, England & Wales or Spain
3. **Generate the document** in the requested format
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
# SAAS SUBSCRIPTION AGREEMENT

**Effective Date:** [DATE]

This SaaS Subscription Agreement ("Agreement") is between:

## 1. Parties

### Provider
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

### Customer
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

## 2. Definitions
...

## 3. Grant of Rights
...

## Service Availability and Maintenance
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
  <title>SaaS Subscription Agreement</title>
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
    .sla-table th { background: #e8f4e8; }
    .signature-block {
      margin-top: 3rem;
      page-break-inside: avoid;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      width: 250px;
      margin: 2rem 0 0.5rem;
    }
    .schedule {
      border-top: 2px solid #333;
      margin-top: 3rem;
      padding-top: 1rem;
    }
    @media print {
      body { max-width: none; margin: 0; }
      .placeholder { background: #eee; }
    }
  </style>
</head>
<body>
  <!-- SaaS Agreement content here -->
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

## Mode 2: Review SaaS Agreement

### Step 1: Obtain the Agreement

Ask the user to provide the SaaS Agreement for review. Accept:
- File path to an existing document
- Pasted text content

### Step 2: Extract and Analyze

1. **Extract text** from the provided document
2. **Read the review checklist** from `references/review-checklist.md`
3. **Analyze** the agreement against each checklist category

### Step 3: Generate Review Report

Output format follows user preference (Markdown recommended for review reports):

```markdown
# SaaS Agreement Legal Review

## Document Information
- **Document Title:** [extracted title]
- **Parties:** [Provider] / [Customer]
- **Effective Date:** [if stated]
- **Review Date:** [current date]
- **Reviewer Perspective:** Provider (Vendor)

## Executive Summary
[2-3 sentence overview of agreement quality and key concerns]

## Risk Assessment

### High Risk Issues
[Issues requiring immediate attention before signing]

### Medium Risk Issues
[Issues to negotiate or clarify]

### Acceptable Provisions
[Standard provisions that are reasonable]

## Detailed Analysis

### 1. Grant of Rights & License Scope
[Analysis against checklist]

### 2. Subscription & Payment Terms
[Analysis against checklist]

### 3. Service Level Agreement (SLA)
[Analysis against checklist]

### 4. Data Rights & Security
[Analysis against checklist]

### 5. Intellectual Property
[Analysis against checklist]

### 6. Limitation of Liability
[Analysis against checklist]

### 7. Indemnification
[Analysis against checklist]

### 8. Term & Termination
[Analysis against checklist]

### 9. Confidentiality
[Analysis against checklist]

### 10. Compliance & Regulatory
[Analysis against checklist]

## Recommended Actions
1. [Specific action items]
2. [Negotiation points]
3. [Clarifications needed]

## Non-Standard Terms Detected
[List any unusual or non-market provisions]
```

### Step 4: Deliver Report

Present the review report to the user and offer to:
- Explain any specific findings in detail
- Suggest alternative language for problematic provisions
- Compare against market-standard terms

---

## Quick Reference

### SLA Uptime Comparison

| Uptime Level | Annual Downtime | Monthly Downtime | Best For |
|--------------|-----------------|------------------|----------|
| 99.99% | 52.6 minutes | 4.4 minutes | Critical infrastructure |
| 99.9% | 8.76 hours | 43.8 minutes | Business-critical SaaS |
| 99.5% | 43.8 hours | 3.65 hours | Standard business apps |

The generated agreement does not attach service credits to a missed uptime
commitment. When reviewing a third party's agreement, check its credit regime
with `references/review-checklist.md`.

---

## References
- `references/saas-template.md` - Structure of the generated SaaS Agreement: standard terms, negotiated options and jurisdiction provisions
- `references/review-checklist.md` - Comprehensive legal review checklist for SaaS agreements
