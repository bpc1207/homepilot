import type { SellerProfile } from "./checklist";

export type ListingDraft = {
  headline: string;
  highlights: string;
  upgrades: string;
  neighborhood: string;
  description: string;
  socialCaption: string;
  flyerCopy: string;
  showingInstructions: string;
  updatedAt?: string;
};

export type OfferInput = {
  id?: string;
  buyerName: string;
  price: number;
  concessions: number;
  buyerAgentPercent: number;
  earnestMoney: number;
  financingType: "Cash" | "Conventional" | "FHA" | "VA" | "Other";
  inspectionContingency: boolean;
  appraisalContingency: boolean;
  financingContingency: boolean;
  closingDate: string;
  rentBack: string;
  notes: string;
  createdAt?: string;
};

export type ShowingRequest = {
  id?: string;
  requesterName: string;
  requesterEmail: string;
  date: string;
  time: string;
  status: "Requested" | "Approved" | "Declined" | "Completed";
  instructions: string;
  createdAt?: string;
};

export type StoredDocument = {
  id: string;
  name: string;
  category: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
};

export function generateListing(profile: SellerProfile, seed: Partial<ListingDraft> = {}): ListingDraft {
  const addressLabel = profile.address || "your home";
  const property = profile.propertyType.toLowerCase();
  const highlights = seed.highlights || "Bright living spaces, thoughtful updates, flexible layout, and an easy showing experience.";
  const upgrades = seed.upgrades || "Recent maintenance, clean presentation, and move-in ready details.";
  const neighborhood = seed.neighborhood || "Convenient access to everyday shopping, dining, parks, and commuter routes.";
  const headline = seed.headline || `A guided, move-ready ${property} sale at ${addressLabel}`;

  return {
    headline,
    highlights,
    upgrades,
    neighborhood,
    showingInstructions: seed.showingInstructions || "Private showings by confirmed appointment. Please include proof of funds or pre-approval when requesting a showing.",
    description: seed.description || `${headline}. This ${property} is prepared for a confident owner-led sale with clear property details, organized documentation, and a straightforward showing process. Highlights include ${highlights.toLowerCase()} Notable updates include ${upgrades.toLowerCase()} The location offers ${neighborhood.toLowerCase()} Buyers can request a showing, submit structured questions, and provide offer terms through the seller dashboard.`,
    socialCaption: seed.socialCaption || `Now preparing ${addressLabel} for sale by owner. Message for details, showing windows, and buyer qualification steps.`,
    flyerCopy: seed.flyerCopy || `${headline}\n\nHighlights: ${highlights}\nUpdates: ${upgrades}\nLocation: ${neighborhood}\n\nContact the seller to request a showing or submit buyer questions.`,
  };
}

export function getPricingPlan(profile: SellerProfile) {
  const value = Number(profile.estimatedPrice || 0);
  const low = Math.round(value * 0.965 / 1000) * 1000;
  const balanced = Math.round(value / 1000) * 1000;
  const premium = Math.round(value * 1.035 / 1000) * 1000;
  const commissionAvoided = Math.round(value * 0.0275);

  return {
    low,
    balanced,
    premium,
    commissionAvoided,
    strategies: [
      { label: "Fast sale", price: low, note: "Designed to create more buyer urgency and reduce days on market." },
      { label: "Balanced", price: balanced, note: "Uses the current estimate as the main launch anchor." },
      { label: "Aspirational", price: premium, note: "Tests premium demand but should be watched closely for early feedback." },
    ],
  };
}

export function calculateOfferNet(offer: OfferInput) {
  return Number(offer.price || 0) - Number(offer.concessions || 0) - Number(offer.price || 0) * (Number(offer.buyerAgentPercent || 0) / 100);
}

export function scoreOfferRisk(offer: OfferInput) {
  let score = 0;
  if (offer.financingType !== "Cash") score += 1;
  if (offer.financingType === "FHA" || offer.financingType === "VA") score += 1;
  if (offer.inspectionContingency) score += 1;
  if (offer.appraisalContingency) score += 1;
  if (offer.financingContingency) score += 1;
  if (Number(offer.concessions || 0) > Number(offer.price || 0) * 0.02) score += 1;
  if (score <= 1) return "Low";
  if (score <= 3) return "Medium";
  return "High";
}

export function defaultOffer(): OfferInput {
  return {
    buyerName: "",
    price: 525000,
    concessions: 0,
    buyerAgentPercent: 0,
    earnestMoney: 10000,
    financingType: "Conventional",
    inspectionContingency: true,
    appraisalContingency: true,
    financingContingency: true,
    closingDate: "",
    rentBack: "None",
    notes: "",
  };
}

export function defaultShowing(): ShowingRequest {
  return {
    requesterName: "",
    requesterEmail: "",
    date: "",
    time: "10:00",
    status: "Requested",
    instructions: "Please send pre-approval or proof of funds before the showing is confirmed.",
  };
}
