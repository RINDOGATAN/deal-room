---
name: msa
description: |
  **Master Services Agreement Generator & Legal Review Tool**: Creates professional services MSAs with SOW framework, and reviews MSAs for commercial and legal risks.
  - MANDATORY TRIGGERS: MSA, master services agreement, services agreement, consulting agreement, professional services, SOW, statement of work, vendor agreement
  - Supports multiple payment models: fixed fee, T&M, milestone-based, subscription
  - Multi-jurisdictional (US, UK, international)
  - Two modes: (1) Generate new MSA with interactive questions, (2) Review/audit MSA for risks
---

# MSA Skill

Generate Master Services Agreements for professional/consulting services or review existing MSAs for commercial and legal risks.

## Modes

| User Intent | Mode | Action |
|-------------|------|--------|
| "Create an MSA", "Generate services agreement", "I need a consulting contract" | **Generate** | Ask questions, then create MSA |
| "Review this MSA", "Check this services agreement", "Audit this vendor contract" | **Review** | Analyze document for risks and issues |

---

## Mode 1: Generate MSA

### Step 1: Gather Requirements

Use `AskUserQuestion` to collect all options:

```
Question 1 - Your Role:
Header: "Role"
Question: "Which party are you in this agreement?"
Options:
- Service Provider (Recommended) | You are providing services to the client
- Client | You are engaging a service provider
- Neutral/Balanced | Create balanced terms for negotiation

Question 2 - Payment Model:
Header: "Payment"
Question: "What payment structure do you need?"
Options:
- Time & Materials (Recommended) | Hourly/daily rates with expense reimbursement
- Fixed Fee | Project-based fixed pricing per SOW
- Milestone-based | Payments tied to deliverable acceptance
- Subscription/Retainer | Recurring fees for ongoing services

Question 3 - Liability Cap:
Header: "Liability"
Question: "What liability cap structure do you prefer?"
Options:
- Fees paid (12 months) (Recommended) | Cap at fees paid in prior 12 months
- Fees paid under SOW | Cap at fees paid under specific SOW
- Fixed amount | Specify a fixed cap amount
- Unlimited for certain breaches | Cap with carve-outs for IP, confidentiality, gross negligence

Question 4 - Governing Law:
Header: "Jurisdiction"
Question: "Which jurisdiction should govern this agreement?"
Options:
- Delaware (USA) | Business-friendly US jurisdiction
- New York (USA) | Major commercial hub
- California (USA) | Technology industry standard
- England & Wales (UK) | International commerce standard

Question 5 - Output Format:
Header: "Format"
Question: "What format do you need?"
Options:
- Markdown (.md) (Recommended) | Universal, editable, easy to convert to other formats
- HTML (.html) | View in any browser, works everywhere
- PDF (.pdf) | Final format for distribution or signing
- Word (.docx) | Traditional legal document format
```

### Step 2: Generate MSA

After collecting answers:

1. Read `references/msa-template.md` for the full template structure
2. Customize based on user's role (provider-friendly vs client-friendly language)
3. Include appropriate payment terms based on model selected
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
# MASTER SERVICES AGREEMENT

**Effective Date:** [DATE]
**Agreement Number:** [MSA-XXXX]

This Master Services Agreement ("Agreement") is between:

## 1. Parties

### Service Provider
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

### Client
- **Name:** [FULL LEGAL NAME]
- **Address:** [REGISTERED ADDRESS]
...

## 2. Definitions
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
  <title>Master Services Agreement</title>
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
    .option-box {
      border: 1px dashed #999;
      padding: 1rem;
      margin: 1rem 0;
      background: #fafafa;
    }
    .option-box::before {
      content: "Option: ";
      font-weight: bold;
      color: #666;
    }
    @media print {
      body { max-width: none; margin: 0; }
      .placeholder { background: #eee; }
    }
  </style>
</head>
<body>
  <!-- MSA content here -->
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

## Mode 2: Review MSA

When user provides an MSA for review:

### Step 1: Read the Document

Read the provided file using appropriate tool.

### Step 2: Analyze Against Checklist

Read `references/review-checklist.md` and systematically check each category.

### Step 3: Generate Risk Report

Output format follows user preference (Markdown recommended for review reports):

```markdown
# MSA Legal Review Report

**Document:** [filename]
**Review Date:** [date]
**Reviewing As:** [Client / Service Provider]

## Executive Summary
[1-2 sentence assessment: Balanced / Provider-Favorable / Client-Favorable / High Risk]

## Risk Assessment

### High Risk Provisions
[Terms that create significant exposure or unfavorable obligations]

### Moderate Risk / Negotiation Points
[Non-standard terms worth negotiating]

### Standard/Acceptable Provisions
[Properly balanced terms]

## Section-by-Section Analysis

| Section | Risk Level | Finding |
|---------|------------|---------|
| Services & SOW | ✅/⚠️/❌ | [Note] |
| Fees & Payment | ✅/⚠️/❌ | [Note] |
| Term & Termination | ✅/⚠️/❌ | [Note] |
| IP Ownership | ✅/⚠️/❌ | [Note] |
| Confidentiality | ✅/⚠️/❌ | [Note] |
| Warranties | ✅/⚠️/❌ | [Note] |
| Indemnification | ✅/⚠️/❌ | [Note] |
| Liability Cap | ✅/⚠️/❌ | [Note] |
| Insurance | ✅/⚠️/❌ | [Note] |
| Termination | ✅/⚠️/❌ | [Note] |

## Key Commercial Terms

| Term | Value | Market Standard | Assessment |
|------|-------|-----------------|------------|
| Payment terms | [X days] | 30 days | ✅/⚠️/❌ |
| Liability cap | [Amount] | 12 months fees | ✅/⚠️/❌ |
| Notice period | [X days] | 30 days | ✅/⚠️/❌ |
| IP ownership | [Who owns] | Client owns deliverables | ✅/⚠️/❌ |

## Recommendations
1. [Priority negotiation point]
2. [Secondary point]
```

### Critical Risk Flags

**For Service Providers, flag as High Risk:**
- Unlimited liability
- IP assignment of pre-existing/background IP
- Broad indemnification without caps
- Performance guarantees without exclusions
- Unreasonable termination for convenience (no wind-down)
- Audit rights without reasonable limitations
- Non-compete provisions

**For Clients, flag as High Risk:**
- No service level commitments
- No termination for cause rights
- Provider retains all IP
- No confidentiality obligations
- Excessive liability limitations
- Auto-renewal without notice
- Assignment without consent

---

## Quick Reference

### Standard Commercial Terms

| Element | Market Standard |
|---------|-----------------|
| Payment terms | Net 30 days |
| Late payment interest | 1-1.5% per month |
| Liability cap | 12 months fees (or fees under SOW) |
| Termination for convenience | 30 days notice |
| Termination for cause | 30 days cure period |
| Insurance - Professional liability | $1-2M per occurrence |
| Insurance - General liability | $1M per occurrence |

### IP Ownership Models

| Model | Description | Best For |
|-------|-------------|----------|
| **Work for hire** | Client owns all deliverables | Custom development |
| **License model** | Provider owns, client gets license | SaaS, productized services |
| **Joint ownership** | Both parties own | Collaborative R&D |
| **Background IP carve-out** | Provider retains pre-existing IP | Consulting with tools/frameworks |

### Payment Model Comparison

| Model | Provider Risk | Client Risk | Best For |
|-------|---------------|-------------|----------|
| **T&M** | Low | Medium | Uncertain scope |
| **Fixed Fee** | High | Low | Well-defined scope |
| **Milestone** | Medium | Medium | Phased projects |
| **Retainer** | Low | Low | Ongoing support |
