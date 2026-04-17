export type StateChecklistTemplate = {
  id: string;
  category: "Prepare" | "List" | "Disclose" | "Offer" | "Close" | "Expert";
  title: string;
  detail: string;
  timing: string;
  riskLevel: "Standard" | "Important" | "Expert";
  source?: string;
};

export type StateSource = {
  label: string;
  url: string;
};

export type StatePlaybook = {
  slug: string;
  name: string;
  abbreviation: string;
  launchRank: number;
  status: "Live pilot" | "Expansion-ready" | "Attorney QA needed";
  complexity: "Low" | "Medium" | "High";
  marketAngle: string;
  whyEfficient: string;
  heroTitle: string;
  heroBody: string;
  closingModel: string;
  pricingCaveat: string;
  focusAreas: string[];
  partnerNeeds: string[];
  checklistItems: StateChecklistTemplate[];
  sources: StateSource[];
};

const federalSources = {
  lead: "https://www.epa.gov/lead/real-estate-disclosures-about-potential-lead-hazards",
};

export const statePlaybooks: StatePlaybook[] = [
  {
    slug: "florida",
    name: "Florida",
    abbreviation: "FL",
    launchRank: 1,
    status: "Live pilot",
    complexity: "Medium",
    marketAngle: "Large Sun Belt market with high seller savings potential and flood-disclosure sensitivity.",
    whyEfficient: "HomePilot already has Florida logic, so it remains the reference implementation for legal-safe workflow design.",
    heroTitle: "A Florida FSBO checklist that flags high-risk disclosure moments.",
    heroBody: "The Florida playbook focuses on known material facts, flood disclosure, lead paint triggers, HOA or condo documents, and expert escalation. It is legal information, not legal advice.",
    closingModel: "Title-company closing is common, with attorney review recommended for unusual contracts, title defects, probate, flood-history uncertainty, or seller financing.",
    pricingCaveat: "Florida has large metro-by-metro inventory variation, so pricing guidance should ask for neighborhood comps and active competition before recommending a launch price.",
    focusAreas: ["Known material facts", "Flood disclosure", "HOA or condo documents", "Lead-based paint", "Title-company handoff"],
    partnerNeeds: ["Florida real estate attorney", "Title company", "Flat-fee MLS broker", "Photographer"],
    checklistItems: [
      {
        id: "fl-known-material-facts",
        category: "Disclose",
        title: "Florida known material facts disclosure check",
        detail: "Organize known facts that materially affect residential property value and are not readily observable or known to the buyer. Escalate uncertainty to a Florida real estate attorney.",
        timing: "Before contract execution",
        riskLevel: "Expert",
        source: "https://www.floridarealtors.org/law-ethics/library/florida-real-estate-disclosure-laws",
      },
      {
        id: "fl-flood-disclosure",
        category: "Disclose",
        title: "Florida flood disclosure packet",
        detail: "Prepare the residential flood disclosure workflow and confirm delivery timing before the sales contract is executed.",
        timing: "At or before contract execution",
        riskLevel: "Important",
        source: "https://www.flsenate.gov/Laws/Statutes/2025/Chapter689/All",
      },
    ],
    sources: [
      { label: "Florida Realtors disclosure overview", url: "https://www.floridarealtors.org/law-ethics/library/florida-real-estate-disclosure-laws" },
      { label: "Florida Statutes Chapter 689", url: "https://www.flsenate.gov/Laws/Statutes/2025/Chapter689/All" },
    ],
  },
  {
    slug: "texas",
    name: "Texas",
    abbreviation: "TX",
    launchRank: 2,
    status: "Expansion-ready",
    complexity: "Medium",
    marketAngle: "Huge transaction pool, strong commission-savings message, and major metros with motivated DIY sellers.",
    whyEfficient: "Texas combines scale with a title/escrow partner workflow HomePilot can route rather than owning directly.",
    heroTitle: "Texas gives HomePilot the biggest next-market expansion after Florida.",
    heroBody: "The Texas playbook turns seller disclosure, non-disclosure pricing limitations, title-company coordination, and offer-risk comparison into a guided workflow.",
    closingModel: "Texas closings commonly run through title companies and licensed escrow officers; attorney review should be offered for contract interpretation or non-standard terms.",
    pricingCaveat: "Texas sale prices are not always publicly disclosed, so the pricing coach should clearly label low-confidence estimates and request seller comps, county data, or partner review.",
    focusAreas: ["Seller's Disclosure Notice", "Title-company escrow", "Non-disclosure pricing confidence", "Survey/T-47 style handoff", "Metro-specific partner routing"],
    partnerNeeds: ["Texas title company", "Flat-fee MLS broker", "Texas real estate attorney", "Pricing review partner"],
    checklistItems: [
      {
        id: "tx-seller-disclosure-notice",
        category: "Disclose",
        title: "Texas Seller's Disclosure Notice workflow",
        detail: "Prepare a written seller disclosure notice for eligible one-dwelling residential property and flag exemptions for attorney or title partner review.",
        timing: "Before buyer is bound when possible",
        riskLevel: "Important",
        source: "https://texas.public.law/statutes/tex._prop._code_section_5.008",
      },
      {
        id: "tx-pricing-data-confidence",
        category: "Prepare",
        title: "Texas pricing data confidence check",
        detail: "Because Texas is a non-disclosure market in many contexts, require comp uploads, seller-provided sale intel, or a partner pricing review before presenting a high-confidence recommendation.",
        timing: "Before pricing",
        riskLevel: "Important",
      },
      {
        id: "tx-title-escrow-partner",
        category: "Close",
        title: "Route accepted contract to Texas title/escrow partner",
        detail: "Collect seller identity, payoff details, survey availability, HOA contacts, and contract documents for the title company or licensed escrow officer.",
        timing: "Immediately after accepted contract",
        riskLevel: "Expert",
        source: "https://www.tdi.texas.gov/title/titlem6a.html",
      },
    ],
    sources: [
      { label: "Texas Property Code Section 5.008", url: "https://texas.public.law/statutes/tex._prop._code_section_5.008" },
      { label: "Texas Department of Insurance title/escrow rules", url: "https://www.tdi.texas.gov/title/titlem6a.html" },
    ],
  },
  {
    slug: "arizona",
    name: "Arizona",
    abbreviation: "AZ",
    launchRank: 3,
    status: "Expansion-ready",
    complexity: "Low",
    marketAngle: "Phoenix/Tucson concentration, relocation demand, and an escrow-centered transaction culture make Arizona efficient.",
    whyEfficient: "Arizona can be implemented with a focused SPDS-style workflow, escrow handoff, and investor/wholesaler warnings.",
    heroTitle: "Arizona is a clean Sun Belt expansion state for guided FSBO sellers.",
    heroBody: "The Arizona playbook focuses on SPDS-style disclosures, escrow instructions, wholesale-buyer alerts, HOA documents, and desert-specific property condition prompts.",
    closingModel: "Escrow and title providers are central to the closing path; attorney review is best positioned as an escalation for disclosure uncertainty, contract questions, or investor assignments.",
    pricingCaveat: "Phoenix-area markets can move differently by subdivision, new-build competition, and investor activity, so pricing should show confidence bands and local comp gaps.",
    focusAreas: ["SPDS-style disclosure", "Wholesaler disclosure warning", "Escrow handoff", "HOA documents", "Septic or pool condition"],
    partnerNeeds: ["Arizona escrow/title company", "Flat-fee MLS broker", "Arizona real estate attorney", "Photographer"],
    checklistItems: [
      {
        id: "az-spds-style-disclosure",
        category: "Disclose",
        title: "Arizona SPDS-style seller disclosure workflow",
        detail: "Guide the seller through known material facts using SPDS-style prompts and make clear that software cannot complete disclosures for the seller.",
        timing: "Before or shortly after offer acceptance",
        riskLevel: "Important",
        source: "https://azre.gov/sites/default/files/PublicInfo/Documents/Residential_SPDS.pdf",
      },
      {
        id: "az-wholesaler-alert",
        category: "Offer",
        title: "Investor and wholesaler buyer screen",
        detail: "Ask whether the buyer intends to assign the contract and flag Arizona wholesale disclosure requirements before the seller accepts investor terms.",
        timing: "During offer review",
        riskLevel: "Expert",
        source: "https://law.justia.com/codes/arizona/title-44/section-44-5101/",
      },
      {
        id: "az-escrow-instructions",
        category: "Close",
        title: "Open Arizona escrow instructions package",
        detail: "Collect the purchase contract, seller identity details, payoff information, HOA contacts, and disclosure packet for escrow/title coordination.",
        timing: "After accepted contract",
        riskLevel: "Important",
      },
    ],
    sources: [
      { label: "Arizona Department of Real Estate SPDS reference", url: "https://azre.gov/sites/default/files/PublicInfo/Documents/Residential_SPDS.pdf" },
      { label: "Arizona wholesale buyer/seller disclosure statute", url: "https://law.justia.com/codes/arizona/title-44/section-44-5101/" },
    ],
  },
  {
    slug: "nevada",
    name: "Nevada",
    abbreviation: "NV",
    launchRank: 4,
    status: "Expansion-ready",
    complexity: "Low",
    marketAngle: "Las Vegas and Reno create a concentrated launch surface with clear state disclosure assets.",
    whyEfficient: "One state playbook can cover a large share of demand with official forms, clear HOA reminders, and title/escrow partner routing.",
    heroTitle: "Nevada is built for a focused Las Vegas-first FSBO workflow.",
    heroBody: "The Nevada playbook centers on the Seller's Real Property Disclosure Form, HOA resale package reminders, open-range/manufactured-home flags, and escrow coordination.",
    closingModel: "Title and escrow partners handle the closing mechanics; attorney review should be an escalation for complex disclosures, investor terms, or title issues.",
    pricingCaveat: "Las Vegas can swing quickly with investor demand and new listings, so pricing should stress active competition and days-on-market monitoring.",
    focusAreas: ["Seller's Real Property Disclosure", "HOA resale package", "Open Range/manufactured-home flags", "Escrow handoff", "Investor offer review"],
    partnerNeeds: ["Nevada title/escrow company", "Flat-fee MLS broker", "Nevada real estate attorney", "HOA document vendor"],
    checklistItems: [
      {
        id: "nv-seller-real-property-disclosure",
        category: "Disclose",
        title: "Nevada Seller's Real Property Disclosure Form",
        detail: "Prepare the seller to complete Nevada's state disclosure form and preserve a record of buyer delivery and acknowledgement.",
        timing: "Before conveyance and early in contract workflow",
        riskLevel: "Important",
        source: "https://red.nv.gov/Content/Forms/Disclosures/",
      },
      {
        id: "nv-special-disclosure-screen",
        category: "Disclose",
        title: "Nevada special disclosure screen",
        detail: "Check for open range, manufactured home, HOA, private transfer fee, water, or other property-specific disclosure triggers before accepting an offer.",
        timing: "Before offer acceptance",
        riskLevel: "Important",
        source: "https://red.nv.gov/Content/Forms/Disclosures/",
      },
      {
        id: "nv-hoa-resale-package",
        category: "Close",
        title: "Request HOA resale package early",
        detail: "For HOA properties, collect association contacts, fees, governing documents, resale package requirements, transfer fees, and special assessment details.",
        timing: "Before listing or immediately after contract",
        riskLevel: "Important",
      },
    ],
    sources: [
      { label: "Nevada Real Estate Division disclosure forms", url: "https://red.nv.gov/Content/Forms/Disclosures/" },
      { label: "Nevada Residential Disclosure Guide", url: "https://red.nv.gov/Content/Compliance/Nevada_Residential_Disclosure_Guide/" },
    ],
  },
  {
    slug: "tennessee",
    name: "Tennessee",
    abbreviation: "TN",
    launchRank: 5,
    status: "Expansion-ready",
    complexity: "Low",
    marketAngle: "Nashville, Knoxville, Chattanooga, and Memphis give HomePilot strong relocation and affordability SEO clusters.",
    whyEfficient: "Tennessee's disclosure/disclaimer decision path can become a clean guided wizard with clear expert escalation.",
    heroTitle: "Tennessee is a strong content-led expansion state for cost-conscious sellers.",
    heroBody: "The Tennessee playbook helps sellers choose the right disclosure/disclaimer path, organize known defects, route title/closing tasks, and compare investor-heavy offers.",
    closingModel: "Title and closing practices vary by local market, so the product should route accepted contracts to a closing partner and recommend attorney review for unusual issues.",
    pricingCaveat: "Tennessee markets vary sharply between Nashville, Knoxville, Chattanooga, and Memphis, so pricing should be metro-specific and investor-aware.",
    focusAreas: ["Disclosure vs disclaimer decision", "Known defect organization", "Investor offer review", "Title/closing routing", "Septic and flood prompts"],
    partnerNeeds: ["Tennessee title/closing partner", "Flat-fee MLS broker", "Tennessee real estate attorney", "Inspector"],
    checklistItems: [
      {
        id: "tn-disclosure-or-disclaimer",
        category: "Disclose",
        title: "Tennessee disclosure or disclaimer decision",
        detail: "Guide the seller through whether to provide a residential property condition disclosure, a disclaimer, or an exemption path, then route uncertainty to an attorney partner.",
        timing: "Before buyer contract commitment",
        riskLevel: "Expert",
        source: "https://www.tn.gov/health/healthyhomes.html",
      },
      {
        id: "tn-known-defects-organizer",
        category: "Disclose",
        title: "Organize known defects and system history",
        detail: "Collect known issues involving structure, roof, plumbing, electrical, HVAC, environmental hazards, flooding, drainage, encroachments, and unpermitted work.",
        timing: "Before listing or offer review",
        riskLevel: "Important",
        source: "https://www.tn.gov/health/healthyhomes.html",
      },
      {
        id: "tn-investor-offer-check",
        category: "Offer",
        title: "Investor-heavy offer comparison check",
        detail: "Flag assignment language, low earnest money, long inspection windows, seller concessions, and wholesaler-style terms for closer review.",
        timing: "During offer review",
        riskLevel: "Important",
      },
    ],
    sources: [
      { label: "Tennessee disclosure law overview", url: "https://www.tn.gov/health/healthyhomes.html" },
      { label: "Tennessee Code Section 66-5-202", url: "https://law.justia.com/codes/tennessee/2019/title-66/chapter-5/part-2/section-66-5-202/" },
    ],
  },
  {
    slug: "colorado",
    name: "Colorado",
    abbreviation: "CO",
    launchRank: 6,
    status: "Attorney QA needed",
    complexity: "High",
    marketAngle: "High home values create a powerful savings pitch, but property-condition and contract nuance require more review.",
    whyEfficient: "Colorado is commercially attractive after lower-complexity states because official forms and high-value metros support a premium guided-sale package.",
    heroTitle: "Colorado is a high-value expansion state that needs stronger legal QA.",
    heroBody: "The Colorado playbook covers Seller's Property Disclosure workflows, HOA/common-interest prompts, wildfire/water/mineral-rights escalation, and contract partner review.",
    closingModel: "Colorado workflows should include title-company coordination plus attorney or licensed partner review when forms, water rights, mineral rights, wildfire risk, or unusual contingencies are involved.",
    pricingCaveat: "Denver, Boulder, mountain, and resort markets behave differently, so pricing should require hyperlocal comps and local expert review for unusual properties.",
    focusAreas: ["Seller's Property Disclosure", "Common-interest community docs", "Water/mineral rights", "Wildfire/mountain property risk", "Contract/form review"],
    partnerNeeds: ["Colorado real estate attorney", "Title company", "Flat-fee MLS broker", "Local pricing reviewer"],
    checklistItems: [
      {
        id: "co-seller-property-disclosure",
        category: "Disclose",
        title: "Colorado Seller's Property Disclosure workflow",
        detail: "Prepare the seller to complete Colorado's residential Seller's Property Disclosure to current actual knowledge and store supporting documents.",
        timing: "Before or during offer workflow",
        riskLevel: "Important",
        source: "https://dre.colorado.gov/division-notifications/2023-sellers-property-disclosure-forms-spd-have-been-updated",
      },
      {
        id: "co-special-property-risk-screen",
        category: "Expert",
        title: "Colorado special property risk screen",
        detail: "Escalate water rights, mineral rights, wildfire mitigation, mountain access, well/septic, short-term rental, and common-interest community questions before contract signing.",
        timing: "Before accepting an offer",
        riskLevel: "Expert",
      },
      {
        id: "co-contract-form-review",
        category: "Expert",
        title: "Colorado contract and form partner review",
        detail: "Use attorney or licensed partner review for contract templates, addenda, and disclosures rather than presenting software-generated legal documents as final advice.",
        timing: "Before contract execution",
        riskLevel: "Expert",
        source: "https://dre.colorado.gov/real-estate-broker-contracts-and-forms",
      },
    ],
    sources: [
      { label: "Colorado Seller's Property Disclosure update", url: "https://dre.colorado.gov/division-notifications/2023-sellers-property-disclosure-forms-spd-have-been-updated" },
      { label: "Colorado Real Estate Commission forms", url: "https://dre.colorado.gov/real-estate-broker-contracts-and-forms" },
    ],
  },
];

export const launchStates = statePlaybooks.map((state) => state.name);
export const priorityStatePlaybooks = [...statePlaybooks].sort((a, b) => a.launchRank - b.launchRank);

export function toStateSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getStatePlaybook(value: string) {
  const slug = toStateSlug(value);
  return statePlaybooks.find((state) => state.slug === slug || state.name.toLowerCase() === value.trim().toLowerCase());
}

export function getStateSources(value?: string) {
  const sources = value ? (getStatePlaybook(value)?.sources || []) : statePlaybooks.flatMap((state) => state.sources);
  return [
    ...sources,
    { label: "EPA lead-based paint disclosure overview", url: federalSources.lead },
  ];
}

export function getStateSummary(value: string) {
  const playbook = getStatePlaybook(value);
  if (!playbook) {
    return {
      label: "General state workflow",
      detail: "This state is not in the launch playbook yet. Use general FSBO workflow guidance and route legal questions to a local attorney or closing professional.",
    };
  }

  return {
    label: `${playbook.name} ${playbook.status}`,
    detail: `${playbook.closingModel} ${playbook.pricingCaveat}`,
  };
}
