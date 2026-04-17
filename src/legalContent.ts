export type LegalPage = {
  slug: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
};

export const legalPages: LegalPage[] = [
  {
    slug: "terms",
    eyebrow: "Terms",
    title: "Terms of Service",
    intro: "These starter terms are written for the HomePilot beta product. They are operational placeholders and should be reviewed by counsel before public paid launch.",
    sections: [
      { heading: "Service role", body: ["HomePilot provides guided software, workflow organization, educational information, and access paths to third-party professionals. HomePilot is not a law firm, title company, escrow company, mortgage lender, appraiser, or real estate brokerage unless a separate written agreement states otherwise."] },
      { heading: "No legal or brokerage advice", body: ["Information in the product is general and educational. Users are responsible for choosing whether to consult a licensed attorney, broker, title company, escrow provider, tax advisor, or other professional."] },
      { heading: "User responsibility", body: ["Users are responsible for the accuracy of property facts, listing content, disclosure answers, buyer communications, offer terms, uploaded documents, and final transaction decisions."] },
      { heading: "Payments and refunds", body: ["Paid packages, add-ons, refunds, and cancellation rights should be displayed at checkout. Stripe or another payment processor may process payment information subject to its own terms."] },
      { heading: "Beta limitation", body: ["The current product is a pilot and may change. Do not upload sensitive real transaction documents until production storage, security, and legal review are complete."] },
    ],
  },
  {
    slug: "privacy",
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro: "HomePilot collects seller and property information to generate a guided sale plan and operate the seller workspace. This draft should be finalized with counsel before launch.",
    sections: [
      { heading: "Information collected", body: ["The product may collect account information, property details, checklist answers, listing drafts, offers, showing requests, uploaded documents, payment status, lead form details, and technical usage information."] },
      { heading: "How information is used", body: ["Information is used to provide the dashboard, generate listing and pricing workflows, support offer comparison, coordinate requested services, improve the product, and communicate with users."] },
      { heading: "Third-party services", body: ["HomePilot may use services such as Vercel, Stripe, Supabase, email providers, analytics tools, attorneys, title companies, escrow providers, photographers, and MLS/broker partners. Each provider may process information under its own terms."] },
      { heading: "Sensitive documents", body: ["Real estate documents can contain sensitive personal and financial information. Production document storage should use durable encrypted storage with access controls before real customer documents are accepted."] },
      { heading: "User choices", body: ["Users should be able to request access, correction, or deletion of account information, subject to legal, security, and transaction-record obligations."] },
    ],
  },
  {
    slug: "legal-disclaimer",
    eyebrow: "Legal disclaimer",
    title: "Educational Information, Not Legal Advice",
    intro: "HomePilot is designed to reduce confusion, not to replace licensed professionals where professional judgment is required.",
    sections: [
      { heading: "No attorney-client relationship", body: ["Using HomePilot does not create an attorney-client relationship. Legal questions should be directed to a licensed attorney in the relevant state."] },
      { heading: "State-specific complexity", body: ["Real estate disclosure, contract, escrow, title, tax, and closing rules vary by state and locality. The platform can flag common workflow steps but cannot determine every legal obligation for every property."] },
      { heading: "Escalation moments", body: ["Users should seek professional help for contract interpretation, disclosure uncertainty, title defects, seller financing, probate, divorce, tenant-occupied property, flood history, short sale issues, unusual contingencies, or any high-risk transaction question."] },
      { heading: "AI boundaries", body: ["AI-generated listing, explanation, comparison, or document-support content should be reviewed by the user and, where appropriate, a licensed professional before use."] },
    ],
  },
  {
    slug: "fair-housing",
    eyebrow: "Fair housing",
    title: "Fair Housing Commitment",
    intro: "HomePilot should help sellers communicate professionally and avoid discriminatory housing practices.",
    sections: [
      { heading: "Equal access", body: ["Sellers should treat buyers consistently and avoid screening, wording, or showing practices based on protected characteristics under federal, state, or local fair housing laws."] },
      { heading: "Listing language", body: ["Listing descriptions and buyer messages should focus on property features, location facts, process requirements, and objective qualification steps rather than describing preferred buyer types or neighborhood demographics."] },
      { heading: "Buyer qualification", body: ["Requests for pre-approval, proof of funds, identification, or showing confirmation should be applied consistently through neutral written criteria."] },
      { heading: "Escalation", body: ["If a seller is unsure whether a communication, policy, or showing decision could raise fair housing concerns, they should consult a qualified professional before proceeding."] },
    ],
  },
  {
    slug: "partner-disclosure",
    eyebrow: "Partners",
    title: "Partner and Referral Disclosure",
    intro: "HomePilot may introduce sellers to third-party service providers. The product should be transparent about relationships, compensation, and user choice.",
    sections: [
      { heading: "Independent providers", body: ["Attorneys, title companies, escrow providers, photographers, inspectors, lenders, broker partners, and transaction coordinators are independent third parties unless explicitly stated otherwise."] },
      { heading: "User choice", body: ["Users should be free to choose their own providers. HomePilot recommendations or introductions should not be presented as mandatory."] },
      { heading: "Compensation", body: ["Any referral, affiliate, marketing, or affiliated-business relationship should be clearly disclosed and structured to comply with applicable law, including RESPA where settlement services are involved."] },
      { heading: "No guarantee", body: ["HomePilot does not guarantee third-party provider availability, quality, licensing status, pricing, or transaction outcomes. Provider diligence remains important."] },
    ],
  },
];

export function getLegalPage(slug: string) {
  return legalPages.find((page) => page.slug === slug);
}
