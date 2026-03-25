# Documentation

## Available Docs

| Document | Description |
|----------|-------------|
| [deployment.md](./deployment.md) | Multi-brand architecture, Vercel setup, environment variables, adding new brands |
| [administration.md](./administration.md) | Two-level admin system, deal lifecycle, signing, lawyer involvement stages |
| [lawyer-involvement.md](./lawyer-involvement.md) | Dedicated guide to the three stages of lawyer involvement (EN) |
| [intervencion-abogado.md](./intervencion-abogado.md) | Guía de las tres fases de intervención de abogado/a (ES) |
| [agent-api.md](./agent-api.md) | Agent Negotiation REST API reference — authentication, playbooks, negotiation flow, endpoints |
| [a2a-contracts.md](./a2a-contracts.md) | Agent-to-Agent contract skills — 12 A2A skills, Gavel dispute resolution, subscription model |
| [skills-and-licensing.md](./skills-and-licensing.md) | Complete guide to skill packages, licensing, activation, and i18n |

## Architecture Overview

Dealroom is a single codebase serving multiple brands. The brand is selected at build time via `NEXT_PUBLIC_BRAND` (default: `todo`). Each brand gets its own Vercel project, database, and domain.

```
NEXT_PUBLIC_BRAND=todo      → dealroom.todo.law     (rounded blue, magic-link auth)
NEXT_PUBLIC_BRAND=northend  → dealroom.northend.law  (brutalist teal, invite-code auth)
```

See [deployment.md](./deployment.md) for the full multi-brand architecture.

## Generating FAQ Pages

The `skills-and-licensing.md` document is structured for easy FAQ extraction:

- **Overview** → "What is Dealroom's business model?"
- **Core Concepts** → "What is a skill?", "What's in a skill package?"
- **Licensing Model** → "What license types are available?", "How do jurisdiction tiers work?"
- **How Activation Works** → "How do I activate my license?", "What about air-gapped systems?"
- **Multilingual Support** → "Can parties negotiate in different languages?"
- **Troubleshooting** → Direct FAQ answers for common errors

Each section heading maps to a potential FAQ category.
