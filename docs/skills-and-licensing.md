# Skills & Licensing System

This document explains how Deal Room's skill packaging and licensing system works. Use this as a reference for generating FAQ pages and onboarding documentation.

---

## Overview

Deal Room uses a "free coffee machine, paid capsules" model:
- **The platform is open-source** - anyone can run Deal Room
- **Skills are proprietary** - contract templates (NDA, DPA, MSA, etc.) are sold as licensed packages
- **Jurisdictions are tiered** - customers pay for specific jurisdictions they need

---

## Taster vs Premium Skills

Deal Room includes free "taster" skills so users can experience the platform before purchasing premium licenses.

### What are Taster Skills?

Taster skills are basic contract templates (NDA, MSA, DPA) included with the open-source platform. They demonstrate Deal Room's negotiation workflow without requiring a license.

### What's the difference?

| Feature | Taster Skills | Premium Skills |
|---------|---------------|----------------|
| **Price** | Free | Licensed |
| **Languages** | English only | Multilingual (EN, ES, DE, FR, PT) |
| **Jurisdictions** | Basic coverage | Deep jurisdiction-specific provisions |
| **Cross-language negotiation** | No | Yes (Party A in English, Party B in Spanish) |
| **Version updates** | As-is | Regular updates with legal changes |
| **Support** | Community/self-service | Paid support included |
| **Clause depth** | Standard options | Extended options with nuanced variations |
| **Legal review** | Sample content | Professionally reviewed content |

### Why offer free taster skills?

1. **Try before you buy** - Experience the full negotiation workflow risk-free
2. **Proof of value** - See how Deal Room improves contract negotiations
3. **Easy onboarding** - Start using the platform immediately
4. **Open-source commitment** - Core functionality remains accessible

### When should I upgrade to Premium?

Consider premium skills when you need:
- Contracts in multiple languages
- Parties who prefer different languages
- Jurisdiction-specific legal provisions
- Ongoing updates as laws change
- Professional support

### Can I use taster skills in production?

Yes. Taster skills are fully functional for real negotiations. However, they lack the depth, translations, and ongoing maintenance of premium skills. For critical business contracts, premium skills provide greater legal coverage.

---

## Core Concepts

### What is a Skill?

A skill is a contract template package containing:
- **Clauses** - negotiable contract provisions with multiple options
- **Boilerplate** - standard contract language (preamble, definitions, signature blocks)
- **Metadata** - version, supported jurisdictions, available languages

Each clause has 3+ options with:
- Plain language descriptions
- Legal text
- Pros/cons for each party
- Bias scores (-1 to +1) indicating which party the option favors

### What is a Skill Package?

A `.skill` file is a signed ZIP archive:
```
skill-nda-v1.2.3.skill
├── manifest.json        # Package metadata and file hashes
├── license.json         # License terms (optional, for offline)
├── content/
│   ├── clauses.json     # Clause definitions with i18n
│   ├── boilerplate.json # Standard contract sections
│   └── references/      # Additional legal references
└── signature.sig        # Ed25519 digital signature
```

The signature ensures packages haven't been tampered with. Only packages signed with NEL's private key are accepted.

---

## Licensing Model

### License Types

| Type | Duration | Use Case |
|------|----------|----------|
| **Trial** | Time-limited (e.g., 14 days) | Evaluation before purchase |
| **Subscription** | Renewable (monthly/yearly) | SaaS customers |
| **Perpetual** | Forever | Self-hosted enterprises |

### Customer Types

| Type | Validation | Use Case |
|------|------------|----------|
| **SaaS** | API call to license server | Cloud-hosted customers |
| **Self-Hosted** | Cryptographic license file | Air-gapped/on-premise deployments |

### Jurisdiction Tiers

Skills support multiple jurisdictions (e.g., US-CA, GB, ES). Customers purchase access to specific jurisdictions:

- **Single** - One jurisdiction (e.g., California NDA)
- **Regional** - Bundle (e.g., US + UK)
- **Global** - All available jurisdictions

The entitlement stores which jurisdictions the customer paid for. Deal creation checks this before allowing a specific governing law.

---

## How Activation Works

### Online Activation (SaaS)

1. Customer receives license key: `LIC-XXXX-XXXX-XXXX-XXXX`
2. Enters key in Deal Room settings
3. System validates key against license server
4. Activation recorded with machine fingerprint
5. Skills become available for use

### Offline Activation (Self-Hosted)

For air-gapped deployments that can't phone home:

1. Customer runs `npm run license:fingerprint` to get machine ID
2. Sends fingerprint to license administrator
3. Receives signed `license.json` file
4. Imports license file into Deal Room
5. System validates signature (no network required)
6. Skills become available for use

### Activation Limits

Each license has a maximum number of activations (machines). This prevents license sharing while allowing legitimate reinstalls.

To move a license:
1. Deactivate on old machine: `npm run skill:deactivate`
2. Activate on new machine: `npm run skill:activate`

---

## Multilingual Support (i18n)

Skills support multiple languages within the same package. This enables:

- **Cross-language negotiation** - Party A sees English, Party B sees Spanish
- **Single source of truth** - No drift between translations
- **Language-independent governing law** - Display language ≠ legal jurisdiction

### Content Format

Localized strings use language code keys:
```json
{
  "title": {
    "en": "Confidentiality Duration",
    "es": "Duración de Confidencialidad"
  }
}
```

Legacy format (plain strings) defaults to English and remains supported.

### Fallback Chain

If a translation is missing:
1. Try requested language
2. Try fallback languages (e.g., Portuguese → Spanish → English)
3. Try default language (English)
4. Use first available translation

---

## Platform Administration

Platform Admins manage skills and customer entitlements via the admin portal at `/admin`.

### Admin Portal Features

| Section | Purpose |
|---------|---------|
| `/admin/skills` | View installed skills, versions, jurisdictions |
| `/admin/customers` | View customers and their entitlements |
| `/admin/analytics` | Usage analytics by skill and jurisdiction |

### Customer Entitlement Management

Platform Admins can:
- View which skills each customer has access to
- See jurisdiction coverage per entitlement
- Monitor license usage and activations

See `docs/administration.md` for full admin portal documentation.

---

## Installation & Management

### Installing a Skill Package

**From signed package:**
```bash
npm run skill:install ./nda-v1.2.3.skill
```

**From directory (development):**
```bash
npm run skill:install ./skills/nda/
```

### Listing Installed Skills

```bash
npm run skill:list
```

Shows: skill ID, version, jurisdictions, languages, activation count.

### Verifying a Package

```bash
npm run skill:verify ./nda.skill
```

Checks signature, file integrity, and content schema.

### Uninstalling

Only available if no active deals use the skill:
```bash
# Via tRPC API (admin only)
skillManager.uninstall({ skillId: "com.nel.skills.nda" })
```

---

## Entitlement Checks

Before creating a deal, the system verifies:

1. **Skill access** - Does customer have an active entitlement?
2. **Jurisdiction access** - Is the selected governing law in the entitlement?
3. **Activation status** - Is this machine activated for the skill?
4. **Expiration** - Has the license expired?

If any check fails, deal creation is blocked with a descriptive error.

---

## Security Model

### Package Integrity

- Packages are signed with Ed25519 (fast, secure, deterministic)
- Manifest contains SHA-256 hashes of all files
- Unsigned or tampered packages are rejected

### License Security

- License keys are cryptographically random
- Offline licenses are signed and verified without network
- Machine fingerprints prevent casual license sharing
- Activation limits enforce license terms

### What's Protected

| Component | Protection |
|-----------|------------|
| Platform code | Open source (public) |
| Skill content | Licensed (proprietary) |
| Signing key | Private (never distributed) |
| License server | Private infrastructure |

---

## Troubleshooting

### "No entitlement found for this skill"

**Cause:** Customer hasn't activated a license for this skill.

**Solution:**
1. Purchase a license at [sales portal]
2. Run `npm run skill:activate --license-key=LIC-XXXX-XXXX-XXXX-XXXX`

### "Jurisdiction not included in license"

**Cause:** Customer's license doesn't cover the selected governing law.

**Solution:**
1. Upgrade license to include additional jurisdictions
2. Or select a jurisdiction covered by current license

### "Activation limit reached"

**Cause:** License is already activated on maximum number of machines.

**Solution:**
1. Deactivate on unused machine: `npm run skill:deactivate`
2. Then activate on new machine

### "Invalid license file signature"

**Cause:** Offline license file is corrupted or tampered with.

**Solution:**
1. Request new license file from administrator
2. Ensure file wasn't modified after generation

### "Package signature verification failed"

**Cause:** Skill package is unsigned, corrupted, or from untrusted source.

**Solution:**
1. Download package from official source
2. Verify file wasn't modified during transfer

---

## API Reference

### tRPC Routes (`skillManager`)

| Route | Auth | Description |
|-------|------|-------------|
| `listInstalled` | Public | List all installed skill packages |
| `listAvailable` | Protected | Skills customer has access to |
| `getPackageDetails` | Protected | Full skill package details |
| `installFromDirectory` | Admin | Install from local directory |
| `uninstall` | Admin | Remove skill package |
| `activate` | Protected | Activate license key |
| `activateOffline` | Protected | Activate with license file |
| `deactivate` | Protected | Deactivate on this machine |
| `deactivateById` | Protected | Deactivate specific activation |
| `checkEntitlement` | Protected | Verify access to skill |
| `listActivations` | Protected | Customer's active machines |
| `getFingerprint` | Protected | Machine identification |
| `generateActivationRequest` | Protected | Create offline activation request |

### CLI Commands

| Command | Description |
|---------|-------------|
| `npm run skill:install <path>` | Install skill package |
| `npm run skill:list` | List installed skills |
| `npm run skill:verify <path>` | Verify package integrity |
| `npm run skill:activate` | Activate license |
| `npm run skill:deactivate` | Deactivate license |
| `npm run license:fingerprint` | Show machine fingerprint |

---

## Glossary

| Term | Definition |
|------|------------|
| **Skill** | A contract template package (NDA, DPA, MSA, etc.) |
| **Skill Package** | Signed `.skill` archive containing clauses and boilerplate |
| **Entitlement** | Customer's license grant for a specific skill |
| **Activation** | Binding of a license to a specific machine |
| **Jurisdiction** | Legal region (US-CA, GB, ES) for governing law |
| **Fingerprint** | Machine identifier (SHA-256 of hostname + MAC) |
| **i18n** | Internationalization - multilingual support |
