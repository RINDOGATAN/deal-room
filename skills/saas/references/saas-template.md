# SaaS Agreement Template

This reference describes the Software as a Service Agreement that Dealroom
generates from this skill. It follows `boilerplate.json` (fixed text) and
`clauses.json` (negotiated terms) and adds nothing that those files do not
contain. Commercial details that the agreement leaves to the Order Form (the
service tier, number of Authorized Users, Fees, billing and the initial
Subscription Term) are not negotiated clauses.

## Document Structure

```
SOFTWARE AS A SERVICE AGREEMENT

Preamble: the Provider and the Customer, with their details, and the Effective Date
Background
1. Definitions (Authorized Users, Customer Data, Documentation, Fees, Order Form, ...)
2. Standard terms (fixed text, see below)
3. Negotiated terms (one agreed option per clause, see below)
4. Jurisdiction-specific provisions (California, England and Wales or Spain)
5. General provisions (entire agreement, amendments, ...)
Signatures
```

---

## Standard terms (fixed text)

These sections are the same in every agreement:

1. **Grant of access.** Non-exclusive, non-transferable, non-sublicensable right
   to use the Service and Documentation for the Customer's internal business
   purposes during the Subscription Term, within the limits of the Order Form.
2. **Usage restrictions.** No resale, sublicensing, derivative works, reverse
   engineering, unlawful or malicious content, or interference with the Service.
3. **Customer responsibilities.** Accuracy and legality of Customer Data, user
   administration, credential security, prompt notice of unauthorised use.
4. **Provider intellectual property.** The Provider keeps all rights in the
   Service, Documentation and Provider Materials; licence to use Feedback.
5. **Service availability and maintenance.** Commercially reasonable efforts to
   meet the agreed uptime commitment; scheduled maintenance with 48 hours'
   notice where it may affect availability; emergency maintenance with notice
   as soon as practicable. The agreement provides no service credits.
6. **Data protection.** Encryption in transit and at rest, access controls,
   security testing, incident response, breach notice within 72 hours.
7. **Suspension rights.** Suspension for security risk, harm to the Service or
   other customers, material breach (including non-payment) or legal
   requirement, limited in scope and duration.
8. **Confidentiality.** Definition, exclusions, obligations, compelled
   disclosure, return or destruction.
9. **Warranties and disclaimers.** Authority; Service performs materially in
   accordance with the Documentation, with correction or termination and
   pro-rata refund if not corrected within 30 days; disclaimer of other warranties.
10. **Indemnification.** Provider defends IP infringement claims (with modify,
    replace or terminate remedies); Customer defends claims arising from
    Customer Data or misuse; procedure.
11. **Limitation of liability.** Exclusion of indirect damages; carve-outs from
    the cap agreed in the negotiated terms.
12. **Force majeure.**

---

## Negotiated terms

Each clause is negotiated in Dealroom and one option is agreed.

### Uptime service level
- **99.9% (three nines):** availability of at least 99.9% each calendar month, with the calculation formula.
- **99.5%:** availability of at least 99.5% each calendar month.
- **99.99% (four nines):** availability of at least 99.99% each calendar month.
- **Commercially reasonable (no SLA):** reasonable efforts, no uptime percentage.

None of the options attaches service credits or another specific remedy to a
missed commitment; the general remedies of the agreement apply.

### Support response time
- **Premium:** 24/7/365; critical 1 hour, high 4 hours, medium 8 hours, low 24 hours.
- **Standard:** business hours Monday to Friday; critical 4 hours, high 8 business hours, medium 1 business day, low 2 business days.
- **Basic:** email during business hours, reasonable efforts to respond within 24 business hours.

### Customer data ownership
- **Customer owns all data:** the Provider only has a licence to host, process and transmit it to provide the Service.
- **Customer owns, Provider uses aggregated data:** anonymised, aggregated data for product improvement and analytics.
- **Customer owns, broad Provider licence:** worldwide licence to use, analyse and create derivative works for service provision, product improvement and new features.

### Termination rights
- **Locked term:** no termination for convenience; Fees due for the full term.
- **Early exit with fee:** Customer may terminate on 60 days' notice and pays 50% of the remaining Fees.
- **Termination with notice:** either party on 90 days' notice; Fees only up to termination.

### Price change notice
Provider may change pricing for a renewal term on **30**, **60** or **90** days' notice.

### Auto-renewal terms
- **Auto-renew, 30 days' notice to cancel.**
- **Auto-renew, 60 days' notice to cancel.**
- **Manual renewal:** a renewal order is required.

### Data export rights
Customer Data is available for export for **30**, **60** or **90** days after termination and then deleted.

### Liability cap
- **12 months of fees:** each party's total liability capped at Fees paid or payable in the preceding 12 months.
- **Direct damages only:** indirect damages excluded, direct damages capped at 12 months' fees.
- **Enhanced:** 12 months' fees in general, three times that amount for breaches of data security obligations.

### Security standards
- **SOC 2 Type II** attestation.
- **ISO 27001** certification.
- **Both** SOC 2 Type II and ISO 27001.

### Governing law and jurisdiction (dispute resolution)
The governing law is the jurisdiction chosen for the deal: **California**,
**England and Wales** or **Spain**. The forum is negotiated:

- **Default courts:** the courts of the governing-law jurisdiction.
- **Delaware courts:** the Court of Chancery of the State of Delaware (or other Delaware courts) as a forum only; the governing law does not change.
- **JAMS arbitration**, **AAA arbitration** or **ICC arbitration:** one arbitrator, seated in the governing-law jurisdiction (ICC: its capital).
- **LCIA arbitration:** sole arbitrator, seat in London.
- **Custom governing law and courts:** the parties name the law (`[governing law]`) and courts (`[competent courts]`); mandatory data protection, consumer and similar laws still apply.

---

## Jurisdiction-specific provisions

- **California:** Automatic Renewal Law disclosures, jury waiver, CCPA/CPRA service-provider terms.
- **England and Wales:** no third-party rights (Contracts (Rights of Third Parties) Act 1999), non-excludable liability, Consumer Rights Act 2015 where applicable, UK GDPR processor terms.
- **Spain:** LSSI-CE compliance, good faith (Código Civil arts. 7 and 1258), interpretation rules (arts. 1281 to 1289), GDPR and LOPDGDD processor terms.

---

## General provisions

Entire agreement (with Order Forms and exhibits), amendments in writing, and
the other general provisions in `boilerplate.json`.
