# SaaS Agreement Review Checklist

## Overview
This checklist is designed for reviewing SaaS Agreements from the **Provider (Vendor) perspective**. Each category includes key provisions to verify, risk indicators, and market-standard benchmarks.

---

## 1. Grant of Rights & License Scope

### Key Provisions to Verify
- [ ] License is non-exclusive, non-transferable, non-sublicensable
- [ ] Access limited to "internal business purposes"
- [ ] Authorized Users clearly defined (employees, contractors, agents)
- [ ] No implied licenses granted
- [ ] Rights reservation clause included

### Risk Indicators
- 🔴 **High Risk**: Exclusive license granted; transferable rights; sublicensing permitted
- 🟡 **Medium Risk**: Ambiguous scope of permitted use; undefined user categories
- 🟢 **Acceptable**: Standard non-exclusive, non-transferable license with clear scope

### Provider Concerns
- Ensure no broader rights than intended for subscription level
- Verify no "unlimited" language that could be exploited
- Check that API access is separately controlled if applicable

---

## 2. Usage Restrictions

### Key Provisions to Verify
- [ ] Prohibition on resale, sublicensing, distribution
- [ ] Prohibition on reverse engineering, decompilation
- [ ] Prohibition on competitive use (benchmarking, building competing products)
- [ ] Prohibition on malicious use or illegal activities
- [ ] Prohibition on exceeding usage limits
- [ ] Prohibition on unauthorized access attempts

### Risk Indicators
- 🔴 **High Risk**: Missing competitive use restriction; no reverse engineering prohibition
- 🟡 **Medium Risk**: Weak or vague restrictions; no security-related prohibitions
- 🟢 **Acceptable**: Comprehensive restrictions covering all standard categories

### Provider Concerns
- Competitive benchmarking restriction is essential for protecting business interests
- Reverse engineering prohibition protects proprietary technology
- Usage limit enforcement mechanism should be clear

---

## 3. Subscription & Payment Terms

### Key Provisions to Verify
- [ ] Pricing model clearly defined (per-user, usage, flat-rate, tiered)
- [ ] Payment terms specified (Net 30, advance billing, etc.)
- [ ] Late payment consequences (interest, suspension rights)
- [ ] Price increase rights for renewals (notice period)
- [ ] Tax treatment clarified (exclusive of taxes)
- [ ] Dispute process with reasonable timeframe

### Risk Indicators
- 🔴 **High Risk**: Payment not in advance; no late payment remedies; no suspension rights
- 🟡 **Medium Risk**: Unclear pricing metrics; missing tax provisions; unlimited dispute period
- 🟢 **Acceptable**: Clear pricing, advance payment, suspension rights, 60+ day price change notice

### Provider Concerns
- Advance billing protects cash flow and reduces credit risk
- Suspension rights for non-payment are essential
- Price increase flexibility for renewals maintains business viability

---

## 4. Service Level Agreement (SLA)

### Key Provisions to Verify
- [ ] Uptime commitment percentage stated (99.9%, 99.5%, 99.0%, or best efforts)
- [ ] Downtime calculation methodology defined
- [ ] Exclusions clearly listed (maintenance, customer-caused, force majeure)
- [ ] Service credit schedule and caps
- [ ] Credit request deadline and process
- [ ] Sole remedy clause for SLA failures

### Risk Indicators
- 🔴 **High Risk**: Uptime >99.99%; credits >100% of monthly fees; termination right for SLA breach
- 🟡 **Medium Risk**: Credits >50% of monthly fees; broad downtime definition; short credit request window
- 🟢 **Acceptable**: 99.0-99.9% uptime; credits capped at 50%; 30-day claim window; sole remedy clause

### Provider Concerns
- Ensure exclusions cover all non-controllable outages
- Service credits should be sole remedy (no termination right)
- Credit caps protect against excessive liability
- Claim deadline encourages timely reporting

---

## 5. Data Rights & Security

### Key Provisions to Verify
- [ ] Customer retains ownership of Customer Data
- [ ] Provider has limited license to process Customer Data
- [ ] Security measures specified (encryption, access controls)
- [ ] Certifications maintained (SOC 2, ISO 27001)
- [ ] Data location/residency requirements addressed
- [ ] Data return and deletion timeline upon termination
- [ ] Security incident notification timeline (72 hours typical)

### Risk Indicators
- 🔴 **High Risk**: Provider claims ownership of Customer Data; no security commitments; unlimited data use rights
- 🟡 **Medium Risk**: Vague security standards; no certifications; no data location restrictions
- 🟢 **Acceptable**: Customer ownership, limited processing license, specific security measures, 30-90 day deletion

### Provider Concerns
- License to Customer Data must be broad enough to provide Service
- Aggregated/anonymized data rights should be preserved for analytics
- Security incident timeline should be achievable (72 hours minimum)
- Data deletion timeline should allow for backup retention requirements

---

## 6. Intellectual Property

### Key Provisions to Verify
- [ ] Provider retains all IP in Service and Provider Materials
- [ ] Customer retains IP in Customer Data
- [ ] Feedback clause allows Provider to use customer suggestions
- [ ] Aggregated data rights preserved for Provider
- [ ] No implied IP transfer

### Risk Indicators
- 🔴 **High Risk**: IP assignment to customer; restrictions on using Feedback; no aggregated data rights
- 🟡 **Medium Risk**: Ambiguous ownership language; missing Feedback clause
- 🟢 **Acceptable**: Clear Provider IP retention, Feedback rights, aggregated data rights

### Provider Concerns
- Feedback clause is essential for product development
- Aggregated data rights enable benchmarking and ML improvements
- Ensure no custom development creates IP issues

---

## 7. Confidentiality

### Key Provisions to Verify
- [ ] Confidential Information defined with standard exclusions
- [ ] Standard of care specified (same as own confidential info, not less than reasonable)
- [ ] Permitted disclosures (employees, contractors with need to know)
- [ ] Compelled disclosure process (notice requirement)
- [ ] Survival period stated (3 years typical, longer for trade secrets)

### Risk Indicators
- 🔴 **High Risk**: Asymmetric obligations favoring customer; no standard exclusions; indefinite obligations
- 🟡 **Medium Risk**: Higher standard of care than reasonable; short survival period
- 🟢 **Acceptable**: Mutual obligations, standard exclusions, reasonable care, 3-year survival

### Provider Concerns
- Mutual confidentiality is preferred over one-way obligations
- Ensure compelled disclosure allows time to seek protective order
- Trade secret protection should be indefinite

---

## 8. Warranties & Disclaimers

### Key Provisions to Verify
- [ ] Limited functionality warranty (substantial conformance to Documentation)
- [ ] Authority warranty (right to grant license)
- [ ] Non-infringement addressed (via indemnification, not warranty)
- [ ] Warranty disclaimer in CAPS (as-is, no implied warranties)
- [ ] Warranty remedy limited to correction or refund
- [ ] No warranty of uninterrupted or error-free operation

### Risk Indicators
- 🔴 **High Risk**: Broad performance warranties; fitness for purpose warranty; uptime warranty outside SLA
- 🟡 **Medium Risk**: Missing disclaimer language; unlimited warranty remedies
- 🟢 **Acceptable**: Limited functionality warranty, strong disclaimers, remedy limited to fix or refund

### Provider Concerns
- Warranty should reference Documentation, which Provider controls
- Remedy should be at Provider's option (fix or refund)
- Disclaimer must be conspicuous (ALL CAPS)

---

## 9. Limitation of Liability

### Key Provisions to Verify
- [ ] Consequential damages exclusion (both parties)
- [ ] Liability cap specified (typically 12 months of fees)
- [ ] Excluded claims carved out (indemnification, confidentiality, willful misconduct)
- [ ] Cap for excluded claims (2-3x standard cap)
- [ ] Basis of the bargain language included

### Risk Indicators
- 🔴 **High Risk**: No consequential damages exclusion; unlimited liability; liability >24 months fees
- 🟡 **Medium Risk**: Asymmetric limitations; broad excluded claims; cap >12 months fees
- 🟢 **Acceptable**: Mutual exclusion, 12-month cap, reasonable excluded claims, 2-3x excluded cap

### Provider Concerns
- Liability cap should reflect revenue, not contract value
- Ensure data breach is not excluded from cap (or has separate sub-cap)
- Customer payment obligations should be excluded from cap

---

## 10. Indemnification

### Key Provisions to Verify
- [ ] Provider indemnifies for IP infringement claims
- [ ] Provider control over defense and settlement
- [ ] Exclusions for customer-caused issues (modifications, combinations, misuse)
- [ ] Customer indemnifies for Customer Data and misuse
- [ ] Indemnification procedures specified (notice, cooperation)

### Risk Indicators
- 🔴 **High Risk**: Broad Provider indemnification beyond IP; no exclusions; customer controls defense
- 🟡 **Medium Risk**: Missing exclusions for combinations/modifications; weak customer indemnification
- 🟢 **Acceptable**: IP-only Provider indemnification, standard exclusions, mutual procedures

### Provider Concerns
- Indemnification should be limited to IP infringement, not data breaches
- Exclusions for customer modifications and combinations are essential
- Provider must control defense to manage litigation costs

---

## 11. Term & Termination

### Key Provisions to Verify
- [ ] Initial term clearly stated
- [ ] Auto-renewal with opt-out notice period (30-90 days)
- [ ] Termination for cause with cure period (30 days typical)
- [ ] Termination for insolvency/bankruptcy
- [ ] Effect of termination (access cessation, data return, payment of accrued fees)
- [ ] Survival clause listing continuing obligations

### Risk Indicators
- 🔴 **High Risk**: Customer termination for convenience without fee obligation; immediate termination rights
- 🟡 **Medium Risk**: Short cure periods (<30 days); no auto-renewal; refund on termination for cause
- 🟢 **Acceptable**: Auto-renewal, 30-day cure, no refunds on customer breach, clear survival

### Provider Concerns
- No termination for convenience without payment of remaining term (or early termination fee)
- Auto-renewal protects revenue predictability
- No pro-rata refunds for customer-caused termination

---

## 12. Compliance & Regulatory

### Key Provisions to Verify
- [ ] Each party responsible for their own legal compliance
- [ ] Export compliance obligation on Customer
- [ ] Data protection compliance framework (DPA reference)
- [ ] Government user provisions (FAR/DFARS if applicable)
- [ ] Anti-corruption compliance

### Risk Indicators
- 🔴 **High Risk**: Provider assumes customer's compliance obligations; unlimited regulatory warranties
- 🟡 **Medium Risk**: Missing export compliance; no government provisions
- 🟢 **Acceptable**: Mutual compliance responsibility, customer export compliance, DPA reference

### Provider Concerns
- Customer should be responsible for their own regulatory compliance
- Export compliance places burden appropriately on party controlling use
- Government provisions limit liability and manage expectations

---

## 13. General Provisions

### Key Provisions to Verify
- [ ] Governing law and jurisdiction specified
- [ ] Entire agreement clause
- [ ] Amendment requires written agreement
- [ ] Assignment restrictions (consent required, M&A exception)
- [ ] Severability clause
- [ ] Force majeure clause
- [ ] No third-party beneficiaries
- [ ] Independent contractor relationship

### Risk Indicators
- 🔴 **High Risk**: Customer-favorable jurisdiction; customer can assign freely; oral amendments permitted
- 🟡 **Medium Risk**: Missing force majeure; no assignment restrictions
- 🟢 **Acceptable**: Provider-favorable or neutral jurisdiction, mutual assignment restrictions, standard clauses

### Provider Concerns
- Governing law should be Provider's home jurisdiction or neutral
- Assignment restriction should not impede Provider's M&A activities
- Force majeure should include pandemic and cyber events

---

## 14. Order Form & Commercial Terms

### Key Provisions to Verify
- [ ] Order Form references master agreement
- [ ] Pricing clearly stated
- [ ] Subscription term and renewal terms
- [ ] Any custom terms documented
- [ ] Conflict resolution (Order Form vs. Agreement)

### Risk Indicators
- 🔴 **High Risk**: Order Form supersedes Agreement entirely; undocumented verbal commitments
- 🟡 **Medium Risk**: Conflicting terms without resolution mechanism
- 🟢 **Acceptable**: Order Form prevails for commercial terms only, Agreement for legal terms

### Provider Concerns
- Order Form should not override liability limitations or other protective terms
- All commitments should be documented in writing
- Custom terms should be carefully reviewed for conflicts

---

## 15. Non-Standard Terms Detection

### Red Flags to Identify
- [ ] Most Favored Customer (MFC) clauses
- [ ] Audit rights beyond standard scope
- [ ] Source code escrow requirements
- [ ] Unlimited liability carve-outs
- [ ] Performance guarantees beyond SLA
- [ ] Broad termination rights
- [ ] Data portability beyond standard
- [ ] Custom security requirements
- [ ] Insurance requirements above market
- [ ] Penalty clauses

### Assessment Notes
Document any non-standard terms and assess:
1. Business justification for accepting
2. Risk mitigation measures available
3. Precedent implications for other customers
4. Revenue impact vs. risk exposure

---

## Review Summary Template

```
## SaaS Agreement Review Summary

**Document**: [Title]
**Customer**: [Name]
**Review Date**: [Date]
**Reviewer**: [Name]

### Overall Assessment: [Favorable / Needs Negotiation / High Risk]

### Key Statistics
- High Risk Issues: [#]
- Medium Risk Issues: [#]
- Non-Standard Terms: [#]

### Critical Issues Requiring Resolution
1. [Issue and recommended resolution]
2. [Issue and recommended resolution]

### Negotiation Priorities
1. [Item - Priority Level]
2. [Item - Priority Level]

### Acceptable with Modifications
1. [Item and suggested language]

### Approved as Drafted
1. [Section]
2. [Section]

### Recommendation
[Accept / Accept with modifications / Reject / Escalate]
```
