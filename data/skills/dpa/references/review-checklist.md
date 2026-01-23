# DPA Compliance Review Checklist

Systematic review against GDPR Article 28, UK GDPR, and CCPA/CPRA requirements.

---

## 1. Parties & Roles

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Controller clearly identified | Full legal name, address, contact | Vague or missing |
| ☐ | Processor clearly identified | Full legal name, address, contact | Vague or missing |
| ☐ | Roles correctly assigned | Controller determines purposes/means | Roles confused or reversed |
| ☐ | DPA linked to main agreement | References principal agreement | Standalone without context |

### Critical Flags:
- **🔴 CRITICAL**: Processor determines purposes of processing (they're actually a controller)
- **🔴 CRITICAL**: No clear identification of which party is controller vs processor
- **⚠️ WARNING**: No data protection contact specified

---

## 2. Scope and Purpose (Art. 28(3))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Subject matter defined | Clear description of services | Vague "all services" |
| ☐ | Duration specified | Tied to agreement or specific period | Indefinite/unclear |
| ☐ | Nature of processing | Operations described (collection, storage, etc.) | Not specified |
| ☐ | Purpose of processing | Clear, limited purpose | Overly broad or undefined |
| ☐ | Data categories listed | Specific types of personal data | "All data" without specifics |
| ☐ | Data subject categories | Who the data is about | Not specified |

### Critical Flags:
- **🔴 CRITICAL**: No description of processing activities
- **🔴 CRITICAL**: Purpose allows processor to use data for own purposes
- **⚠️ WARNING**: Special category data processed without explicit acknowledgment

---

## 3. Processing on Instructions (Art. 28(3)(a))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Documented instructions required | Written/documented instructions | Verbal instructions accepted |
| ☐ | Processing limited to instructions | Only as instructed by controller | Processor has discretion |
| ☐ | Legal requirement exception | May process if required by law | No legal compliance carve-out |
| ☐ | Notification of legal requirement | Must inform controller (unless prohibited) | No notification requirement |
| ☐ | Instruction infringement notice | Must warn if instruction violates law | No warning obligation |

### Critical Flags:
- **🔴 CRITICAL**: No requirement to process only on documented instructions
- **🔴 CRITICAL**: Processor can determine how to process without controller input
- **⚠️ WARNING**: No obligation to inform controller of legal requirements

---

## 4. Confidentiality (Art. 28(3)(b))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Personnel confidentiality | Commitment or statutory obligation | No confidentiality requirement |
| ☐ | Access limited | Only authorized personnel | Unrestricted access |
| ☐ | Training mentioned | Staff trained on data protection | No training requirement |

### Critical Flags:
- **🔴 CRITICAL**: No confidentiality obligations on processor's personnel
- **⚠️ WARNING**: No mention of limiting access to need-to-know basis

---

## 5. Security Measures (Art. 28(3)(c) & Art. 32)

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Appropriate measures required | Technical and organizational measures | No security requirements |
| ☐ | Risk-based approach | Appropriate to risk level | One-size-fits-all |
| ☐ | Specific measures listed | Encryption, access control, etc. | Vague "reasonable security" |
| ☐ | Art. 32 elements addressed | Confidentiality, integrity, availability, resilience | Missing elements |
| ☐ | Regular testing | Testing and evaluation of measures | No testing requirement |
| ☐ | Annex with details | Detailed security annex | No specifics provided |

### Critical Flags:
- **🔴 CRITICAL**: No security measures specified at all
- **🔴 CRITICAL**: Processor can unilaterally reduce security measures
- **⚠️ WARNING**: No requirement for encryption
- **⚠️ WARNING**: No testing or evaluation of measures

---

## 6. Sub-processors (Art. 28(3)(d) & 28(2))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Authorization required | General or specific authorization | No authorization mechanism |
| ☐ | Current list available | List of sub-processors provided | No visibility into sub-processors |
| ☐ | Change notification | Notice before engaging new sub-processor | No notice required |
| ☐ | Objection right | Controller can object to changes | No objection mechanism |
| ☐ | Flow-down obligations | Same data protection obligations | Weaker obligations permitted |
| ☐ | Processor remains liable | Fully liable for sub-processor acts | Liability shifted to sub-processor |

### Critical Flags:
- **🔴 CRITICAL**: Processor can engage sub-processors without any authorization
- **🔴 CRITICAL**: No requirement to flow down data protection obligations
- **🔴 CRITICAL**: Processor disclaims liability for sub-processor breaches
- **⚠️ WARNING**: No sub-processor change notification
- **⚠️ WARNING**: Notification period unreasonably short (<14 days)

---

## 7. Data Subject Rights Assistance (Art. 28(3)(e))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Assistance obligation | Must assist controller with requests | No assistance obligation |
| ☐ | Appropriate measures | Technical/organizational assistance | Vague or no measures |
| ☐ | Request forwarding | Must forward direct requests to controller | May respond independently |
| ☐ | Rights covered | Access, rectification, erasure, etc. | Limited rights covered |
| ☐ | Timeline | Prompt assistance (enables controller compliance) | Unreasonable delays permitted |

### Critical Flags:
- **🔴 CRITICAL**: No obligation to assist with data subject rights
- **🔴 CRITICAL**: Processor may respond to requests without controller authorization
- **⚠️ WARNING**: Assistance subject to unreasonable fees

---

## 8. Compliance Assistance (Art. 28(3)(f))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Security assistance | Help with Art. 32 compliance | No security assistance |
| ☐ | Breach notification support | Help with breach obligations | No breach support |
| ☐ | DPIA assistance | Help with impact assessments | No DPIA support |
| ☐ | Prior consultation support | Help with supervisory authority consultation | No consultation support |

### Critical Flags:
- **🔴 CRITICAL**: No obligation to assist with any compliance matters
- **⚠️ WARNING**: Assistance limited to only some obligations

---

## 9. Breach Notification (Art. 33/34)

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Notification required | Must notify controller of breaches | No notification obligation |
| ☐ | Timeline specified | "Without undue delay" (ideally ≤72 hours) | No timeline or unreasonably long |
| ☐ | Information requirements | Nature, scope, consequences, measures | Minimal information required |
| ☐ | Cooperation | Must cooperate with investigation | Limited cooperation |

### Critical Flags:
- **🔴 CRITICAL**: No breach notification obligation
- **🔴 CRITICAL**: Notification timeline >72 hours without justification
- **🔴 CRITICAL**: Processor can determine whether to notify (should be controller's decision)
- **⚠️ WARNING**: Required information incomplete

---

## 10. Deletion/Return (Art. 28(3)(g))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Controller choice | Delete or return at controller's choice | Processor decides |
| ☐ | Timeline specified | Reasonable period (30-90 days) | No timeline or too long |
| ☐ | Copies deleted | All copies unless law requires retention | Copies may be retained |
| ☐ | Certification | Written confirmation of deletion | No certification |
| ☐ | Legal retention exception | May retain if legally required | No legal exception |

### Critical Flags:
- **🔴 CRITICAL**: No deletion or return obligation
- **🔴 CRITICAL**: Processor retains data indefinitely
- **⚠️ WARNING**: No certification of deletion
- **⚠️ WARNING**: Timeline >90 days

---

## 11. Audit Rights (Art. 28(3)(h))

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Information access | Must provide compliance information | No information access |
| ☐ | Audit right | Controller can audit or mandate auditor | No audit right |
| ☐ | Contribution | Processor must contribute to audits | Passive only |
| ☐ | Reasonable conditions | Notice period, scope, confidentiality | Unreasonable restrictions |

### Critical Flags:
- **🔴 CRITICAL**: No audit rights for controller
- **🔴 CRITICAL**: Processor can refuse audits
- **⚠️ WARNING**: Audit rights limited to once per year without exception
- **⚠️ WARNING**: Excessive audit fees

---

## 12. International Transfers (Chapter V)

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Transfer restrictions | No transfer without safeguards | Unrestricted transfers |
| ☐ | Adequacy or safeguards | SCCs, BCRs, or adequacy decision | No mechanism specified |
| ☐ | SCCs included | If needed, properly incorporated | SCCs missing or outdated |
| ☐ | SCC modules correct | Module Two for C2P | Wrong module |
| ☐ | UK IDTA (if UK data) | UK Addendum if UK data transferred | UK transfers without IDTA |
| ☐ | Supplementary measures | Additional protections if needed | No supplementary measures |

### Critical Flags:
- **🔴 CRITICAL**: International transfers without any legal mechanism
- **🔴 CRITICAL**: Using pre-2021 SCCs (superseded)
- **⚠️ WARNING**: No Transfer Impact Assessment referenced
- **⚠️ WARNING**: SCCs not properly completed (missing annexes)

---

## 13. CCPA/CPRA Compliance (if applicable)

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Service Provider status | Processor qualifies as Service Provider | Not addressed |
| ☐ | No selling/sharing | Prohibited from selling/sharing PI | May sell or share |
| ☐ | Purpose limitation | Only for contracted services | Can use for own purposes |
| ☐ | Direct relationship prohibition | Cannot use outside direct relationship | Can combine with other data |
| ☐ | Compliance certification | Processor certifies CCPA compliance | No certification |
| ☐ | Remediation rights | Controller can stop unauthorized use | No remediation right |

### Critical Flags:
- **🔴 CRITICAL**: Processor may sell or share Personal Information
- **🔴 CRITICAL**: Processor can use PI for own purposes
- **⚠️ WARNING**: No CCPA/CPRA provisions for California data

---

## 14. Liability and Indemnification

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | Processor liability | Liable for DPA breaches | Full liability exclusion |
| ☐ | Sub-processor liability | Processor liable for sub-processors | Liability disclaimed |
| ☐ | Indemnification | Processor indemnifies controller | No indemnification |
| ☐ | No unlawful exclusions | Doesn't exclude mandatory liability | Excludes GDPR liability |

### Critical Flags:
- **🔴 CRITICAL**: Processor excludes all liability for data protection breaches
- **🔴 CRITICAL**: Controller indemnifies processor for processor's own breaches
- **⚠️ WARNING**: Unreasonably low liability cap for data protection

---

## 15. General Provisions

| Check | Item | Compliant | Non-Compliant |
|-------|------|-----------|---------------|
| ☐ | DPA precedence | DPA prevails for data protection matters | Main agreement prevails |
| ☐ | Written amendments | Changes require written agreement | Unilateral changes allowed |
| ☐ | Governing law | Appropriate jurisdiction | Inappropriate jurisdiction |
| ☐ | Survival | Data protection obligations survive | Obligations end on termination |

### Critical Flags:
- **🔴 CRITICAL**: Processor can unilaterally amend DPA
- **⚠️ WARNING**: Main agreement overrides DPA for data protection

---

## Summary Scoring Guide

| Category | Criteria |
|----------|----------|
| **✅ Compliant** | All Art. 28(3) requirements present, no critical flags |
| **⚠️ Minor Gaps** | No critical flags, but 1-3 warnings needing attention |
| **🔴 Material Deficiencies** | Any critical flag = non-compliant with GDPR Art. 28 |

### Remediation Priority

1. Missing mandatory Art. 28(3) provisions
2. International transfer mechanisms (if data leaves EEA/UK)
3. Sub-processor controls and flow-down
4. Breach notification timeline
5. Audit rights
6. CCPA compliance (if California data)
