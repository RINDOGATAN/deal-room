---
contractType: "BAA_NEGOTIATOR"
title: "Business associate agreement (BAA) template under HIPAA"
description: "HIPAA business associate agreement explained: breach and incident clocks, access and amendment deadlines, termination, return of PHI and liability caps."
heading: "HIPAA business associate agreement (BAA)"
summary: "A business associate agreement is the contract HIPAA requires when a vendor creates, receives, maintains or transmits protected health information (PHI) for a covered entity or for another business associate. Dealroom's version is a precautionary, \"springing\" BAA for services that are not designed to handle PHI: its obligations apply only if PHI in fact reaches the vendor."
related: ["data-processing-agreement", "saas-agreement", "master-services-agreement", "privacy-notice"]
faq:
  - q: "When is a business associate agreement required?"
    a: "Under HIPAA, a BAA is required when a vendor creates, receives, maintains or transmits PHI on behalf of a covered entity or a business associate. If the vendor never touches PHI in any form, a BAA is not required, and signing one anyway is not free protection, because it brings obligations with it."
  - q: "How long does a business associate have to report a breach?"
    a: "The federal rule (45 CFR 164.410(b)) requires the report without unreasonable delay and in no case later than 60 calendar days from discovery. No contract can extend that limit. Dealroom's options are five business days, ten calendar days or thirty calendar days, and each is an outer limit, not a right to wait."
  - q: "What is a springing BAA?"
    a: "It is a BAA for a service that is not designed to handle PHI. The customer promises not to send PHI, and the agreement's obligations apply only if, and to the extent that, the vendor in fact receives PHI. If the services do involve PHI by design or in routine practice, a springing BAA is the wrong instrument and a conventional BAA is needed."
  - q: "Does a HIPAA BAA also satisfy the GDPR?"
    a: "No. A HIPAA-compliant BAA does not satisfy Article 28 of the GDPR, and a GDPR data processing agreement does not satisfy 45 CFR 164.504(e). If personal data of people in the EU or EEA can reach the vendor, the parties need the BAA plus a GDPR rider or a separate data processing agreement."
  - q: "Can a BAA limit the vendor's liability?"
    a: "Between the two companies, yes. Dealroom offers three positions: the services agreement's ordinary cap, a supercap of twice that cap for the vendor's security failures and breaches, or no cap for willful misconduct. No cap affects the vendor's direct liability to the government under HIPAA."
---

## What it is and when it is used

A business associate agreement (BAA) is the contract that the HIPAA rules (45 CFR Parts 160 and 164) require between a covered entity, such as a healthcare provider or health plan, and a vendor that handles protected health information (PHI) on its behalf. The same structure applies one level down, between a business associate and its own subcontractor.

Dealroom's BAA is built for a specific situation: a service that is **not designed to handle PHI**, signed as a precaution because the customer works in healthcare. The agreement states that the services do not require PHI, that the vendor does not ask for or accept it, and that the obligations apply only if PHI in fact reaches the vendor. This is often called a "springing" BAA.

Before choosing any option, the skill asks a threshold question: is a BAA the right instrument at all?

- If the vendor never touches PHI in any form, a BAA is not required.
- If the services involve PHI by design or in routine practice, this springing form is the wrong instrument, and the deal needs a conventional BAA.
- HHS accepts both a standalone BAA and BAA terms written into the services agreement. This one is standalone and relies on the services agreement (the "Underlying Agreement") for liability, notices and venue.

## Who signs it and in which role

Two parties sign:

- **Company (Business Associate):** the vendor that provides the services.
- **Customer (Covered Entity or upstream Business Associate):** the healthcare organisation, or a business associate that buys services from the vendor and acts as the customer.

In the subcontractor case, read "Company" as the subcontractor and "Customer" as the upstream business associate.

## Key clauses

### Fixed protections

Several sections are the same in every deal. They define terms by reference to HIPAA, oblige the customer to use reasonable efforts not to send PHI (a material term), and set out what happens if PHI arrives by mistake: the vendor notifies the customer within five business days, deletes or returns it, and has no further duty for that PHI. The fixed text also covers subcontractor flow-down, permitted uses, safeguards under the Security Rule, minimum necessary use, an accounting of disclosures within fifteen days, access by HHS to the vendor's records, mitigation, and an amendment mechanism if the HIPAA rules change.

### Report of security incidents

The vendor gives one standing notice of attempted but unsuccessful attacks (pings, port scans, failed log-ins) so that neither side is flooded with reports. Successful incidents must be reported within the agreed clock. The regulation sets no number for this report: every option, including 72 hours, is market practice.

### Report of breach

This sets how quickly the vendor reports a breach of unsecured PHI. The definition of "discovery" is fixed to the federal rule, including knowledge imputed to the vendor's staff. The customer handles the risk assessment and the notifications to individuals, the media and HHS, with the vendor's cooperation. If the PHI was sent in breach of the no-PHI promise and the vendor was not at fault, the customer bears the reasonable costs.

### Individual access and amendment of PHI

Where the vendor holds PHI in a designated record set, it must make it available so the customer can answer an individual's request to see it or correct it. Requests sent directly to the vendor are passed to the customer.

### Term and termination

The customer may end the BAA and the services agreement for a material breach that the vendor does not cure within the agreed window, or immediately if cure is not feasible. The vendor has a fixed thirty-day window to end the agreement if the customer breaches it, including by knowingly or repeatedly sending PHI.

### Return or destruction of PHI

At the end, the vendor returns or destroys any PHI it still holds. If that is not feasible, the protections continue for as long as it keeps the data. Business convenience alone does not make return or destruction infeasible.

### Indemnification and limitation of liability

The customer indemnifies the vendor for claims caused by sending PHI in breach of the no-PHI promise. Otherwise, the services agreement's indemnities and caps apply, and the negotiation is about how the vendor's security failures and breaches are capped.

## What the two sides usually negotiate

Each negotiable clause has three positions. Dealroom proposes the balanced position as the middle ground when the two sides disagree.

- **Security incident report:** Company prefers seven business days, Customer prefers 72 hours; the middle ground is **five business days**.
- **Breach report:** Company prefers thirty calendar days (strongly in its favour) or ten calendar days; the middle ground, and the shortest option, is **five business days**.
- **Individual access:** Company prefers thirty or twenty calendar days; the middle ground, and the shortest option, is **fifteen calendar days**.
- **Amendment of PHI:** Company prefers forty-five calendar days, Customer prefers twenty; the middle ground is **thirty calendar days**.
- **Customer's cure period before termination:** Company prefers forty-five calendar days, Customer prefers fifteen; the middle ground is **thirty calendar days**.
- **Return or destruction of PHI:** Company prefers sixty calendar days, Customer prefers thirty; the middle ground is **forty-five calendar days**.
- **Liability:** Company prefers the services agreement's ordinary cap, Customer prefers no cap for willful misconduct; the middle ground is a **supercap of twice the ordinary cap** for the vendor's Security Rule failures, impermissible uses or disclosures, and breaches it causes.

The reasoning on each side is straightforward. The vendor wants time to investigate before reporting, to fix problems before termination, and to clear backups. The customer wants to know early, to keep enough of its own legal deadlines, and to recover breach costs, which usually exceed a cap based on service fees.

The skill states plainly that a middle position is not fair in every case. For example, if the vendor acts as the customer's agent, the customer is treated as discovering a breach when the vendor does, so every day of vendor reporting time comes off the customer's own 60-day deadline to notify individuals. In that situation the customer is entitled to a much shorter clock.

## Jurisdictions and languages Dealroom supports for it

Dealroom offers this BAA for **California** and in **English** only. HIPAA is federal law, and the agreement is otherwise not tied to any state: it carries California governing law by default, subject to federal preemption. Disputes go to the forum the parties designated in the services agreement, or, if none, to the state and federal courts of the state whose law governs. The parties should confirm this before use.

## Common mistakes

- **Using the springing form for a service that handles PHI routinely.** Its devices (the no-PHI promise, the inadvertent-receipt path, the cost shift) then work against the customer.
- **Treating 60 days as a negotiable breach deadline.** It is the federal outer limit, and the report must also be made without unreasonable delay.
- **Choosing a 30-day access turnaround.** It consumes the customer's entire 30-day window to answer the individual, leaving it dependent on its single extension. The skill marks this option, and the 30-day breach option, as calling for a warning.
- **Letting the narrow "discovery" definition for security incidents govern breach reporting.** The breach clause stays tied to the federal definition.
- **Agreeing a turnaround the vendor cannot pass down to its subcontractors.** A number that cannot be flowed down is an empty promise.
- **Words and numerals that disagree**, such as "forty-five (15)" days. This kind of error creates an ambiguity a party can exploit at the moment of termination.
- **Assuming the BAA covers EU or EEA personal data.** It does not satisfy the GDPR; a rider or separate [data processing agreement](/contracts/data-processing-agreement) is needed.
- **Reading a cap as limiting what individuals or regulators can recover.** The cap only divides costs between the two companies.
