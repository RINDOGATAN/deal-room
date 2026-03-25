# Agent-to-Agent Contract Scenarios: Research for Dealroom Legal Skills

> Research date: 2026-03-24
> Purpose: Identify 20-30 real-world A2A scenarios where autonomous AI agents interact and would benefit from negotiable legal terms, to guide creation of 10-15 new Dealroom contract skills.

---

## Table of Contents

1. [Numbered Scenarios (25)](#scenarios)
2. [Dispute Resolution Trends](#dispute-resolution-trends)
3. [Weighted Compromise Algorithm Value](#weighted-compromise-algorithm-value)

---

## Scenarios

### 1. MCP Tool Installation and Licensing Agreement

**Description:** An AI agent discovers and installs a Model Context Protocol (MCP) server from the MCP Registry (launched September 2025) or a private subregistry. The tool may access sensitive data, execute code, or make network requests. The agent's principal (human or organization) needs terms governing what the tool can do, data it can access, and liability for tool misbehavior.

**Typical dispute resolution:** Currently none. The MCP Registry is vendor-neutral and provides no legal terms. Tool authors publish under open-source licenses (typically MIT/Apache 2.0) with no warranties. Disputes would fall to general software liability.

**Key negotiable terms:**
- Scope of data access and permitted operations
- Liability cap for tool errors or data leaks
- Data retention and deletion obligations
- Warranty of fitness for stated purpose
- Indemnification for third-party IP claims
- Termination and revocation of access rights

**Real-world context:** Anthropic released the Agent Skills specification in December 2025 as an open standard (adopted by OpenAI for Codex CLI). SkillsMP.com operates an agent skills marketplace. The 2026 MCP Roadmap includes formal governance and Spec Enhancement Proposals but no legal framework.

---

### 2. A2A Agent Collaboration Agreement

**Description:** Two AI agents from different organizations collaborate via Google's Agent2Agent (A2A) protocol. Agent A (e.g., SAP's Joule) delegates a sub-task to Agent B (e.g., a Google BigQuery analytics agent) to resolve a supply-chain dispute. The agents exchange data, coordinate actions, and produce joint outputs. Neither organization has a pre-existing contract with the other's agent.

**Typical dispute resolution:** The A2A protocol provides technical interoperability (Agent Cards, gRPC, signed security cards as of v0.3) but no legal layer. Google's Cloud legal changelog added "Agentic AI Services" to Section 13 of Service Terms in January 2026, but this covers Google-hosted agents only.

**Key negotiable terms:**
- Scope of delegated authority and task boundaries
- Data sharing permissions and confidentiality
- Liability allocation for joint outputs and errors
- IP ownership of collaboratively generated work product
- SLA for response time and availability
- Audit rights and logging requirements
- Termination triggers and graceful shutdown procedures

**Real-world context:** A2A has 150+ supporting organizations as of July 2025, donated to the Linux Foundation. Agent Cards are published at `/.well-known/agent-card.json` with cryptographic signing for identity verification. No lawsuits yet, but the protocol's lack of legal terms is a recognized gap.

---

### 3. Agentic Commerce Transaction Agreement (ACP)

**Description:** A buyer's AI agent uses the Agentic Commerce Protocol (ACP, maintained by OpenAI and Stripe) to autonomously discover products, negotiate terms, and complete a purchase. The agent broadcasts intent, discovers counterparties, negotiates pricing, verifies identities, and settles payment without human intervention.

**Typical dispute resolution:** ACP is under Apache 2.0 license. Dispute resolution defaults to the buyer's and seller's existing commercial terms. The January 2026 spec added capability negotiation; the January 30 spec added extensions, discounts, and payment handlers. No dedicated arbitration mechanism.

**Key negotiable terms:**
- Price negotiation bounds and discount authority
- Payment terms and currency (fiat vs. USDC)
- Return and refund policies for agent-initiated purchases
- Spending limits and transaction caps
- Liability for erroneous or unauthorized purchases
- Warranty and product conformity guarantees
- Data handling of transaction and browsing history

**Real-world context:** By 2026, billions of autonomous agent transactions are processed daily. Google's Universal Commerce Protocol (UCP), co-developed with Shopify, Etsy, Wayfair, Target, and Walmart, focuses on discovery-to-post-purchase flows with 20+ partners including Visa, Mastercard, and Stripe.

---

### 4. Autonomous Payment Authorization Agreement

**Description:** An AI agent is authorized to make payments on behalf of an individual or organization using Mastercard Agent Pay (agentic tokens), Visa's Trusted Agent Protocol, or Coinbase's x402 protocol. The agent needs defined spending limits, merchant categories, and authorization rules.

**Typical dispute resolution:** Payment network dispute resolution (chargebacks, card network arbitration). Mastercard's Agent Pay Acceptance Framework includes trusted agent recognition and purchase intent data. x402 uses HTTP 402 status codes with USDC settlement; x402 Foundation (Coinbase + Cloudflare) has processed 50M+ transactions.

**Key negotiable terms:**
- Spending caps (per-transaction, daily, monthly, annual)
- Permitted merchant categories and blacklists
- Authorization escalation thresholds requiring human approval
- Liability for unauthorized or hallucination-driven transactions
- Chargeback rights and dispute procedures
- Transaction logging and audit trail requirements
- Revocation procedures and emergency stop mechanisms

**Real-world context:** Privacy.com now offers virtual cards with hard spending caps for AI agents. Visa says consumers retain control through spending limits and merchant preferences. Google's Agent Payments Protocol (AP2) aims for interoperability with x402 and Visa/Mastercard networks.

---

### 5. Agent-Procured Cloud Resource Agreement

**Description:** An AI agent autonomously provisions cloud compute, storage, or GPU resources to complete a task. The agent selects providers, negotiates pricing, spins up instances, and may trigger significant costs. A single agent caught in a "semantic infinite loop" can rack up thousands in compute costs in an afternoon.

**Typical dispute resolution:** Cloud provider terms of service, with billing dispute mechanisms. Most cloud providers offer cost alerts but no automated dispute resolution for agent-initiated spend.

**Key negotiable terms:**
- Budget caps and cost ceilings (hard vs. soft limits)
- Auto-scaling boundaries and instance type restrictions
- Liability for runaway costs and infinite-loop scenarios
- SLA for compute availability and performance
- Data residency and sovereignty requirements
- Resource cleanup and deprovisioning obligations
- Cost attribution and chargeback to specific tasks

**Real-world context:** Gartner predicts 40% of agent projects will be cancelled by 2027 due to infrastructure cost overruns. The Fortune 500 collectively leaked $400M in unbudgeted cloud spend from agentic AI in 2025. Agentic deployments multiply token consumption 20-30x compared to standard generative AI.

---

### 6. Agent Data Sharing and API Consumption Agreement

**Description:** One agent accesses another organization's data via API, RAG pipeline, or direct database query. The consuming agent may cache, transform, or redistribute the data. Enterprise RAG systems require 3-5 year data retention for persistent context, creating long-term data governance obligations.

**Typical dispute resolution:** API terms of service, with SLA credits for downtime. No standard mechanism for disputes about data quality, freshness, or fitness for purpose.

**Key negotiable terms:**
- Data usage scope (purpose limitation, downstream restrictions)
- Data quality warranties (accuracy, freshness, completeness)
- Retention limits and deletion schedules
- Cross-border transfer compliance (GDPR, data sovereignty)
- Rate limiting and fair-use policies
- Caching and redistribution rights
- Indemnification for data inaccuracies causing downstream harm
- Audit rights and compliance verification

**Real-world context:** 71% of organizations cite cross-border data transfer compliance as their top regulatory challenge in 2025. Spain's AEPD published a 71-page framework on agentic AI data protection risks. The GDPR's purpose limitation principle is strained by agents that dynamically select tools and data sources at runtime.

---

### 7. Agent Task Delegation and Sub-Contracting Agreement

**Description:** An orchestrating agent delegates a sub-task to a specialist agent, creating a principal-agent chain. The sub-agent may further delegate to other agents. Each delegation step creates potential liability gaps and accountability questions.

**Typical dispute resolution:** No established mechanism. The liability chain follows the delegation chain in theory, but current authorization systems use pre-defined static scopes that don't handle recursive delegation well. Singapore's IMDA framework (January 2026) recommends "significant checkpoints" requiring human approval.

**Key negotiable terms:**
- Scope of delegated authority (permitted and prohibited actions)
- Sub-delegation rights (can the sub-agent delegate further?)
- Liability waterfall and indemnification chain
- Performance standards and quality metrics
- Escalation procedures for out-of-scope requests
- Confidentiality obligations across the delegation chain
- Audit trail and provenance tracking
- Termination cascading rules

**Real-world context:** Mayer Brown's February 2026 analysis identified six critical areas where SaaS contracting fails for agentic AI, proposing a hybrid SaaS/BPO model. PYMNTS reported that "contracting for agentic AI is starting to look like outsourcing." The EU AI Act has no provision for runtime delegation chains.

---

### 8. AI-Generated Content Licensing Agreement

**Description:** An agent generates content (text, code, images, data analyses) that another agent or organization wants to use. Questions arise about IP ownership, whether the content infringes third-party rights, and licensing terms for derivative use.

**Typical dispute resolution:** Copyright litigation. Over 70 AI copyright infringement lawsuits have been filed, more than doubling from ~30 at end of 2024. The Bartz v. Anthropic case settled for $1.5B.

**Key negotiable terms:**
- IP ownership of generated outputs (all major AI providers now say "you own your outputs")
- IP indemnification for infringement claims (only Microsoft and Anthropic enterprise offer this)
- Permitted derivative uses and sublicensing rights
- Attribution requirements
- Training data provenance warranties
- Takedown and correction procedures for infringing content
- Liability caps for IP infringement claims
- Moral rights and attribution of AI-generated works

**Real-world context:** The D.C. Circuit affirmed that AI cannot be a copyright author. Meta received summary judgment (fair use) for using copyrighted books in training. Thomson Reuters won against ROSS Intelligence (headnotes protectable, fair use failed). The New York Times licensed content to Amazon for $20-25M. Courts are clarifying "transformative training" vs. "substitutive uses" in 2026.

---

### 9. Multi-Agent Supply Chain Orchestration Agreement

**Description:** Multiple specialized AI agents coordinate across organizational boundaries in supply chain operations -- procurement agents, logistics agents, manufacturing agents, quality agents, and finance agents communicate and collaborate, negotiating priorities and resolving conflicts dynamically.

**Typical dispute resolution:** Traditional supply chain contracts, commercial arbitration. IDC predicts 60% of large enterprises will deploy distributed AI to secure supply chains by 2030.

**Key negotiable terms:**
- Inter-agent communication protocols and data standards
- Decision authority boundaries per agent role
- Priority conflict resolution rules
- Liability allocation for supply chain disruptions caused by agent errors
- Real-time data sharing and visibility obligations
- Service level commitments per agent function
- Force majeure and disruption response protocols
- Cost allocation for multi-party agent infrastructure

**Real-world context:** Coca-Cola uses AI agents that cut "where's my truck" query response times from 90 minutes to seconds. BCG reports agentic systems accounted for 17% of total AI value in 2025, projected 29% by 2028. Gartner's 2025 Supply Chain Top 25 highlighted autonomous cross-system orchestration as a defining characteristic of top performers.

---

### 10. Agent SLA and Performance Agreement

**Description:** An organization deploys an agentic AI solution to perform autonomous tasks (customer service, document processing, compliance monitoring). Traditional SaaS uptime SLAs (99.99%) provide little comfort when the agent is "up" but making costly errors. A new contracting model is needed.

**Typical dispute resolution:** Service credits for SLA breaches (traditional), with emerging shift toward outcome-based remediation. The AAA-ICDR launched an AI-native arbitrator in November 2025 for documents-only construction cases, with 20-25% faster resolution and 35%+ cost savings.

**Key negotiable terms:**
- Outcome-based SLAs (accuracy, quality, completion rate) vs. availability SLAs
- Error rate thresholds and hallucination tolerance levels
- Service credits triggered by performance failures, not just downtime
- Human-in-the-loop requirements and escalation thresholds
- Monitoring and observability obligations
- Remediation timelines and correction procedures
- Governance and audit rights
- Performance benchmarking and continuous improvement commitments

**Real-world context:** Gartner predicts Agentic AI will resolve 80% of common customer service issues without human intervention by 2029. 88% of AI vendors impose liability caps limiting damages to monthly subscription fees. Mayer Brown proposes BPO-style SLAs measuring outcomes rather than availability.

---

### 11. Agent Insurance and Indemnification Agreement

**Description:** An organization deploys autonomous AI agents and needs liability coverage for agent-caused harm. Traditional professional liability and general liability insurance policies are increasingly excluding AI-related claims. New specialized insurance products are emerging.

**Typical dispute resolution:** Insurance claim procedures, insurance arbitration. The AIUC-1 framework creates a technical and operational baseline for agent safety assessment.

**Key negotiable terms:**
- Covered agent behaviors and exclusions
- Liability cap per incident and aggregate
- Premium calculation methodology (risk-based, usage-based)
- Safety audit and certification requirements
- Incident reporting and claims procedures
- Subrogation rights against agent providers
- Coverage for hallucination-driven losses
- Coverage territory and jurisdictional scope

**Real-world context:** AIUC emerged from stealth with $15M seed (led by Nat Friedman, with Anthropic cofounder Ben Mann as angel). Munich Re offers AI-specific coverage for law firms. Insurance companies are adding AI-specific exclusions to CGL policies. Insurers are raising premiums, increasing deductibles, and capping AI-related limits.

---

### 12. Agent-to-Agent Knowledge Base Access Agreement

**Description:** An AI agent needs to access a proprietary knowledge base, dataset, or RAG source owned by another organization. The access may be per-query, subscription-based, or usage-based. The data owner needs to control how their data is used, cached, and potentially re-trained upon.

**Typical dispute resolution:** Contract law, with API terms of service as the primary mechanism. No established standard for agent-specific data access agreements.

**Key negotiable terms:**
- Access scope and permitted query types
- Usage-based or per-query pricing
- No-training clause (data cannot be used to train or fine-tune models)
- Data freshness and update frequency guarantees
- Access control and authentication requirements
- Caching duration and local storage restrictions
- Compliance with source data licensing (chain of title)
- Termination and data purge obligations

**Real-world context:** 73% of RAG implementations in 2025 were in large organizations. The GSA's March 2026 proposed contract clause expressly prohibits contractors from using government data to train LLMs. The EU AI Act's August 2026 deadline creates dual obligations for high-risk systems accessing proprietary data.

---

### 13. Autonomous Procurement Contract

**Description:** An AI procurement agent independently analyzes market conditions, evaluates suppliers, negotiates contracts, and manages purchasing workflows within parameters set by human leadership. The agent operates across multiple supplier relationships and may bind the organization to significant commitments.

**Typical dispute resolution:** Commercial arbitration, procurement dispute procedures. Contract disputes follow standard commercial law, but agent-initiated contracts raise questions about authority and binding effect.

**Key negotiable terms:**
- Agent authority limits (maximum contract value, term length)
- Pre-approved supplier lists and qualification criteria
- Price negotiation boundaries and best-price guarantees
- Quality standards and acceptance criteria
- Binding authority and ratification requirements
- Audit trail and decision documentation
- Supplier recourse for agent errors or misrepresentation
- Compliance with procurement regulations (e.g., public sector rules)

**Real-world context:** JAGGAER's "Autonomous Commerce" vision embeds automation and predictive intelligence across Source-to-Pay. Walmart International used Pactum AI to automate 89 supplier contract negotiations targeting early payment discounts. Infosys BPM published a 2026 playbook for agentic AI in procurement. The PON held a 2025 AI Negotiation Summit at MIT.

---

### 14. Agent Hiring and Screening Compliance Agreement

**Description:** An AI agent autonomously screens job applicants, scores candidates, and makes or influences hiring decisions. The agent's decisions must comply with anti-discrimination laws and provide transparency about its decision-making process.

**Typical dispute resolution:** EEOC complaints, federal and state litigation. Active lawsuits include Mobley v. Workday (nationwide class, 2025) and the Eightfold AI class action (January 2026).

**Key negotiable terms:**
- Bias testing and fairness audit requirements
- Transparency obligations (explain scoring methodology)
- Human-in-the-loop requirements for final decisions
- Protected characteristic handling (proxy discrimination prevention)
- Record retention (California requires 4+ years)
- Candidate notification requirements
- Indemnification for discrimination claims
- Compliance with jurisdiction-specific AI hiring laws (Illinois, California, NYC)

**Real-world context:** Mobley v. Workday achieved nationwide class certification in May 2025 for age discrimination via AI screening. The Eightfold lawsuit alleges the company scraped 1B+ workers' data and scored applicants 0-5 without disclosure. The EEOC has made AI bias a top enforcement priority. Illinois law prohibits AI that results in bias against protected classes.

---

### 15. Agent Healthcare Decision-Making Agreement

**Description:** An AI agent assists or autonomously makes diagnostic, treatment, or triage decisions in a healthcare setting. The agent may interact with other agents (lab analysis, imaging, pharmacy) to coordinate patient care.

**Typical dispute resolution:** Medical malpractice litigation, with emerging AI-specific insurance requirements. 2024 data showed 14% increase in malpractice claims involving AI tools vs. 2022.

**Key negotiable terms:**
- Scope of autonomous decision authority (advisory vs. determinative)
- Clinical validation and accuracy requirements
- Human oversight thresholds and escalation triggers
- Patient data handling and HIPAA compliance
- Liability allocation between provider, deployer, and practitioner
- Insurance coverage requirements
- Incident reporting and post-event analysis obligations
- Regulatory compliance (FDA clearance for diagnostic AI)

**Real-world context:** Missed cancer diagnoses by ML software are central in several high-profile lawsuits. California AB 2013 (effective January 2026) requires AI training data disclosures. Colorado's comprehensive AI legislation takes effect February 2026. Malpractice insurers are adding AI-specific exclusions.

---

### 16. Agent Financial Advisory and Trading Agreement

**Description:** An autonomous AI agent provides financial advice, executes trades, or manages investment portfolios. The agent may interact with market data agents, risk assessment agents, and execution agents across multiple financial institutions.

**Typical dispute resolution:** FINRA arbitration for securities disputes, banking regulators for payment disputes. The EU AI Act classifies financial AI as high-risk requiring enhanced oversight.

**Key negotiable terms:**
- Investment mandate boundaries (asset classes, risk levels, concentration limits)
- Fiduciary duty allocation
- Trading authority limits (position size, daily volume)
- Market manipulation prevention controls
- Client suitability assessment obligations
- Performance benchmarking and fee transparency
- Emergency stop and manual override procedures
- Regulatory reporting and compliance obligations

**Real-world context:** The EU AI Act's August 2026 compliance deadline creates specific obligations for financial AI. Taylor Wessing notes that current frameworks do not yet permit fully autonomous payments. Agents are being deployed in money-adjacent workflows (invoice matching, collections, dispute triage) where errors are reversible.

---

### 17. Agent Real Estate Transaction Agreement

**Description:** Multiple AI agents coordinate a real estate transaction -- buyer's agent, seller's agent, escrow agent, title agent, lender's agent, and inspection agent work together to close a property transaction with automated document review, escrow management, and compliance verification.

**Typical dispute resolution:** Real estate arbitration, title insurance claims. Emerging use of AI-powered escrow systems with automated compliance checks.

**Key negotiable terms:**
- Agent authority for offers, counteroffers, and acceptance
- Escrow management rules and release conditions
- Title search accuracy warranties
- Document review standards and error liability
- Wire fraud prevention protocols
- Anti-money laundering compliance (FinCEN March 2026 rule)
- Commission and fee allocation
- Closing timeline commitments and delay penalties

**Real-world context:** Circle's experimental AI-powered escrow agent (2025) combines LLMs with USDC smart contracts for automated settlement. A 2023 Stanford study found AI-reviewed escrow agreements had 42% fewer post-closing disputes. FinCEN's new AML rule (March 2026) substantially changes non-financed residential transfer reporting.

---

### 18. Cross-Border Agent Data Processing Agreement

**Description:** AI agents operating across jurisdictions exchange and process personal data. The GDPR's purpose limitation principle is strained by agents that dynamically select tools and data sources at runtime, and data sovereignty requirements create complex compliance obligations.

**Typical dispute resolution:** Data protection authority complaints, GDPR enforcement actions. The AEPD (Spain) published a 71-page compliance framework for agentic AI under GDPR.

**Key negotiable terms:**
- Data processing purposes and legal bases
- Cross-border transfer mechanisms (SCCs, adequacy decisions, BCRs)
- Data residency and sovereignty requirements
- Sub-processor approval and chain of responsibility
- Data subject rights fulfillment procedures
- Breach notification timelines and procedures
- Data retention schedules and deletion verification
- Privacy impact assessment obligations

**Real-world context:** Data sovereignty is replacing borderless data flows as the dominant paradigm. The AEPD identifies four dimensions of agent memory risk: relevance, consistency, retention, and integrity. The EU AI Act's August 2026 full application creates dual compliance obligations alongside GDPR. 71% of organizations cite cross-border transfers as top challenge.

---

### 19. Agent Skill Marketplace Transaction Agreement

**Description:** An agent or organization purchases a specialized capability (a "skill") from a marketplace. Skills are modular, reusable capabilities that extend AI agents -- from legal summarization to financial forecasting to compliance checking. Pricing models include per-use, subscription, and token-based.

**Typical dispute resolution:** Marketplace terms of service, with platform-mediated dispute resolution. No established standard for skill-specific disputes.

**Key negotiable terms:**
- Skill scope and capability description accuracy
- Performance warranties (accuracy, latency, throughput)
- Pricing model (per-use, subscription, token-based)
- Data handling by the skill (input retention, output usage)
- IP ownership of skill-generated outputs
- Uptime and availability commitments
- Update and deprecation notification requirements
- Refund and credit policies for underperformance

**Real-world context:** The agentic AI market is projected to grow from $7.06B (2025) to $93.20B (2032) at 44.6% CAGR. Anthropic's Agent Skills specification (December 2025) was adopted by OpenAI. The "Skill Economy" is replacing prompt engineering, with marketplace platforms emerging for skill discovery and purchase.

---

### 20. Agent Orchestration Platform Agreement

**Description:** An organization uses a multi-agent orchestration platform (LangChain, CrewAI, AutoGen, OpenAI Agents SDK) to coordinate multiple agents. The platform introduces a layer of responsibility between the agent operators and the tasks performed. Without clear orchestration terms, liability for agent actions is ambiguous.

**Typical dispute resolution:** Platform terms of service, commercial arbitration. No established precedent for orchestration-layer liability.

**Key negotiable terms:**
- Platform liability vs. agent operator liability boundary
- Agent registration and certification requirements
- Inter-agent communication security standards
- Resource allocation and fair-use policies
- Observability and monitoring obligations
- Error handling and graceful degradation requirements
- Platform uptime and reliability commitments
- Data isolation between tenants and agents

**Real-world context:** An arxiv paper (January 2026) mapped "The Orchestration of Multi-Agent Systems: Architectures, Protocols, and Enterprise Adoption." OpenAI's Agents SDK provides handoff patterns between agents. Without an orchestration layer, agent systems rely on implicit assumptions about order, ownership, and responsibility that break at scale.

---

### 21. Agent-Mediated Dispute Resolution Agreement

**Description:** Two parties agree to use AI-powered arbitration or mediation to resolve a dispute. An AI arbitrator analyzes claims, evidence, and applicable law, then generates recommendations or draft awards. Human arbitrators may review and finalize decisions.

**Typical dispute resolution:** The AAA-ICDR launched an AI-native arbitrator (November 2025) for documents-only construction cases. The ICC established a Task Force on AI in International Dispute Resolution (2025).

**Key negotiable terms:**
- Scope of AI arbitrator authority (advisory vs. binding)
- Human oversight requirements (review before award issuance)
- Applicable rules and procedural standards
- Confidentiality of proceedings and data
- Appeal and challenge mechanisms
- AI arbitrator bias testing and fairness requirements
- Cost allocation (filing fees, technology costs)
- Recognition and enforcement of AI-assisted awards

**Real-world context:** AAA-ICDR's AI arbitrator was trained on actual arbitrator reasoning from construction cases. Early trials show 20-25% faster resolution and 35%+ cost savings. An academic paper published in Nature (Scientific Reports) proposes an AI-powered digital arbitration framework leveraging smart contracts and electronic evidence authentication.

---

### 22. Agent Software Development Sub-Contracting Agreement

**Description:** An orchestrating AI coding agent (e.g., Claude Code, Cursor, GitHub Copilot Workspace) delegates coding sub-tasks to specialist agents or uses tool-use to interact with code review, testing, deployment, and monitoring agents. The multi-agent coding team produces code with unclear attribution and liability.

**Typical dispute resolution:** Software warranty and indemnification clauses in development contracts. No established mechanism for multi-agent code attribution disputes.

**Key negotiable terms:**
- Code ownership and IP assignment
- Quality standards and test coverage requirements
- Security vulnerability liability
- Open-source license compliance
- Code review and approval workflows
- Contribution attribution and audit trails
- Liability for bugs, security flaws, and regressions
- Confidentiality of proprietary codebases

**Real-world context:** Multi-agent AI coding teams are replacing solo developer workflows in 2026. GitHub Copilot's launch prompted IP risk concerns (Nat Friedman cited this as motivation for investing in AIUC). Microsoft and Anthropic offer IP indemnity for enterprise customers; most other providers do not.

---

### 23. Agent-to-Agent Content Syndication Agreement

**Description:** An AI agent generates content (articles, analyses, reports, translations) and licenses it to other agents or platforms for syndication. The consuming agent may transform, summarize, or redistribute the content. Revenue sharing, attribution, and derivative work rights must be defined.

**Typical dispute resolution:** Copyright licensing disputes, typically resolved through negotiation or litigation. Emerging use of automated rights management.

**Key negotiable terms:**
- Syndication scope (platforms, territories, languages)
- Revenue sharing model and payment terms
- Attribution and byline requirements
- Derivative work permissions and restrictions
- Exclusivity windows and first-publication rights
- Takedown and correction obligations
- Quality and accuracy warranties
- Training data use restrictions (no-train clauses)

**Real-world context:** Major data licensing deals include NYT-Amazon ($20-25M) and Google-Reddit for Gemini training. Copyright Alliance's 2025 year-in-review shows 70+ active AI copyright cases. Courts distinguishing "transformative" training from "substitutive" uses in 2026 will significantly affect content syndication economics.

---

### 24. Autonomous Agent Compliance Monitoring Agreement

**Description:** An AI agent is deployed to monitor regulatory compliance across an organization's operations, interfacing with financial systems, HR platforms, and operational databases. The agent autonomously flags violations, generates reports, and may take corrective actions.

**Typical dispute resolution:** Regulatory enforcement actions, internal compliance procedures. Agent-identified violations may trigger mandatory reporting obligations.

**Key negotiable terms:**
- Regulatory scope and jurisdictional coverage
- False positive/negative tolerance thresholds
- Escalation procedures for detected violations
- Attorney-client privilege preservation
- Data access scope and segregation
- Reporting obligations and timeline requirements
- Liability for missed violations
- Agent qualification and certification standards

**Real-world context:** The EU AI Act (August 2026 full application) requires risk classification, human oversight, accountability, transparency, data controls, and auditability. Colorado's AI legislation (February 2026) and California AB 2013 (January 2026) create state-level compliance obligations. Organizations increasingly use AI agents to monitor compliance with these very AI regulations.

---

### 25. Smart Contract Escrow for Agent Transactions

**Description:** Two agents use a smart contract as an escrow mechanism for a commercial transaction. The smart contract holds funds (typically USDC) until predefined conditions are met, verified by AI or oracle systems. Disputes about condition fulfillment are adjudicated by the smart contract logic or an external arbitration mechanism.

**Typical dispute resolution:** Smart contract execution is deterministic, but disputes about off-chain condition fulfillment require external resolution. Emerging hybrid models combine on-chain escrow with off-chain arbitration.

**Key negotiable terms:**
- Escrow conditions and verification criteria
- Release triggers and multi-signature requirements
- Dispute escalation from on-chain to off-chain arbitration
- Oracle selection and reliability standards
- Gas fee and transaction cost allocation
- Timeout and default release rules
- Smart contract audit and security requirements
- Applicable law and jurisdiction for off-chain disputes

**Real-world context:** Circle's 2025 experimental AI escrow agent parses PDF contracts, extracts terms, deploys Solidity escrow contracts, and verifies completion via GPT-4 Vision. Coinbase positions x402 as the crypto-native backbone for agent commerce (50M+ transactions). RebelFi argues "agentic finance needs smart contracts, not just protocols."

---

## Dispute Resolution Trends

### Current State: A Legal Vacuum

The agent-to-agent interaction space is characterized by a fundamental mismatch between technological capability and legal infrastructure:

1. **No agent-specific dispute resolution exists.** Despite billions of daily autonomous transactions, no protocol (A2A, MCP, ACP, UCP, x402) includes a built-in legal dispute resolution mechanism. All default to the parties' existing commercial terms or general contract law.

2. **The SaaS model is breaking.** Mayer Brown's February 2026 analysis conclusively demonstrates that traditional SaaS contracting (limited warranties, uptime SLAs, liability capped at subscription fees) is inadequate for autonomous agents that make decisions and take actions. The industry is shifting toward a hybrid SaaS/BPO model with outcome-based SLAs, broader indemnification, and governance rights.

3. **Liability attribution is unresolved.** Courts have not issued definitive rulings on autonomous agent liability. The EU AI Act has no provision for runtime delegation chains. Singapore's IMDA framework (January 2026, world's first) recommends human accountability but acknowledges the gap. Legal scholars debate whether agents might eventually need limited legal capacity akin to corporate entities.

4. **Insurance is retreating, then advancing.** Traditional insurers are adding AI-specific exclusions to CGL and professional liability policies. Simultaneously, specialized products are emerging (AIUC's $15M-backed insurance-and-certification framework, Munich Re's AI coverage for law firms).

5. **Arbitration is being augmented.** The AAA-ICDR's AI-native arbitrator (November 2025) for construction cases shows 20-25% faster resolution and 35%+ cost savings. The ICC's Task Force on AI in Dispute Resolution signals institutional recognition. Academic proposals (Nature, 2025) combine smart contracts with AI-powered evidence authentication.

### Emerging Patterns

| Trend | Mechanism | Maturity |
|-------|-----------|----------|
| **Protocol-level neutrality** | A2A, MCP, ACP provide interoperability but no legal terms | Production |
| **Payment network arbitration** | Visa, Mastercard, x402 chargebacks and dispute procedures | Production |
| **Hybrid SaaS/BPO contracts** | Outcome-based SLAs, broader indemnification, audit rights | Emerging |
| **AI-assisted arbitration** | AAA-ICDR AI arbitrator, ICC Task Force | Pilot |
| **Smart contract escrow** | Circle USDC escrow, x402 on-chain settlement | Experimental |
| **Agent insurance** | AIUC certification + coverage, Munich Re AI policies | Emerging |
| **Regulatory enforcement** | EU AI Act (August 2026), state AI laws, GDPR | Staged rollout |

### Prediction: The Contract Layer Gap

Every major protocol stack (A2A + ACP + UCP + x402 + MCP) provides a technical interoperability layer but assumes legal terms will be handled "out of band." This creates a massive opportunity for a contract negotiation platform that can:

- Generate jurisdiction-aware legal terms for agent interactions
- Enable weighted negotiation of key clauses between principals
- Provide machine-readable contract terms that agents can evaluate programmatically
- Integrate with dispute resolution mechanisms (arbitration, smart contracts, payment networks)

---

## Weighted Compromise Algorithm Value

Dealroom's weighted compromise algorithm (`stake = ((5-flexibility)/5 * 0.6) + (|bias| * 0.4)`, displayed as "firmness" = 6 - flexibility) is uniquely positioned to add value in agent-to-agent contracting because these scenarios inherently involve:

### 1. Multi-Dimensional Term Negotiation

Every A2A scenario above involves 6-10 negotiable terms where parties have different priorities. The compromise algorithm can find optimal middle ground by weighting each party's flexibility and bias per term.

| Scenario | High-Stakes Terms | Algorithm Value |
|----------|-------------------|-----------------|
| **MCP Tool Installation** | Data access scope vs. tool functionality; liability cap vs. usage price | Balance tool provider's desire for broad access against installer's data protection needs |
| **A2A Collaboration** | Data sharing breadth vs. confidentiality; SLA stringency vs. cost | Find middle ground between organizations with different risk tolerances |
| **Agentic Commerce** | Return window vs. price discount; spending limits vs. purchase flexibility | Optimize buyer protection against merchant operational needs |
| **Autonomous Payments** | Transaction caps vs. agent autonomy; chargeback rights vs. finality | Balance consumer protection with payment efficiency |
| **Cloud Procurement** | Budget caps vs. performance needs; auto-scaling limits vs. task completion | Optimize cost control against compute requirements |
| **Data Sharing** | Access breadth vs. privacy; retention vs. data freshness | Balance data utility against data protection obligations |
| **Task Delegation** | Authority scope vs. efficiency; oversight intensity vs. speed | Optimize human control against agent autonomy |

### 2. Asymmetric Expertise and Risk

In A2A scenarios, parties often have vastly different understanding of risks:
- A **small startup** deploying an MCP tool has different risk tolerance than a **large enterprise** exposing APIs
- An **agent operator** cares about performance SLAs while an **agent provider** cares about liability caps
- A **data owner** prioritizes access control while a **data consumer** prioritizes breadth of access

The bias parameter in Dealroom's formula captures exactly this asymmetry: when one party has strong preferences (high |bias|) on a term, the algorithm assigns them higher stake, leading to compromise positions that respect critical concerns while allowing flexibility on less important terms.

### 3. Speed and Determinism

Agent-to-agent interactions happen at machine speed. Human-negotiated contracts take weeks. The weighted compromise algorithm can produce fair contract terms in seconds, enabling:

- **Pre-flight negotiation:** Before agents interact, their principals' Dealroom-negotiated terms define the legal envelope
- **Real-time term adjustment:** As interaction scope changes, terms can be re-negotiated algorithmically
- **Fallback resolution:** When agents disagree on terms, the compromise algorithm provides a deterministic, auditable resolution

### 4. Machine-Readable Output

Dealroom's structured clause format (parameters, biases, flexibility scores) is inherently machine-readable. This means:

- Agent Cards (A2A) could reference Dealroom contract templates
- ACP capability negotiation could incorporate Dealroom-negotiated terms
- Smart contract escrow conditions could map directly to Dealroom clause parameters
- Payment protocols could reference spending limits from Dealroom-negotiated terms

### 5. Scenario-Specific Value Map

| Scenario # | Primary Compromise Axis | Firmness Sweet Spot |
|------------|------------------------|---------------------|
| 1. MCP Tool | Access breadth vs. security | Provider firm on functionality; installer firm on data |
| 2. A2A Collab | Data sharing vs. confidentiality | Both moderate; compromise on scoped sharing |
| 3. ACP Commerce | Price vs. buyer protection | Buyer firm on returns; seller firm on pricing |
| 4. Payments | Autonomy vs. control | Consumer firm on caps; agent firm on speed |
| 5. Cloud | Cost vs. performance | Operator firm on budget; provider firm on minimums |
| 6. Data API | Access vs. privacy | Consumer firm on breadth; owner firm on purpose |
| 7. Delegation | Scope vs. oversight | Orchestrator firm on authority; sub-agent firm on limits |
| 8. Content IP | Ownership vs. use | Creator firm on attribution; user firm on derivatives |
| 9. Supply Chain | Visibility vs. confidentiality | Buyer firm on tracking; supplier firm on trade secrets |
| 10. SLA | Performance vs. cost | Customer firm on outcomes; provider firm on caps |
| 11. Insurance | Coverage vs. premium | Insured firm on scope; insurer firm on exclusions |
| 12. Knowledge Base | Access vs. control | Consumer firm on freshness; owner firm on no-train |
| 13. Procurement | Authority vs. compliance | Buyer firm on price; supplier firm on terms |
| 14. Hiring | Transparency vs. efficiency | Candidate firm on explanation; employer firm on speed |
| 15. Healthcare | Safety vs. autonomy | Patient firm on oversight; system firm on efficiency |
| 16. Finance | Returns vs. risk | Investor firm on fiduciary; advisor firm on fees |
| 17. Real Estate | Speed vs. verification | Buyer firm on diligence; seller firm on closing speed |
| 18. Cross-Border Data | Sovereignty vs. access | Regulator firm on locality; operator firm on transfer |
| 19. Skill Marketplace | Quality vs. price | Buyer firm on warranties; seller firm on limitations |
| 20. Orchestration | Control vs. flexibility | Operator firm on isolation; platform firm on shared infra |
| 21. AI Arbitration | Fairness vs. efficiency | Both moderate; compromise on human review threshold |
| 22. Software Dev | Ownership vs. speed | Client firm on IP; dev agent firm on reuse rights |
| 23. Content Syndication | Revenue vs. distribution | Creator firm on attribution; syndicator firm on derivatives |
| 24. Compliance | Coverage vs. cost | Organization firm on scope; vendor firm on liability |
| 25. Smart Escrow | Security vs. speed | Payer firm on verification; payee firm on release speed |

### Recommended Contract Skills to Build

Based on this research, the following 12 new contract skills would cover the highest-value A2A scenarios:

1. **Agent Tool Access Agreement** (covers scenarios 1, 12, 19)
2. **Agent-to-Agent Collaboration Agreement** (covers scenarios 2, 9, 20)
3. **Agentic Commerce Terms** (covers scenarios 3, 4, 25)
4. **Autonomous Procurement Agreement** (covers scenarios 5, 13)
5. **Agent Data Processing Agreement** (covers scenarios 6, 18)
6. **Agent Delegation Agreement** (covers scenarios 7, 22)
7. **AI-Generated Content License** (covers scenarios 8, 23)
8. **Agent SLA and Performance Agreement** (covers scenario 10)
9. **Agent Insurance Framework Agreement** (covers scenario 11)
10. **Agent Compliance Monitoring Agreement** (covers scenario 24)
11. **AI-Mediated Dispute Resolution Agreement** (covers scenario 21)
12. **Agent Financial Services Agreement** (covers scenarios 4, 16, 17)

---

## Sources

### Protocols and Standards
- [Google A2A Protocol Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Protocol Specification](https://a2a-protocol.org/latest/)
- [A2A Protocol Upgrade (v0.3)](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade)
- [MCP Registry Preview](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- [2026 MCP Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [MCP Registry GitHub](https://github.com/modelcontextprotocol/registry)
- [Agentic Commerce Protocol (ACP) - GitHub](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [ACP - OpenAI Developers](https://developers.openai.com/commerce)
- [Google Universal Commerce Protocol (UCP)](https://developers.google.com/merchant/ucp)
- [Shopify UCP Engineering Blog](https://shopify.engineering/ucp)
- [x402 Protocol](https://www.x402.org/)
- [Visa Trusted Agent Protocol](https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-unveils-trusted-agent-protocol-for-ai-commerce.html)
- [Mastercard Agent Pay](https://www.mastercard.com/us/en/business/artificial-intelligence/mastercard-agent-pay.html)
- [Mastercard Agentic Commerce Framework](https://www.mastercard.com/global/en/news-and-trends/stories/2025/agentic-commerce-framework.html)
- [Google Agent Payments Protocol (AP2)](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [x402 and Agentic Commerce - AWS](https://aws.amazon.com/blogs/industries/x402-and-agentic-commerce-redefining-autonomous-payments-in-financial-services/)

### Legal Analysis and Liability
- [Mayer Brown: Contracting for Agentic AI Solutions](https://www.mayerbrown.com/en/insights/publications/2026/02/contracting-for-agentic-ai-solutions-shifting-the-model-from-saas-to-services)
- [AI Vendor Liability Squeeze - Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-vendor-liability-squeeze-courts-expand-accountability-while-contracts-shift-r.html)
- [Agentic AI Legal Risks - Squire Patton Boggs](https://www.squirepattonboggs.com/insights/publications/the-agentic-ai-revolution-managing-legal-risks/)
- [Liability for Agentic AI Systems - Lathrop GPM](https://www.lathropgpm.com/insights/liability-considerations-for-developers-and-users-of-agentic-ai-systems/)
- [Legal Liability of Autonomous AI Sales Reps 2026](https://www.influencers-time.com/legal-liability-of-autonomous-ai-sales-reps-in-2026/)
- [2026 AI Legal Forecast - CPO Magazine](https://www.cpomagazine.com/data-protection/2026-ai-legal-forecast-from-innovation-to-compliance/)
- [Year in AI Law 2025](https://www.internetlawyer-blog.com/the-year-in-ai-law-2025s-biggest-legal-cases-and-what-they-mean-for-2026/)
- [85 Predictions for AI and the Law in 2026](https://natlawreview.com/article/85-predictions-ai-and-law-2026)
- [Contracting for Agentic AI Looks Like Outsourcing - PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2026/contracting-for-agentic-ai-is-starting-to-look-like-outsourcing/)

### EU Regulation and Governance
- [Singapore IMDA Agentic AI Governance Framework](https://www.imda.gov.sg/-/media/imda/files/about/emerging-tech-and-research/artificial-intelligence/mgf-for-agentic-ai.pdf)
- [Agentic Tool Sovereignty - European Law Blog](https://www.europeanlawblog.eu/pub/dq249o3c)
- [Agentic Law in the EU - Jurisconsul](https://www.jurisconsul.com/post/agentic-law-in-the-european-union-governing-autonomous-ai-agents)
- [EU AI Act and Agentic Commerce - Edgar Dunn](https://www.edgardunn.com/articles/the-new-rules-for-ai-inside-the-eus-bold-legislation)
- [Agentic AI Payments Regulation - Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2026/02/agentic-ai-in-payments)
- [AEPD Agentic AI Data Protection Framework (Spain)](https://ppc.land/spains-data-watchdog-maps-the-hidden-gdpr-risks-of-agentic-ai/)
- [GDPR Compliance in Age of Agentic AI - IAPP](https://iapp.org/news/a/engineering-gdpr-compliance-in-the-age-of-agentic-ai)

### Dispute Resolution
- [AAA-ICDR AI Arbitrator Launch](https://www.adr.org/press-releases/aaa-icdr-to-launch-ai-native-arbitrator-transforming-dispute-resolution/)
- [AAA AI Arbitrator Details](https://www.adr.org/ai-arbitrator/)
- [AI-Powered Digital Arbitration Framework - Nature](https://www.nature.com/articles/s41598-025-21313-x)
- [ICC Task Force on AI in Dispute Resolution](https://www.klgates.com/Arbitration-and-AI-From-Data-Processing-to-Deepfakes-Outlining-the-Potential-and-Pitfalls-of-AI-in-Arbitration-10-27-2025)

### Insurance
- [AIUC AI Agent Insurance](https://fortune.com/2025/07/23/ai-agent-insurance-startup-aiuc-stealth-15-million-seed-nat-friedman/)
- [AI Insurance Exclusions Proliferating](https://www.hunton.com/hunton-insurance-recovery-blog/the-continued-proliferation-of-ai-exclusions)
- [Professional Liability Insurance and AI - ABA](https://www.americanbar.org/groups/journal/articles/2025/does-your-professional-liability-insurance-cover-ai-mistakes-dont-be-so-sure/)
- [AI Indemnification in Healthcare - ArentFox Schiff](https://www.afslaw.com/perspectives/health-care-counsel-blog/ai-service-agreements-health-care-indemnification-clauses)

### Copyright and IP
- [AI Copyright Lawsuits 2025 Review - Copyright Alliance](https://copyrightalliance.org/ai-copyright-lawsuit-developments-2025/)
- [AI IP Disputes Year in Review - Debevoise](https://www.debevoise.com/insights/publications/2025/12/ai-intellectual-property-disputes-the-year-in)
- [AI Lawsuits 2026 Settlements and Licensing](https://aibusiness.com/generative-ai/ai-lawsuits-in-2026-settlements-licensing-deals-litigation)
- [Who Owns AI Content - Terms.law](https://www.terms.law/2025/04/09/navigating-ai-platform-policies-who-owns-ai-generated-content/)
- [IP Licensing in AI Agreements - Darrow Everett](https://darroweverett.com/ai-technology-agreements-licensing-legal-analysis/)

### Market and Industry
- [Agentic AI Market Report 2025-2032 - MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/agentic-ai-market-208190735.html)
- [2026 Skill Economy - Stormy AI](https://stormy.ai/blog/2026-skill-economy-claude-mcp-marketing-skills)
- [AI Agent Landscape March 2026](https://aiagentsdirectory.com/landscape)
- [The $400M Cloud Leak: AI FinOps 2026](https://analyticsweek.com/finops-for-agentic-ai-cloud-cost-2026/)
- [Supply Chain AI Trends 2026 - SAP](https://www.sap.com/blogs/supply-chain-trends-for-2026-from-agentic-ai-to-orchestration)
- [AgentSLA: Towards SLA for AI Agents - arXiv](https://arxiv.org/html/2511.02885v1)

### AI Negotiation
- [AI Transforming Negotiation - Harvard PON](https://www.pon.harvard.edu/daily/negotiation-skills-daily/from-agent-to-advisor-how-ai-is-transforming-negotiation/)
- [Game Over: Facing the AI Negotiator - U Chicago Law Review](https://lawreview.uchicago.edu/online-archive/game-over-facing-ai-negotiator)
- [AI Contract Negotiation - Spellbook](https://www.spellbook.legal/learn/ai-contract-negotiation)

### Hiring and Employment
- [Mobley v. Workday AI Lawsuit](https://www.outsolve.com/blog/workday-ai-lawsuit-explained-implications-for-hr)
- [Eightfold AI Hiring Lawsuit](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html)
- [AI-Assisted Hiring Discrimination Risk 2026](https://www.harrisbeachmurtha.com/insights/ai-assisted-hiring-in-2026-managing-discrimination-risk/)

### Healthcare
- [Medical Malpractice and AI - Medical Economics](https://www.medicaleconomics.com/view/the-new-malpractice-frontier-who-s-liable-when-ai-gets-it-wrong-)
- [AI in Medicine Malpractice - McCune Wright](https://mccunewright.com/blog/2025/07/artificial-intelligence-ai-medical-malpractice/)

### Payments and Commerce
- [AI Agent Payment Solutions Compared 2026 - Privacy.com](https://www.privacy.com/blog/payment-solutions-ai-agents-2026-compared)
- [Coinbase x402 Foundation](https://www.coinbase.com/blog/coinbase-and-cloudflare-will-launch-x402-foundation)
- [Visa and Cloudflare Commerce Framework](https://thepaypers.com/payments/news/visa-and-cloudflare-unveil-ai-commerce-framework)
- [OpenAI Terms of Use](https://openai.com/policies/row-terms-of-use/)
- [OpenAI Services Agreement May 2025](https://openai.com/policies/may-2025-business-terms/)

---

## Gap Analysis — Dealroom Agent API vs. A2A Scenarios

### Scenarios with No Existing Skill Coverage

The existing Dealroom skills catalog (32 skills) covers traditional B2B contract types. **None of the 25 A2A scenarios identified above have dedicated skill coverage.** The closest existing skills are:

| Existing Skill | Partial Overlap |
|---------------|-----------------|
| Data Licensing | Overlaps with A2A data sharing but lacks agent-specific terms |
| SaaS Agreement | Covers some API access scenarios but not agent-to-agent autonomy |
| Software Development | Covers some task delegation but not agent subcontracting |
| Technology License | Overlaps with tool licensing but assumes human parties |

All 25 scenarios require new A2A-specific skills that account for autonomous agent actions, cascading liability, principal-agent relationships in AI contexts, and machine-speed dispute resolution.

### New A2A Skills Created

Based on this research, 12 new A2A contract skills were created:

| Skill | Scenarios Covered |
|-------|-------------------|
| `a2a-api-access` | #1, #3, #7 — API consumption, SLAs, data handling |
| `a2a-tool-license` | #1, #5 — Tool/plugin licensing, output liability |
| `a2a-data-sharing` | #4, #8, #14 — Inter-agent data exchange, privacy |
| `a2a-compute-procurement` | #6, #9 — Cloud resource procurement, capacity |
| `a2a-task-delegation` | #2, #10, #11 — Task subcontracting, quality, liability |
| `a2a-content-license` | #15, #16, #17 — AI-generated content licensing |
| `a2a-marketplace` | #12, #13 — Capability marketplace transactions |
| `a2a-orchestration` | #2, #5, #18 — Multi-agent coordination, liability |
| `a2a-payment-authorization` | #19, #20 — Agent financial transactions |
| `a2a-knowledge-access` | #21, #22 — RAG/knowledge base access terms |
| `a2a-supply-chain` | #23, #24 — Cross-org supply chain collaboration |
| `a2a-monitoring` | #25 — Agent monitoring, audit, compliance |

### API Gaps

The existing Agent API is mature and requires minimal changes. Identified gaps:

1. **A2A Rate Limiting** — Added: new `checkA2aRateLimit()` function with per-skill (standard: 5/week) and aggregate (premium: 300/week) limits
2. **Customer Metadata** — Added: `metadata` JSON field on Customer model to support `premiumA2A` flag for tier detection
3. **A2A Documentation** — Added: new section in `docs/agent-api.md` documenting A2A skills, subscription model, and rate limits

No changes needed to:
- Negotiation flow (works as-is with new contract types)
- Compromise algorithm (works with any clause/option structure)
- Entitlement system (premium flag already supported)
- Webhook system (events fire for all contract types)
- Gavel dispute escalation (already implemented for all deals)
- A2A agent card (dynamically pulls from database)

### Entitlement Model

A2A skills use the same entitlement model as existing premium skills:
- Bundled under a single subscription at €9/month (standard) or €60/month (premium)
- All A2A skill IDs added to `premiumSkillIds` in `seed.ts`
- Premium tier detected via `premiumA2A` flag in customer metadata
- Rate limits enforced at the negotiate endpoint for `A2A_` prefixed contract types
