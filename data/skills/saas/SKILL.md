---
name: saas
description: |
  **SaaS Agreement Generator & Legal Review Tool**: Creates Software-as-a-Service Subscription Agreements with SLA provisions, multi-jurisdictional support, and various pricing models.
  - MANDATORY TRIGGERS: saas agreement, saas contract, software as a service, subscription agreement, cloud services agreement, software subscription
  - Supports multiple pricing models: per-user, usage-based, flat-rate, tiered
  - Multi-jurisdictional (California, Delaware, New York, England & Wales)
  - Two modes: (1) Generate new SaaS Agreement, (2) Review/audit SaaS Agreement for risks
---

# SaaS Agreement Skill

Generate and review Software-as-a-Service (SaaS) Agreements with clear structure, plain language, and multi-jurisdictional support. Designed from the Provider (Vendor) perspective with comprehensive subscription models and SLA provisions.

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
Question 1 - Subscription Model:
Header: "Pricing"
Question: "Which subscription/pricing model will this agreement use?"
Options:
- Per-user/seat-based (Recommended) | Fixed price per user per billing period
- Usage-based | Pay-as-you-go based on consumption metrics (API calls, storage, transactions)
- Flat-rate | Single fixed price for unlimited access
- Tiered | Multiple pricing tiers with different feature sets

Question 2 - Initial Term:
Header: "Term"
Question: "What is the initial subscription term?"
Options:
- Annual (Recommended) | 12-month commitment with annual or monthly billing
- Monthly | Month-to-month subscription with monthly billing
- Multi-year | 2-3 year commitment, typically with volume discounts
- Custom | Flexible term to be specified in Order Form

Question 3 - SLA Uptime Commitment:
Header: "Uptime"
Question: "What uptime commitment should the SLA include?"
Options:
- 99.9% (Three Nines) (Recommended) | Up to 8.76 hours downtime per year, standard for business SaaS
- 99.5% | Up to 43.8 hours downtime per year, suitable for non-critical applications
- 99.0% | Up to 87.6 hours downtime per year, basic tier
- Commercially reasonable | No specific uptime guarantee, best efforts only

Question 4 - Governing Law:
Header: "Jurisdiction"
Question: "Which jurisdiction's law should govern this agreement?"
Options:
- Delaware (Recommended) | Delaware law, courts in Wilmington (corporate-friendly)
- California | California law, courts in San Francisco or Los Angeles
- New York | New York law, courts in New York County (finance/enterprise)
- England & Wales | English law, courts in London (international)

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
   - Insert appropriate subscription/pricing terms
   - Set the initial term and renewal provisions
   - Include SLA schedule with selected uptime commitment and service credits
   - Apply jurisdiction-specific governing law and dispute resolution
   - Add jurisdiction-specific compliance provisions
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

## Schedule A: Service Level Agreement
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
| 99.9% | 8.76 hours | 43.8 minutes | Business-critical SaaS |
| 99.5% | 43.8 hours | 3.65 hours | Standard business apps |
| 99.0% | 87.6 hours | 7.3 hours | Non-critical tools |

### Standard Service Credit Structure

| Uptime Achieved | Service Credit |
|-----------------|----------------|
| < 99.9% but ≥ 99.0% | 10% of monthly fees |
| < 99.0% but ≥ 95.0% | 25% of monthly fees |
| < 95.0% | 50% of monthly fees |

### Pricing Model Comparison

| Model | Provider Risk | Customer Risk | Best For |
|-------|---------------|---------------|----------|
| **Per-user** | Low | Low | Predictable team sizes |
| **Usage-based** | Medium | Medium | Variable workloads |
| **Flat-rate** | High | Low | SMB, simplicity |
| **Tiered** | Low | Low | Growth-stage companies |

---

## References
- `references/saas-template.md` - Complete SaaS Agreement template with all sections
- `references/review-checklist.md` - Comprehensive legal review checklist for SaaS agreements
