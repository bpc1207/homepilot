export type SellerProfile = {
  address: string;
  email: string;
  state: string;
  timeline: string;
  propertyType: string;
  estimatedPrice: number;
  builtYear: string;
  hasHoa: boolean;
  hasPool: boolean;
  hasWellOrSeptic: boolean;
  knownFloodHistory: boolean;
  listingPath: "zillow" | "flat-fee-mls" | "both";
  completedTaskIds: string[];
};

export type ChecklistItem = {
  id: string;
  category: "Prepare" | "List" | "Disclose" | "Offer" | "Close" | "Expert";
  title: string;
  detail: string;
  timing: string;
  riskLevel: "Standard" | "Important" | "Expert";
  source?: string;
};

export const defaultProfile: SellerProfile = {
  address: "",
  email: "",
  state: "Florida",
  timeline: "30-60 days",
  propertyType: "Single-family home",
  estimatedPrice: 525000,
  builtYear: "1998",
  hasHoa: false,
  hasPool: false,
  hasWellOrSeptic: false,
  knownFloodHistory: false,
  listingPath: "both",
  completedTaskIds: [],
};

const floridaSources = {
  materialFacts: "https://www.floridarealtors.org/law-ethics/library/florida-real-estate-disclosure-laws",
  flood: "https://www.flsenate.gov/Laws/Statutes/2025/Chapter689/All",
  lead: "https://www.epa.gov/lead/real-estate-disclosures-about-potential-lead-hazards",
};

export const checklistSources = [
  {
    label: "Florida Realtors disclosure overview",
    url: floridaSources.materialFacts,
  },
  {
    label: "Florida Statutes Chapter 689, including flood disclosure",
    url: floridaSources.flood,
  },
  {
    label: "EPA lead-based paint disclosure overview",
    url: floridaSources.lead,
  },
];

export function isPre1978(profile: SellerProfile) {
  const year = Number(profile.builtYear);
  return Number.isFinite(year) && year > 0 && year < 1978;
}

export function getChecklist(profile: SellerProfile): ChecklistItem[] {
  const normalizedState = profile.state.trim().toLowerCase();
  const base: ChecklistItem[] = [
    {
      id: "property-profile",
      category: "Prepare",
      title: "Complete the property profile",
      detail: "Confirm property facts, upgrades, HOA status, mortgage payoff estimate, and seller timeline before generating listing assets.",
      timing: "Before pricing",
      riskLevel: "Standard",
    },
    {
      id: "pricing-plan",
      category: "Prepare",
      title: "Create a launch pricing plan",
      detail: "Review comparable active, pending, and recently sold homes, then choose a fast-sale, balanced, or aspirational launch strategy.",
      timing: "Before listing",
      riskLevel: "Standard",
    },
    {
      id: "listing-package",
      category: "List",
      title: "Build the listing package",
      detail: "Prepare photos, property description, highlights, showing instructions, and a consistent description for Zillow, MLS partner intake, flyers, and social posts.",
      timing: "Before public launch",
      riskLevel: "Standard",
    },
    {
      id: "buyer-screening",
      category: "Offer",
      title: "Set buyer screening rules",
      detail: "Use neutral, fair-housing-aware response templates and request pre-approval or proof of funds before private showings.",
      timing: "Before showings",
      riskLevel: "Important",
    },
    {
      id: "offer-comparison",
      category: "Offer",
      title: "Compare offers by net, risk, and timeline",
      detail: "Evaluate purchase price, concessions, financing, contingencies, buyer-agent compensation requests, earnest money, rent-back, and closing date together.",
      timing: "When offers arrive",
      riskLevel: "Standard",
    },
    {
      id: "title-escrow",
      category: "Close",
      title: "Open title, escrow, or attorney closing file",
      detail: "After contract acceptance, route the signed contract and seller information to the closing provider and track title search, payoff, inspection, appraisal, and signing deadlines.",
      timing: "After accepted contract",
      riskLevel: "Important",
    },
  ];

  if (normalizedState === "florida") {
    base.splice(3, 0,
      {
        id: "fl-known-material-facts",
        category: "Disclose",
        title: "Florida known material facts disclosure check",
        detail: "Florida sellers should organize known facts that materially affect residential property value and are not readily observable or known to the buyer. Use this as a reminder and escalate disclosure questions to a Florida real estate attorney.",
        timing: "Before contract execution",
        riskLevel: "Expert",
        source: floridaSources.materialFacts,
      },
      {
        id: "fl-flood-disclosure",
        category: "Disclose",
        title: "Florida flood disclosure packet",
        detail: "Florida Statute 689.302 requires a residential seller to complete and provide a flood disclosure to a buyer at or before the sales contract is executed.",
        timing: "At or before contract execution",
        riskLevel: "Important",
        source: floridaSources.flood,
      },
    );
  }

  if (isPre1978(profile)) {
    base.splice(3, 0, {
      id: "federal-lead-disclosure",
      category: "Disclose",
      title: "Federal lead-based paint disclosure",
      detail: "Homes built before 1978 typically require lead-based paint disclosures and the EPA-approved pamphlet before a buyer is obligated under a contract.",
      timing: "Before contract execution",
      riskLevel: "Important",
      source: floridaSources.lead,
    });
  }

  if (profile.hasHoa || profile.propertyType.toLowerCase().includes("condo") || profile.propertyType.toLowerCase().includes("townhouse")) {
    base.splice(4, 0, {
      id: "hoa-condo-docs",
      category: "Disclose",
      title: "Collect HOA or condo documents",
      detail: "Gather association contacts, fees, restrictions, resale package requirements, governing docs, pending assessments, and buyer approval steps if applicable.",
      timing: "Before listing or during offer review",
      riskLevel: "Important",
    });
  }

  if (profile.hasPool) {
    base.splice(4, 0, {
      id: "pool-safety-condition",
      category: "Disclose",
      title: "Document pool condition and safety items",
      detail: "Organize permits, equipment age, repair history, safety features, and known defects so buyers receive a clear condition picture.",
      timing: "Before showings",
      riskLevel: "Important",
    });
  }

  if (profile.hasWellOrSeptic) {
    base.splice(4, 0, {
      id: "well-septic-docs",
      category: "Disclose",
      title: "Collect well or septic records",
      detail: "Gather permits, maintenance history, pump-out records, tests, inspections, and known system issues for buyer due diligence.",
      timing: "Before listing",
      riskLevel: "Important",
    });
  }

  if (profile.knownFloodHistory) {
    base.splice(4, 0, {
      id: "flood-history-expert-review",
      category: "Expert",
      title: "Escalate known flood history for review",
      detail: "Known flood damage, insurance claims, federal assistance, unrepaired damage, or flood-zone uncertainty should trigger attorney/title guidance before accepting an offer.",
      timing: "Before accepting an offer",
      riskLevel: "Expert",
      source: normalizedState === "florida" ? floridaSources.flood : undefined,
    });
  }

  if (profile.listingPath === "flat-fee-mls" || profile.listingPath === "both") {
    base.splice(3, 0, {
      id: "flat-fee-mls-handoff",
      category: "List",
      title: "Prepare flat-fee MLS partner handoff",
      detail: "Confirm the local MLS intake requirements, seller contact rules, compensation fields, photo limits, showing instructions, and cancellation/change process with the licensed broker partner.",
      timing: "Before public launch",
      riskLevel: "Expert",
    });
  }

  return base;
}

export function getCompletionPercent(profile: SellerProfile) {
  const checklist = getChecklist(profile);
  if (!checklist.length) return 0;
  const completed = checklist.filter((item) => profile.completedTaskIds.includes(item.id)).length;
  return Math.round((completed / checklist.length) * 100);
}
