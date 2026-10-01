---
contractType: "DATA_LICENSING"
title: "Data licensing agreement template: scope, use and privacy"
description: "Data licensing agreement between a data provider and a licensee: dataset scope, permitted use and model training, exclusivity, pricing, quality, privacy roles and audits."
heading: "Data licensing agreement"
summary: "A data licensing agreement sets the terms on which a data provider lets a licensee access and use its data (for example audience segments or analytics) for a fixed term: what data is covered, what it may be used for, how it is priced, how privacy is handled and what happens to the data when the licence ends."
related: ["data-processing-agreement", "advertising-insertion-order", "technology-license-agreement", "privacy-notice"]
faq:
  - q: "What is a data licensing agreement?"
    a: "It is a contract under which a data provider grants a licensee a limited licence to access and use its data for a set term (12 months by default in the Dealroom template), subject to use restrictions, quality terms, privacy obligations and deletion on termination."
  - q: "Can licensed data be used to train AI models?"
    a: "Only if the agreement allows it. The template offers three levels of permitted use: ad targeting only; targeting, analytics and measurement; or comprehensive use including model training and internal product development. None of the options allows external resale."
  - q: "Is the licensee a controller or a processor?"
    a: "The parties choose. Either each acts as an independent controller responsible for its own processing, or the provider acts as processor (a service provider under the CCPA) on the licensee's instructions. Independent controllers is the default: the template warns that a provider licensing its own data is not normally the licensee's processor, and that incorrect classification can lead to significant fines."
  - q: "What happens to the data when the licence ends?"
    a: "Either all licensed and derived data must be deleted within 30 days with certified destruction, or the licensee has a 90-day wind-down period to stop using the data, migrate and complete deletion. Retention of derived data is a key negotiation point."
  - q: "What is the difference between an exclusive and a non-exclusive data licence?"
    a: "Under an exclusive licence only the licensee may use the data and the provider cannot license it to anyone else. Under a non-exclusive licence the provider may license the same data to others, including the licensee's competitors. Exclusivity commands premium pricing."
---

## What it is and when it is used

This agreement is used for data partnerships such as the licensing of audience segments, behavioural or contextual data and analytics for advertising and measurement. The parties describe the data categories, the licence fee and (optionally) the term in months. Standard terms cover the licence grant, secure delivery (API, SFTP or another agreed method) with documentation, security measures (encryption, access controls, logging, incident response), confidentiality and the provider's warranties that it may license the data, that the data was lawfully collected and that the necessary consents and legal bases exist.

## Who signs it and in which role

The **Data Provider** (the licensor that owns or controls the data) and the **Data Licensee** (the buyer of access).

## Key clauses

### Scope, use and exclusivity
Named datasets listed in a schedule, all data within defined categories (including future data), or full platform access. Permitted use as described in the questions above. An exclusive or non-exclusive licence.

### Pricing and quality
A flat annual fee (increases capped at 5% a year), usage-based CPM, or a revenue share. A guaranteed accuracy SLA with service credits, or best-effort quality with no SLA.

### Privacy and prohibited uses
Independent controllers, or a controller and processor relationship. Strict prohibitions (re-identification, merging with personal data, cross-device tracking) or standard industry restrictions that allow cross-device tracking with consent and clean rooms.

### Retention and audit
Deletion within 30 days of termination, or a 90-day wind-down. Full audit rights up to twice a year, or annual self-certification with audits only on reasonable suspicion.

### Liability and territory
Mutual indemnification capped at the annual fees, or a provider-favourable limitation. Use restricted to named territories, or a worldwide licence with transfer safeguards.

### EU Data Act
A twelfth clause positions the agreement under the EU Data Act (Regulation (EU) 2023/2854, applicable since 12 September 2025). Either the parties record that the terms were negotiated rather than imposed, acknowledge the Act's control of unfair terms and, where data from connected products is licensed, build in its mandatory minimums; or they record their assessment that the Act does not apply. That record cannot disapply the Act if it does in fact apply.

## What the two sides usually negotiate

The Data Provider prefers named datasets, targeting-only use, non-exclusivity, best-effort quality, strict prohibitions, immediate deletion, full audit rights, limited provider liability and territory restrictions. The Data Licensee prefers full platform access, comprehensive use, exclusivity, a guaranteed SLA, a wind-down period, self-certification and a worldwide licence. The balanced positions are targeting plus analytics and measurement, mutual indemnification with a cap and the Data Act conformity package; standard industry restrictions are the closest to the middle on prohibited uses. When the parties disagree, Dealroom proposes these middle-ground options, weighted by how firmly each side holds its position.

## Jurisdictions and languages Dealroom supports for it

Dealroom drafts this agreement under the law of **California**, **England and Wales** or **Spain**, in **English** or **Spanish**. For California, the template applies the CCPA and CPRA, treats a licence of personal information for value as a "sale" (or a "share" for cross-context behavioural advertising), requires the licensee to honour opt-out signals such as Global Privacy Control and deletion requests, and, where the provider is a data broker, records its registration and its processing of deletion requests from the Delete Act platform (DROP) from 1 August 2026, passed on to the licensee. For England and Wales, it applies UK GDPR and the Data Protection Act 2018 as amended by the Data (Use and Access) Act 2025, treats the terms as a data sharing agreement under the ICO's code, and uses UK adequacy regulations, the IDTA or the UK Addendum for transfers. For Spain, it applies the LOPDGDD and GDPR, names the AEPD as supervisory authority, requires a data protection impact assessment where needed, sends disputes to the courts of Madrid, and relies on the EU-US Data Privacy Framework or the EU standard contractual clauses (Decision 2021/914) for transfers outside the EEA.

## Common mistakes

- **Over-broad scope.** It may sweep in protected personal data; audience segments may be personal data under GDPR and the CCPA.
- **Wrong privacy roles.** Misclassifying controller and processor can lead to significant fines.
- **Unclear rights in derived data.** What the licensee may keep after termination should be agreed.
- **Allowing model training without thought.** It raises significant privacy and IP concerns.
- **Low liability caps for breaches.** GDPR fines can reach 4% of global turnover.
- **Unplanned cross-border transfers.** Transfers outside the EEA need an adequacy decision or safeguards such as the SCCs.
