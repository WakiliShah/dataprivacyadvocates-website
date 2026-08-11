# Service UX Refactor — Final

## Design rule
Transactional legal service pages are now decision interfaces rather than long-form stories:

**SELECT → NEXT → SELECT → NEXT → RECOMMENDATION → CONSULTATION**

The Knowledge Centre, Insights and Case Digests remain the places for long-form reading.

## Refactored service pages
### Regulatory & Compliance
- Regulatory Review
- Policy & Procedure Drafting
- GDPR & Cross-Border Compliance

### Litigation & Dispute Resolution
- ODPC Response & Appeals
- Enforcement Defence
- High Court & Appellate Counsel
- Regulatory Dispute Support

### Technology & Cyber Law
- Cybersecurity Law
- Technology Contracts
- Vendor & Processor Agreements
- Cloud & Data Transfers
- IT Compliance Counsel

### Corporate & Commercial
- Fintech & Startup Advisory
- Commercial Agreements
- Regulatory Counselling
- Privacy Clauses for Transactions
- Corporate Data Governance

ODPC Registration and Retainer remain purpose-built selection/pricing interfaces rather than being converted into narrative pages.

## Interaction behaviour
- One decision screen is visible at a time.
- Next is disabled until the visitor selects an option.
- Back allows the visitor to revise a prior choice.
- The final screen gives a compact service recommendation and routes to the common local consultation page (`contact.html`) or WhatsApp.
- Existing page titles, URLs and head metadata are retained.
- `Solutions` is marked active in the navigation on these service pages.
- No service page requires the visitor to scroll through a long narrative before reaching the decision/CTA.
