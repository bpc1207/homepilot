import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileSignature,
  Home,
  Layers3,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  checklistSources,
  defaultProfile,
  getChecklist,
  getCompletionPercent,
  isPre1978,
  type SellerProfile,
} from "./checklist";
import { adminJson, apiJson, apiUpload, clearToken, getToken, setToken as storeToken } from "./api";
import {
  calculateOfferNet,
  defaultOffer,
  defaultShowing,
  generateListing,
  getPricingPlan,
  scoreOfferRisk,
  type ListingDraft,
  type OfferInput,
  type ShowingRequest,
  type StoredDocument,
} from "./productTools";
import "./styles.css";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

type Offer = {
  label: string;
  price: number;
  concessions: number;
  buyerAgent: number;
  closingDays: number;
  risk: "Low" | "Medium" | "High";
  terms: string;
};

type LeadStatus = "idle" | "sending" | "success" | "queued" | "error";

const workflow = [
  "Build your sale plan",
  "Price with confidence",
  "Create a professional listing",
  "Launch on Zillow or MLS partner",
  "Manage showings and buyer questions",
  "Compare offers by net, risk, and timeline",
  "Complete disclosures and closing steps",
];

const features: Feature[] = [
  {
    icon: BarChart3,
    title: "Pricing Coach",
    body: "Comp-aware pricing ranges, local market notes, and plain-English strategy options without pretending to be an appraisal.",
  },
  {
    icon: Sparkles,
    title: "Listing Builder",
    body: "Turn photos, facts, upgrades, and neighborhood details into polished portal-ready copy and marketing assets.",
  },
  {
    icon: CalendarClock,
    title: "Showing Scheduler",
    body: "Let sellers approve showing windows, organize open houses, and keep buyer follow-up from becoming a sticky-note storm.",
  },
  {
    icon: MessageSquareText,
    title: "Buyer Inbox",
    body: "Centralize inquiries, pre-approval requests, proof-of-funds checks, and safe response templates.",
  },
  {
    icon: Scale,
    title: "Offer Comparison",
    body: "Compare true net proceeds, contingencies, closing speed, financing risk, and buyer-agent compensation requests.",
  },
  {
    icon: FileSignature,
    title: "Disclosures & Docs",
    body: "State-specific checklisting, document vault, e-sign routing, and attorney/title escalation when software should not guess.",
  },
];

const offers: Offer[] = [
  {
    label: "Offer A",
    price: 525000,
    concessions: 8500,
    buyerAgent: 2.5,
    closingDays: 38,
    risk: "Medium",
    terms: "Conventional loan, inspection + appraisal contingencies",
  },
  {
    label: "Offer B",
    price: 512000,
    concessions: 2500,
    buyerAgent: 0,
    closingDays: 18,
    risk: "Low",
    terms: "Cash, inspection informational only",
  },
  {
    label: "Offer C",
    price: 536000,
    concessions: 14000,
    buyerAgent: 3,
    closingDays: 52,
    risk: "High",
    terms: "FHA financing, appraisal gap unresolved",
  },
];

const launchStates = ["Florida", "Texas", "Arizona", "North Carolina", "Georgia", "Colorado"];
const profileStorageKey = "homepilot.profile";
const queuedLeadsKey = "homepilot.queuedLeads";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function readStoredProfile(): SellerProfile {
  try {
    const stored = window.localStorage.getItem(profileStorageKey);
    return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
  } catch {
    return defaultProfile;
  }
}

function useSellerProfile() {
  const [profile, setProfileState] = useState<SellerProfile>(() => readStoredProfile());

  function setProfile(next: SellerProfile | ((current: SellerProfile) => SellerProfile)) {
    setProfileState((current) => {
      const updated = typeof next === "function" ? next(current) : next;
      window.localStorage.setItem(profileStorageKey, JSON.stringify(updated));
      return updated;
    });
  }

  return [profile, setProfile] as const;
}

function Header() {
  return (
    <nav className="nav-shell" aria-label="Main navigation">
      <Link className="brand" to="/" aria-label="HomePilot home">
        <span className="brand-mark"><Home size={19} /></span>
        <span>HomePilot</span>
      </Link>
      <div className="nav-links">
        <Link to="/how-it-works">Workflow</Link>
        <Link to="/savings-calculator">Calculator</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/states/florida">Florida</Link>
        <Link to="/app">Dashboard</Link>
      </div>
      <Link className="nav-cta" to="/app">Start sale plan</Link>
    </nav>
  );
}

function LeadForm({ profile, setProfile }: { profile: SellerProfile; setProfile: (next: SellerProfile | ((current: SellerProfile) => SellerProfile)) => void }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState({
    address: profile.address,
    email: profile.email,
    state: profile.state,
    timeline: profile.timeline,
    propertyType: profile.propertyType,
    estimatedPrice: profile.estimatedPrice,
  });
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [message, setMessage] = useState("");

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const nextProfile = { ...profile, ...draft, estimatedPrice: Number(draft.estimatedPrice || profile.estimatedPrice) };
    setProfile(nextProfile);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nextProfile, source: "free-sale-plan" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Lead could not be saved.");
      }
      setStatus("success");
      setMessage("Saved. Your dashboard is ready.");
      window.setTimeout(() => navigate("/app"), 450);
    } catch (error) {
      const queuedLead = { ...nextProfile, source: "free-sale-plan", queuedAt: new Date().toISOString() };
      const existing = JSON.parse(window.localStorage.getItem(queuedLeadsKey) || "[]");
      window.localStorage.setItem(queuedLeadsKey, JSON.stringify([...existing, queuedLead]));
      setStatus("queued");
      setMessage(error instanceof Error ? `${error.message} Saved locally for now.` : "Saved locally for now.");
      window.setTimeout(() => navigate("/app"), 700);
    }
  }

  return (
    <form className="lead-form" onSubmit={submitLead}>
      <label>
        Property address
        <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} type="text" placeholder="123 Maple Ridge Lane" required />
      </label>
      <label>
        Email
        <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} type="email" placeholder="you@example.com" required />
      </label>
      <div className="form-split">
        <label>
          State
          <select value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })}>
            {launchStates.map((state) => <option key={state}>{state}</option>)}
          </select>
        </label>
        <label>
          Timeline
          <select value={draft.timeline} onChange={(event) => setDraft({ ...draft, timeline: event.target.value })}>
            <option>ASAP</option>
            <option>30-60 days</option>
            <option>60-90 days</option>
            <option>Just researching</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Saving..." : "Generate my sale plan"} <Mail size={17} />
      </button>
      {message && <p className={`form-message ${status}`}>{message}</p>}
    </form>
  );
}

function SavingsCalculator() {
  const [homePrice, setHomePrice] = useState(525000);
  const [listingCommission, setListingCommission] = useState(2.75);
  const [platformFee, setPlatformFee] = useState(899);

  const savings = useMemo(() => {
    const avoidedListingCommission = homePrice * (listingCommission / 100);
    return Math.max(0, avoidedListingCommission - platformFee);
  }, [homePrice, listingCommission, platformFee]);

  return (
    <aside className="savings-card reveal delay-1" aria-label="Commission savings calculator">
      <div className="card-header">
        <div>
          <span className="mini-label">Savings preview</span>
          <h2>{currency(savings)}</h2>
        </div>
        <CircleDollarSign className="floating-icon" />
      </div>
      <p>Estimated listing-side commission avoided after HomePilot fee.</p>
      <label>
        Home price
        <input type="range" min="250000" max="1500000" step="25000" value={homePrice} onChange={(event) => setHomePrice(Number(event.target.value))} />
        <strong>{currency(homePrice)}</strong>
      </label>
      <label>
        Listing commission avoided
        <input type="range" min="1" max="3.5" step="0.25" value={listingCommission} onChange={(event) => setListingCommission(Number(event.target.value))} />
        <strong>{listingCommission.toFixed(2)}%</strong>
      </label>
      <label>
        HomePilot package
        <select value={platformFee} onChange={(event) => setPlatformFee(Number(event.target.value))}>
          <option value="299">Starter - $299</option>
          <option value="899">Launch - $899</option>
          <option value="1799">Guided Sale - $1,799</option>
        </select>
      </label>
      <div className="calc-note">
        <LockKeyhole size={15} /> Educational estimate only. Buyer-agent compensation, title, escrow, taxes, and local fees vary.
      </div>
    </aside>
  );
}

function DashboardPreview({ profile }: { profile: SellerProfile }) {
  const checklist = getChecklist(profile);
  const percent = getCompletionPercent(profile);
  const previewItems = checklist.slice(0, 4);

  return (
    <div className="dashboard-mock">
      <div className="dashboard-top">
        <div>
          <span className="mini-label">{profile.address || "123 Maple Ridge Lane"}</span>
          <h3>Sale readiness: {percent}%</h3>
        </div>
        <Link to="/app">Continue setup <ChevronRight size={17} /></Link>
      </div>
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <div className="task-grid">
        {previewItems.map((step) => {
          const complete = profile.completedTaskIds.includes(step.id);
          return (
            <article key={step.id} className={`task-card ${complete ? "complete" : step.riskLevel.toLowerCase()}`}>
              <div className="task-status">{complete ? "Complete" : step.riskLevel}</div>
              <h4>{step.title}</h4>
              <p>{step.detail}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function OfferComparison() {
  const [selectedOffer, setSelectedOffer] = useState(offers[1]);
  const selectedNet = useMemo(() => {
    return selectedOffer.price - selectedOffer.concessions - selectedOffer.price * (selectedOffer.buyerAgent / 100);
  }, [selectedOffer]);

  return (
    <section className="section offer-section">
      <div className="offer-copy">
        <p className="eyebrow"><Scale size={16} /> Offer intelligence</p>
        <h2>Help sellers choose the best offer, not just the highest headline price.</h2>
        <p>
          HomePilot turns confusing offer packets into comparable terms: net proceeds, concessions, buyer-agent compensation requests, contingencies, financing risk, and closing timeline.
        </p>
        <div className="offer-summary">
          <span>Selected net</span>
          <strong>{currency(selectedNet)}</strong>
          <small>{selectedOffer.terms}</small>
        </div>
      </div>
      <div className="offer-table" role="list" aria-label="Offer comparison cards">
        {offers.map((offer) => {
          const net = offer.price - offer.concessions - offer.price * (offer.buyerAgent / 100);
          const active = selectedOffer.label === offer.label;
          return (
            <button key={offer.label} className={`offer-row ${active ? "active" : ""}`} onClick={() => setSelectedOffer(offer)}>
              <span>{offer.label}</span>
              <strong>{currency(net)}</strong>
              <em>{offer.risk} risk</em>
              <small>{offer.closingDays} day close</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HomePage({ profile, setProfile }: { profile: SellerProfile; setProfile: (next: SellerProfile | ((current: SellerProfile) => SellerProfile)) => void }) {
  return (
    <>
      <section id="top" className="hero section-grid">
        <div className="hero-copy reveal">
          <p className="eyebrow"><ShieldCheck size={16} /> Seller-led. Expert-guided. Built for confidence.</p>
          <h1>Sell your home yourself, without feeling on your own.</h1>
          <p className="hero-lede">
            HomePilot guides homeowners through pricing, listing, marketing, showings, offers, disclosures, and closing - step by step - without a traditional listing-agent commission.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/app">Build my free sale plan <ArrowRight size={18} /></Link>
            <Link className="button secondary" to="/how-it-works">View workflow</Link>
          </div>
          <div className="trust-row" aria-label="Trust signals">
            <span><BadgeCheck size={16} /> State-specific checklists</span>
            <span><BadgeCheck size={16} /> Offer comparison</span>
            <span><BadgeCheck size={16} /> Expert escalation</span>
          </div>
        </div>
        <SavingsCalculator />
      </section>

      <section className="problem-band">
        <div>
          <span className="stat">5%</span>
          <p>Only a small share of sellers go FSBO today because the process still feels too risky and fragmented.</p>
        </div>
        <div>
          <span className="stat">$10k+</span>
          <p>Potential listing-side commission savings can be meaningful on a typical U.S. home sale.</p>
        </div>
        <div>
          <span className="stat">1 place</span>
          <p>HomePilot brings listing, tasks, buyer messages, offers, documents, and closing steps into one dashboard.</p>
        </div>
      </section>

      <section className="section dashboard-section">
        <div className="section-heading narrow">
          <p className="eyebrow"><Layers3 size={16} /> Product cockpit</p>
          <h2>A guided dashboard, not a folder of forms.</h2>
          <p>Every seller sees the next best step, what is already done, what is blocked, and when a professional should step in.</p>
        </div>
        <DashboardPreview profile={profile} />
      </section>

      <WorkflowSection />
      <FeatureSection />
      <OfferComparison />
      <LegalSection />
      <PricingCards />
      <MvpSection />

      <section id="start" className="section start-section">
        <div className="start-panel">
          <div>
            <p className="eyebrow"><UsersRound size={16} /> Founder-ready funnel</p>
            <h2>Start with a free sale plan.</h2>
            <p>Collect address, state, timeline, property type, and seller confidence score. Then convert into a guided package.</p>
          </div>
          <LeadForm profile={profile} setProfile={setProfile} />
        </div>
      </section>
    </>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="section workflow-section">
      <div className="section-heading">
        <p className="eyebrow"><ClipboardCheck size={16} /> End-to-end workflow</p>
        <h2>From "maybe I can sell this myself" to a clean closing path.</h2>
      </div>
      <div className="workflow-line">
        {workflow.map((item, index) => (
          <div className="workflow-step" key={item}>
            <span>{index + 1}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section id="features" className="section features-section">
      <div className="section-heading narrow">
        <p className="eyebrow"><Sparkles size={16} /> Core product</p>
        <h2>The V1 that actually helps a homeowner launch.</h2>
        <p>Focused on the moments where FSBO sellers lose confidence: pricing, looking professional, handling buyers, comparing offers, and staying compliant.</p>
      </div>
      <div className="feature-grid">
        {features.map(({ icon: Icon, title, body }) => (
          <article className="feature-card" key={title}>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LegalSection() {
  return (
    <section className="section legal-section">
      <div className="legal-card">
        <p className="eyebrow"><ShieldCheck size={16} /> Legal guardrails</p>
        <h2>Software where it is safe. Experts where it matters.</h2>
        <p>
          The product should explain processes, organize facts, and flag requirements - while routing legal interpretation, title issues, contract questions, escrow, and regulated brokerage activities to qualified partners.
        </p>
        <div className="guardrail-list">
          <span><Check size={16} /> State-specific disclosure checklist</span>
          <span><Check size={16} /> Attorney/title escalation paths</span>
          <span><Check size={16} /> Fair-housing-aware messaging</span>
          <span><Check size={16} /> No AI legal advice promises</span>
        </div>
      </div>
    </section>
  );
}

function PricingCards() {
  return (
    <section id="pricing" className="section pricing-section">
      <div className="section-heading narrow">
        <p className="eyebrow"><CircleDollarSign size={16} /> Pricing</p>
        <h2>Transparent packages built around seller confidence.</h2>
      </div>
      <div className="pricing-grid">
        <article className="price-card">
          <span>Starter</span>
          <h3>$299</h3>
          <p>For selling to someone you know or exploring FSBO.</p>
          <ul>
            <li><Check size={15} /> Sale checklist</li>
            <li><Check size={15} /> Net proceeds calculator</li>
            <li><Check size={15} /> Document vault</li>
          </ul>
        </article>
        <article className="price-card featured">
          <span>Launch</span>
          <h3>$899</h3>
          <p>The core guided sale platform for serious owner-led sellers.</p>
          <ul>
            <li><Check size={15} /> Listing builder</li>
            <li><Check size={15} /> Pricing guidance</li>
            <li><Check size={15} /> Showing scheduler</li>
            <li><Check size={15} /> Offer comparison</li>
          </ul>
        </article>
        <article className="price-card">
          <span>Guided Sale</span>
          <h3>$1,799</h3>
          <p>For sellers who want software plus human transaction support.</p>
          <ul>
            <li><Check size={15} /> Concierge onboarding</li>
            <li><Check size={15} /> Partner handoffs</li>
            <li><Check size={15} /> Closing timeline support</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function MvpSection() {
  return (
    <section id="mvp" className="section mvp-section">
      <div className="mvp-copy">
        <p className="eyebrow"><MapPinned size={16} /> Launch plan</p>
        <h2>Start narrow, learn fast, then automate the messy parts.</h2>
        <p>
          The MVP launches in a small set of high-opportunity states with manual pricing review, manual partner matching, and a software dashboard that captures every repeatable workflow.
        </p>
        <div className="state-pills">
          {launchStates.map((state) => <span key={state}>{state}</span>)}
        </div>
      </div>
      <div className="mvp-card">
        <h3>What stays manual first</h3>
        <ul>
          <li>Pricing sanity checks</li>
          <li>State checklist QA</li>
          <li>Attorney/title partner routing</li>
          <li>Flat-fee MLS coordination</li>
          <li>Offer review support</li>
        </ul>
      </div>
    </section>
  );
}

function PageHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="page-hero section">
      <p className="eyebrow"><Sparkles size={16} /> {eyebrow}</p>
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}

function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="A guided operating system for a homeowner-led sale." body="The product breaks the sale into small, confidence-building steps, then routes risky moments to expert partners instead of pretending every sale is just a form." />
      <WorkflowSection />
      <FeatureSection />
      <LegalSection />
    </>
  );
}

function PricingPage({ profile, setProfile }: { profile: SellerProfile; setProfile: (next: SellerProfile | ((current: SellerProfile) => SellerProfile)) => void }) {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Flat packages first. Add expert help only when needed." body="HomePilot starts with transparent software pricing so homeowners can compare the cost against traditional listing-side commission without feeling trapped in a percentage fee." />
      <PricingCards />
      <section className="section start-section">
        <div className="start-panel">
          <div>
            <p className="eyebrow"><CircleDollarSign size={16} /> Convert savings into action</p>
            <h2>See your plan before you pay.</h2>
            <p>The free sale plan captures the property basics and shows a first checklist before asking the seller to upgrade.</p>
          </div>
          <LeadForm profile={profile} setProfile={setProfile} />
        </div>
      </section>
    </>
  );
}

function SavingsPage() {
  return (
    <>
      <PageHero eyebrow="Savings calculator" title="Estimate what a listing-side commission alternative could save." body="Use this as an educational estimate. Actual costs vary by buyer-agent compensation requests, title, escrow, taxes, local fees, and optional expert services." />
      <section className="section calculator-page">
        <SavingsCalculator />
        <div className="mvp-card">
          <h3>What this calculator includes</h3>
          <ul>
            <li>Estimated home sale price</li>
            <li>Listing-side commission avoided</li>
            <li>Selected HomePilot package fee</li>
            <li>A reminder that closing costs and buyer-side economics vary</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function FloridaStatePage({ profile }: { profile: SellerProfile }) {
  const floridaProfile = { ...profile, state: "Florida" };
  const checklist = getChecklist(floridaProfile);

  return (
    <>
      <PageHero eyebrow="Florida launch state" title="A Florida FSBO checklist that flags high-risk disclosure moments." body="This first state engine focuses on known material facts, flood disclosure, lead paint triggers, HOA or condo documents, and expert escalation. It is legal information, not legal advice." />
      <section className="section checklist-section">
        <div className="checklist-panel">
          {checklist.map((item) => (
            <article className="checklist-item" key={item.id}>
              <span className={`risk-pill ${item.riskLevel.toLowerCase()}`}>{item.riskLevel}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>{item.category} - {item.timing}</small>
            </article>
          ))}
        </div>
        <div className="source-card">
          <h3>Reference sources</h3>
          <p>These links are included so a human operator or attorney partner can validate the state playbook before launch.</p>
          {checklistSources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          ))}
        </div>
      </section>
    </>
  );
}


type WorkspacePayload = {
  profile: SellerProfile;
  listing: ListingDraft | null;
  offers: OfferInput[];
  showings: ShowingRequest[];
  documents: StoredDocument[];
  payments: PaymentRecord[];
};

type PaymentRecord = {
  id: string;
  provider: "stripe" | "mock";
  planId: string;
  status: "pending" | "paid" | "failed";
  amount: number;
  currency: string;
  checkoutUrl?: string;
  createdAt: string;
};

type BillingPlan = {
  id: string;
  name: string;
  amount: number;
  description: string;
};

type AdminOverview = {
  leads: Array<{ id: string; email: string; address: string; state: string; createdAt: string }>;
  sellers: Array<{
    user: { id: string; email: string; createdAt: string };
    profile: SellerProfile;
    listing: ListingDraft | null;
    offers: OfferInput[];
    showings: ShowingRequest[];
    documents: StoredDocument[];
  }>;
};

function AuthPanel({ onAuth }: { onAuth: (token: string, profile: SellerProfile, email: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Working...");
    try {
      const result = await apiJson<{ token: string; user: { email: string }; profile: SellerProfile }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      storeToken(result.token);
      onAuth(result.token, result.profile, result.user.email);
      setMessage("Signed in. Loading your workspace...");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  return (
    <section className="section auth-section">
      <div className="auth-card">
        <div>
          <p className="eyebrow"><LockKeyhole size={16} /> Account workspace</p>
          <h2>{mode === "register" ? "Create your seller workspace." : "Welcome back."}</h2>
          <p>Accounts unlock server-saved profiles, listing drafts, offers, showings, documents, and the operator console. For this pilot build, credentials are stored locally in the development API database.</p>
        </div>
        <form className="lead-form" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit">{mode === "register" ? "Create workspace" : "Sign in"} <ArrowRight size={17} /></button>
          <button className="text-button" type="button" onClick={() => setMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
          {message && <p className="form-message queued">{message}</p>}
        </form>
      </div>
    </section>
  );
}

function ProfileEditor({ profile, onProfileChange, onSave, saving }: { profile: SellerProfile; onProfileChange: (profile: SellerProfile) => void; onSave: () => void; saving: boolean }) {
  function update<K extends keyof SellerProfile>(key: K, value: SellerProfile[K]) {
    onProfileChange({ ...profile, [key]: value });
  }

  return (
    <div className="profile-panel">
      <div className="profile-form">
        <label>Property address<input value={profile.address} onChange={(event) => update("address", event.target.value)} placeholder="123 Maple Ridge Lane" /></label>
        <label>Email<input value={profile.email} disabled placeholder="you@example.com" /></label>
        <div className="form-split">
          <label>State<select value={profile.state} onChange={(event) => update("state", event.target.value)}>{launchStates.map((state) => <option key={state}>{state}</option>)}</select></label>
          <label>Timeline<select value={profile.timeline} onChange={(event) => update("timeline", event.target.value)}><option>ASAP</option><option>30-60 days</option><option>60-90 days</option><option>Just researching</option></select></label>
        </div>
        <div className="form-split">
          <label>Property type<select value={profile.propertyType} onChange={(event) => update("propertyType", event.target.value)}><option>Single-family home</option><option>Townhouse</option><option>Condo</option><option>Duplex</option></select></label>
          <label>Built year<input value={profile.builtYear} onChange={(event) => update("builtYear", event.target.value)} placeholder="1998" /></label>
        </div>
        <div className="form-split">
          <label>Estimated price<input type="number" value={profile.estimatedPrice} onChange={(event) => update("estimatedPrice", Number(event.target.value))} /></label>
          <label>Listing path<select value={profile.listingPath} onChange={(event) => update("listingPath", event.target.value as SellerProfile["listingPath"])}><option value="both">Zillow + MLS partner</option><option value="zillow">Zillow FSBO first</option><option value="flat-fee-mls">Flat-fee MLS partner</option></select></label>
        </div>
        <div className="checkbox-grid">
          <label><input type="checkbox" checked={profile.hasHoa} onChange={(event) => update("hasHoa", event.target.checked)} /> HOA or condo association</label>
          <label><input type="checkbox" checked={profile.hasPool} onChange={(event) => update("hasPool", event.target.checked)} /> Pool</label>
          <label><input type="checkbox" checked={profile.hasWellOrSeptic} onChange={(event) => update("hasWellOrSeptic", event.target.checked)} /> Well or septic</label>
          <label><input type="checkbox" checked={profile.knownFloodHistory} onChange={(event) => update("knownFloodHistory", event.target.checked)} /> Known flood history</label>
        </div>
        {isPre1978(profile) && <p className="form-message queued">Built before 1978 detected: lead-based paint disclosure task added.</p>}
        <button className="button primary inline-button" onClick={onSave}>{saving ? "Saving..." : "Save profile"}</button>
      </div>
    </div>
  );
}

function ChecklistWorkspace({ profile, onToggleTask }: { profile: SellerProfile; onToggleTask: (id: string) => void }) {
  const checklist = getChecklist(profile);
  return (
    <div className="checklist-panel live">
      {checklist.map((item) => {
        const complete = profile.completedTaskIds.includes(item.id);
        return (
          <article className={`checklist-item ${complete ? "done" : ""}`} key={item.id}>
            <button className="task-toggle" onClick={() => onToggleTask(item.id)} aria-label={`Toggle ${item.title}`}>{complete ? <Check size={18} /> : null}</button>
            <div>
              <span className={`risk-pill ${item.riskLevel.toLowerCase()}`}>{item.riskLevel}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>{item.category} - {item.timing}</small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ListingBuilder({ profile, listing, onSave }: { profile: SellerProfile; listing: ListingDraft | null; onSave: (listing: ListingDraft) => void }) {
  const [draft, setDraft] = useState<ListingDraft>(() => listing || generateListing(profile));

  useEffect(() => {
    if (!listing) setDraft(generateListing(profile, draft));
  }, [profile.address, profile.propertyType, profile.state]);

  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><Sparkles size={16} /> Listing builder</p><h2>Professional copy without the FSBO cringe.</h2></div>
      <div className="tool-grid two">
        <div className="profile-form">
          <label>Headline<input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} /></label>
          <label>Highlights<textarea value={draft.highlights} onChange={(event) => setDraft({ ...draft, highlights: event.target.value })} /></label>
          <label>Upgrades<textarea value={draft.upgrades} onChange={(event) => setDraft({ ...draft, upgrades: event.target.value })} /></label>
          <label>Neighborhood<textarea value={draft.neighborhood} onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })} /></label>
          <div className="button-row"><button className="button secondary" onClick={() => setDraft(generateListing(profile, draft))}>Regenerate copy</button><button className="button primary" onClick={() => onSave(draft)}>Save listing</button></div>
        </div>
        <div className="listing-preview">
          <span className="mini-label">Portal-ready draft</span>
          <h3>{draft.headline}</h3>
          <p>{draft.description}</p>
          <h4>Social caption</h4><p>{draft.socialCaption}</p>
          <h4>Flyer copy</h4><pre>{draft.flyerCopy}</pre>
          <h4>Showing instructions</h4><p>{draft.showingInstructions}</p>
        </div>
      </div>
    </section>
  );
}

function PricingPlanner({ profile }: { profile: SellerProfile }) {
  const plan = getPricingPlan(profile);
  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><BarChart3 size={16} /> Pricing planner</p><h2>Pick a launch strategy, not a magic number.</h2><p>These are educational strategy ranges. A human comp review should validate before launch.</p></div>
      <div className="strategy-grid">
        {plan.strategies.map((strategy) => (
          <article className="strategy-card" key={strategy.label}><span>{strategy.label}</span><h3>{currency(strategy.price)}</h3><p>{strategy.note}</p></article>
        ))}
      </div>
      <div className="calc-note"><CircleDollarSign size={15} /> Estimated listing-side commission avoided at 2.75%: <strong>{currency(plan.commissionAvoided)}</strong></div>
    </section>
  );
}

function OffersWorkspace({ offers, onCreate, onDelete }: { offers: OfferInput[]; onCreate: (offer: OfferInput) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<OfferInput>(() => defaultOffer());
  const sorted = [...offers].sort((a, b) => calculateOfferNet(b) - calculateOfferNet(a));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(draft);
    setDraft(defaultOffer());
  }

  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><Scale size={16} /> Offer desk</p><h2>Intake and compare real offers.</h2></div>
      <div className="tool-grid two">
        <form className="profile-form" onSubmit={submit}>
          <label>Buyer name<input value={draft.buyerName} onChange={(event) => setDraft({ ...draft, buyerName: event.target.value })} required /></label>
          <div className="form-split"><label>Price<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label><label>Concessions<input type="number" value={draft.concessions} onChange={(event) => setDraft({ ...draft, concessions: Number(event.target.value) })} /></label></div>
          <div className="form-split"><label>Buyer agent %<input type="number" step="0.25" value={draft.buyerAgentPercent} onChange={(event) => setDraft({ ...draft, buyerAgentPercent: Number(event.target.value) })} /></label><label>Earnest money<input type="number" value={draft.earnestMoney} onChange={(event) => setDraft({ ...draft, earnestMoney: Number(event.target.value) })} /></label></div>
          <div className="form-split"><label>Financing<select value={draft.financingType} onChange={(event) => setDraft({ ...draft, financingType: event.target.value as OfferInput["financingType"] })}><option>Cash</option><option>Conventional</option><option>FHA</option><option>VA</option><option>Other</option></select></label><label>Closing date<input type="date" value={draft.closingDate} onChange={(event) => setDraft({ ...draft, closingDate: event.target.value })} /></label></div>
          <div className="checkbox-grid"><label><input type="checkbox" checked={draft.inspectionContingency} onChange={(event) => setDraft({ ...draft, inspectionContingency: event.target.checked })} /> Inspection contingency</label><label><input type="checkbox" checked={draft.appraisalContingency} onChange={(event) => setDraft({ ...draft, appraisalContingency: event.target.checked })} /> Appraisal contingency</label><label><input type="checkbox" checked={draft.financingContingency} onChange={(event) => setDraft({ ...draft, financingContingency: event.target.checked })} /> Financing contingency</label></div>
          <label>Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <button className="button primary" type="submit">Save offer</button>
        </form>
        <div className="offer-stack">
          {sorted.length === 0 && <p className="empty-note">No offers yet. Add one to see net and risk comparisons.</p>}
          {sorted.map((offer) => (
            <article className="offer-detail" key={offer.id}>
              <div><span className="mini-label">{offer.buyerName || "Unnamed buyer"}</span><h3>{currency(calculateOfferNet(offer))}</h3></div>
              <span className={`risk-pill ${scoreOfferRisk(offer).toLowerCase()}`}>{scoreOfferRisk(offer)} risk</span>
              <p>{offer.financingType} financing, {offer.buyerAgentPercent}% buyer-agent request, {currency(offer.concessions)} concessions.</p>
              <button className="text-button danger" onClick={() => offer.id && onDelete(offer.id)}>Delete</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowingsWorkspace({ showings, onCreate, onUpdate }: { showings: ShowingRequest[]; onCreate: (showing: ShowingRequest) => void; onUpdate: (showing: ShowingRequest) => void }) {
  const [draft, setDraft] = useState<ShowingRequest>(() => defaultShowing());
  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><CalendarClock size={16} /> Showing scheduler</p><h2>Keep buyer visits organized and safe.</h2></div>
      <div className="tool-grid two">
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); onCreate(draft); setDraft(defaultShowing()); }}>
          <label>Requester name<input value={draft.requesterName} onChange={(event) => setDraft({ ...draft, requesterName: event.target.value })} required /></label>
          <label>Requester email<input type="email" value={draft.requesterEmail} onChange={(event) => setDraft({ ...draft, requesterEmail: event.target.value })} required /></label>
          <div className="form-split"><label>Date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Time<input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>
          <label>Instructions<textarea value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label>
          <button className="button primary" type="submit">Add showing</button>
        </form>
        <div className="offer-stack">
          {showings.length === 0 && <p className="empty-note">No showings yet.</p>}
          {showings.map((showing) => (
            <article className="offer-detail" key={showing.id}>
              <div><span className="mini-label">{showing.status}</span><h3>{showing.date || "Date TBD"} {showing.time}</h3></div>
              <p>{showing.requesterName} - {showing.requesterEmail}</p>
              <div className="button-row"><button className="button secondary" onClick={() => onUpdate({ ...showing, status: "Approved" })}>Approve</button><button className="button secondary" onClick={() => onUpdate({ ...showing, status: "Completed" })}>Complete</button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DocumentVault({ documents, onUpload, onDelete }: { documents: StoredDocument[]; onUpload: (name: string, category: string, file: File) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Listing photo");
  const [file, setFile] = useState<File | null>(null);
  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><FileSignature size={16} /> Document vault</p><h2>Store the paper trail before it becomes chaos.</h2></div>
      <div className="tool-grid two">
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); if (file) { onUpload(name || file.name, category, file); setName(""); setFile(null); } }}>
          <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kitchen photo set" /></label>
          <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Listing photo</option><option>Disclosure</option><option>Offer</option><option>Contract</option><option>HOA/Condo</option><option>Inspection</option><option>Closing</option><option>Other</option></select></label>
          <label>File<input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <button className="button primary" type="submit" disabled={!file}>Upload file</button>
        </form>
        <div className="offer-stack">
          {documents.length === 0 && <p className="empty-note">No documents uploaded yet.</p>}
          {documents.map((doc) => (
            <article className="offer-detail" key={doc.id}>
              <div><span className="mini-label">{doc.category}</span><h3>{doc.name}</h3></div>
              <p>{doc.originalName} - {Math.round(doc.size / 1024)} KB</p>
              <div className="button-row"><a className="button secondary" href={doc.path} target="_blank" rel="noreferrer">Open</a><button className="text-button danger" onClick={() => onDelete(doc.id)}>Delete</button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


function BillingWorkspace({ payments, onCheckout }: { payments: PaymentRecord[]; onCheckout: (planId: string) => void }) {
  const plans: BillingPlan[] = [
    { id: "starter", name: "Starter", amount: 29900, description: "Sale checklist, net proceeds calculator, and document vault." },
    { id: "launch", name: "Launch", amount: 89900, description: "Listing builder, pricing guidance, showing scheduler, offer comparison, and seller checklist." },
    { id: "guided", name: "Guided Sale", amount: 179900, description: "Software plus concierge onboarding, partner handoffs, and closing timeline support." },
  ];

  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><CircleDollarSign size={16} /> Billing</p><h2>Turn the pilot into a paid package.</h2><p>If Stripe env vars are missing, checkout records a mock paid purchase so the local flow remains testable.</p></div>
      <div className="pricing-grid billing-grid">
        {plans.map((plan) => (
          <article className={`price-card ${plan.id === "launch" ? "featured" : ""}`} key={plan.id}>
            <span>{plan.name}</span>
            <h3>{currency(plan.amount / 100)}</h3>
            <p>{plan.description}</p>
            <button className={`button ${plan.id === "launch" ? "secondary" : "primary"}`} onClick={() => onCheckout(plan.id)}>Checkout</button>
          </article>
        ))}
      </div>
      <div className="offer-stack">
        <h3>Payment history</h3>
        {payments.length === 0 && <p className="empty-note">No payments yet.</p>}
        {payments.map((payment) => (
          <article className="offer-detail" key={payment.id}>
            <div><span className="mini-label">{payment.provider} - {payment.status}</span><h3>{payment.planId} {currency(payment.amount / 100)}</h3></div>
            <p>{payment.currency.toUpperCase()} - {new Date(payment.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminConsole() {
  const [token, setAdminToken] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [message, setMessage] = useState("");

  async function loadAdmin() {
    setMessage("Loading...");
    try {
      const result = await adminJson<AdminOverview>("/api/admin/overview", token);
      setOverview({ leads: result.leads, sellers: result.sellers });
      setMessage("Loaded operator overview.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load admin view.");
    }
  }

  return (
    <section className="tool-panel">
      <div className="tool-heading"><p className="eyebrow"><UsersRound size={16} /> Operator console</p><h2>Manual concierge support starts here.</h2><p>Default development admin token is <code>dev-admin-token</code>. Change `ADMIN_TOKEN` before any real deployment.</p></div>
      <div className="profile-form admin-token-row"><label>Admin token<input value={token} onChange={(event) => setAdminToken(event.target.value)} placeholder="dev-admin-token" /></label><button className="button primary" onClick={loadAdmin}>Load overview</button></div>
      {message && <p className="form-message queued">{message}</p>}
      {overview && <div className="admin-grid"><article className="source-card"><h3>{overview.leads.length} leads</h3>{overview.leads.slice(0, 6).map((lead) => <p key={lead.id}><strong>{lead.email}</strong><br />{lead.address}</p>)}</article><article className="source-card"><h3>{overview.sellers.length} sellers</h3>{overview.sellers.map((seller) => <p key={seller.user.id}><strong>{seller.user.email}</strong><br />{seller.profile.address || "No address yet"} - {seller.offers.length} offers - {seller.documents.length} docs</p>)}</article></div>}
    </section>
  );
}

function DashboardPage({ profile, setProfile }: { profile: SellerProfile; setProfile: (next: SellerProfile | ((current: SellerProfile) => SellerProfile)) => void }) {
  const [token, setTokenState] = useState(() => getToken());
  const [userEmail, setUserEmail] = useState(profile.email);
  const [listing, setListing] = useState<ListingDraft | null>(null);
  const [offers, setOffers] = useState<OfferInput[]>([]);
  const [showings, setShowings] = useState<ShowingRequest[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState("setup");
  const [status, setStatus] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const checklist = getChecklist(profile);
  const percent = getCompletionPercent(profile);
  const completed = checklist.filter((item) => profile.completedTaskIds.includes(item.id)).length;

  async function loadWorkspace() {
    if (!getToken()) return;
    try {
      const result = await apiJson<WorkspacePayload>("/api/workspace");
      setProfile(result.profile);
      setListing(result.listing);
      setOffers(result.offers || []);
      setShowings(result.showings || []);
      setDocuments(result.documents || []);
      setPayments(result.payments || []);
      setStatus("Workspace synced.");
    } catch (error) {
      clearToken();
      setTokenState("");
      setStatus(error instanceof Error ? error.message : "Session expired.");
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  async function saveProfile(nextProfile = profile) {
    setSavingProfile(true);
    setProfile(nextProfile);
    try {
      const result = await apiJson<{ profile: SellerProfile }>("/api/profile", { method: "PUT", body: JSON.stringify(nextProfile) });
      setProfile(result.profile);
      setStatus("Profile saved to server.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile saved locally only.");
    } finally {
      setSavingProfile(false);
    }
  }

  function toggleTask(id: string) {
    const exists = profile.completedTaskIds.includes(id);
    const next = { ...profile, completedTaskIds: exists ? profile.completedTaskIds.filter((taskId) => taskId !== id) : [...profile.completedTaskIds, id] };
    saveProfile(next);
  }

  async function saveListing(nextListing: ListingDraft) {
    try {
      const result = await apiJson<{ listing: ListingDraft }>("/api/listing", { method: "PUT", body: JSON.stringify(nextListing) });
      setListing(result.listing);
      setStatus("Listing saved.");
    } catch (error) {
      setListing(nextListing);
      setStatus(error instanceof Error ? error.message : "Listing saved locally only.");
    }
  }

  async function createOffer(offer: OfferInput) {
    try {
      const result = await apiJson<{ offer: OfferInput }>("/api/offers", { method: "POST", body: JSON.stringify(offer) });
      setOffers((current) => [result.offer, ...current]);
      setStatus("Offer saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Offer could not be saved.");
    }
  }

  async function deleteOffer(id: string) {
    await apiJson(`/api/offers/${id}`, { method: "DELETE" });
    setOffers((current) => current.filter((offer) => offer.id !== id));
  }

  async function createShowing(showing: ShowingRequest) {
    const result = await apiJson<{ showing: ShowingRequest }>("/api/showings", { method: "POST", body: JSON.stringify(showing) });
    setShowings((current) => [result.showing, ...current]);
  }

  async function updateShowing(showing: ShowingRequest) {
    if (!showing.id) return;
    const result = await apiJson<{ showing: ShowingRequest }>(`/api/showings/${showing.id}`, { method: "PUT", body: JSON.stringify(showing) });
    setShowings((current) => current.map((item) => item.id === showing.id ? result.showing : item));
  }

  async function uploadDocument(name: string, category: string, file: File) {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("category", category);
    formData.set("file", file);
    const result = await apiUpload<{ document: StoredDocument }>("/api/documents", formData);
    setDocuments((current) => [result.document, ...current]);
  }

  async function deleteDocument(id: string) {
    await apiJson(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  }


  async function startCheckout(planId: string) {
    setStatus("Preparing checkout...");
    try {
      const result = await apiJson<{ mock: boolean; checkoutUrl: string | null; payment?: PaymentRecord; message?: string }>("/api/checkout/session", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      if (result.mock && result.payment) {
        setPayments((current) => [result.payment!, ...current]);
        setStatus(result.message || "Mock payment recorded for local testing.");
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout could not be started.");
    }
  }

  function handleAuth(newToken: string, nextProfile: SellerProfile, email: string) {
    setTokenState(newToken);
    setUserEmail(email);
    setProfile({ ...nextProfile, address: profile.address || nextProfile.address });
  }

  if (!token) {
    return <AuthPanel onAuth={handleAuth} />;
  }

  return (
    <>
      <PageHero eyebrow="Seller dashboard" title="Your pilot-ready selling workspace." body="This is now a real local account workspace with saved profile data, listing copy, pricing strategy, offers, showings, documents, and an operator console." />
      <section className="section workspace-shell">
        <div className="workspace-summary">
          <div><span className="mini-label">Signed in as {userEmail || profile.email}</span><h3>{profile.address || "No property address yet"}</h3></div>
          <div className="summary-stat"><strong>{percent}%</strong><span>{completed}/{checklist.length} checklist tasks</span></div>
          <button className="text-button danger" onClick={() => { clearToken(); setTokenState(""); }}>Sign out</button>
        </div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        {status && <p className="form-message queued">{status}</p>}
        <div className="workspace-tabs">
          {["setup", "listing", "pricing", "offers", "showings", "documents", "billing", "admin"].map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        {activeTab === "setup" && <div className="app-grid"><ProfileEditor profile={profile} onProfileChange={setProfile} onSave={() => saveProfile()} saving={savingProfile} /><ChecklistWorkspace profile={profile} onToggleTask={toggleTask} /></div>}
        {activeTab === "listing" && <ListingBuilder profile={profile} listing={listing} onSave={saveListing} />}
        {activeTab === "pricing" && <PricingPlanner profile={profile} />}
        {activeTab === "offers" && <OffersWorkspace offers={offers} onCreate={createOffer} onDelete={deleteOffer} />}
        {activeTab === "showings" && <ShowingsWorkspace showings={showings} onCreate={createShowing} onUpdate={updateShowing} />}
        {activeTab === "documents" && <DocumentVault documents={documents} onUpload={uploadDocument} onDelete={deleteDocument} />}
        {activeTab === "billing" && <BillingWorkspace payments={payments} onCheckout={startCheckout} />}
        {activeTab === "admin" && <AdminConsole />}
      </section>
    </>
  );
}

function Footer() {
  return (
    <footer>
      <Link className="brand" to="/" aria-label="HomePilot home">
        <span className="brand-mark"><Home size={18} /></span>
        <span>HomePilot</span>
      </Link>
      <p>Guided home-selling software. Educational support, not legal advice. Expert partners where required.</p>
    </footer>
  );
}

function AppShell() {
  const [profile, setProfile] = useSellerProfile();

  return (
    <main>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage profile={profile} setProfile={setProfile} />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage profile={profile} setProfile={setProfile} />} />
        <Route path="/savings-calculator" element={<SavingsPage />} />
        <Route path="/states/florida" element={<FloridaStatePage profile={profile} />} />
        <Route path="/app" element={<DashboardPage profile={profile} setProfile={setProfile} />} />
        <Route path="*" element={<HomePage profile={profile} setProfile={setProfile} />} />
      </Routes>
      <Footer />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>,
);
