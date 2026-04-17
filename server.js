const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const apiOnly = process.argv.includes("--api-only");
const port = Number(process.env.PORT || 8787);
const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || "data");
const uploadsDir = path.join(dataDir, "uploads");
const dbFile = path.join(dataDir, "homepilot-db.json");
const leadsFile = path.resolve(process.cwd(), process.env.LEADS_FILE || path.join(dataDir, "leads.jsonl"));
const adminToken = process.env.ADMIN_TOKEN || "dev-admin-token";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || "";
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const isVercel = Boolean(process.env.VERCEL);
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } }) : null;
const dataMode = supabase ? "supabase-app-state" : "local-json";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" }) : null;

const paymentPlans = {
  starter: { id: "starter", name: "Starter", amount: 29900, description: "Sale checklist, net proceeds calculator, and document vault.", envPriceKey: "STRIPE_PRICE_STARTER" },
  launch: { id: "launch", name: "Launch", amount: 89900, description: "Listing builder, pricing guidance, showing scheduler, offer comparison, and seller checklist.", envPriceKey: "STRIPE_PRICE_LAUNCH" },
  guided: { id: "guided", name: "Guided Sale", amount: 179900, description: "Software plus concierge onboarding, partner handoffs, and closing timeline support.", envPriceKey: "STRIPE_PRICE_GUIDED" },
};

app.use(cors({ origin: true }));

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(200).json({ ok: true, skipped: "Stripe webhook not configured." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], stripeWebhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId || "launch";
    if (userId) {
      const db = await readDb();
      const payments = userScoped(db, "payments", userId);
      payments.unshift({
        id: crypto.randomUUID(),
        provider: "stripe",
        stripeSessionId: session.id,
        planId,
        status: "paid",
        amount: session.amount_total || paymentPlans[planId]?.amount || 0,
        currency: session.currency || "usd",
        createdAt: new Date().toISOString(),
      });
      await writeDb(db);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const defaultDb = {
  users: [],
  sessions: [],
  profiles: {},
  listings: {},
  offers: {},
  showings: {},
  documents: {},
  payments: {},
  tasks: [],
  leads: [],
};


function getReadinessReport() {
  const checks = [
    {
      key: "publicUrl",
      label: "Public app URL",
      status: Boolean(process.env.APP_URL),
      detail: process.env.APP_URL ? "APP_URL is configured." : "Set APP_URL to the production Vercel URL or custom domain.",
    },
    {
      key: "database",
      label: "Durable database",
      status: Boolean(supabase),
      detail: supabase ? "Supabase app_state persistence is active." : "Local JSON storage is active. Use Supabase before real customer data.",
    },
    {
      key: "storage",
      label: "Durable document storage",
      status: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET),
      detail: process.env.SUPABASE_STORAGE_BUCKET ? "Storage bucket is configured." : "Set SUPABASE_STORAGE_BUCKET and replace local upload storage before real documents.",
    },
    {
      key: "adminToken",
      label: "Admin token",
      status: Boolean(process.env.ADMIN_TOKEN) && process.env.ADMIN_TOKEN !== "dev-admin-token",
      detail: process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN !== "dev-admin-token" ? "ADMIN_TOKEN is customized." : "Replace the development admin token.",
    },
    {
      key: "stripe",
      label: "Stripe checkout",
      status: Boolean(stripeSecretKey && stripeWebhookSecret),
      detail: stripeSecretKey && stripeWebhookSecret ? "Stripe secret and webhook secret are configured." : "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET for real checkout.",
    },
    {
      key: "email",
      label: "Lead notification email",
      status: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.LEADS_TO),
      detail: process.env.SMTP_HOST ? "SMTP variables are partially or fully configured." : "Set SMTP variables to receive lead notifications.",
    },
    {
      key: "legalReview",
      label: "Attorney-reviewed legal content",
      status: process.env.LEGAL_REVIEW_COMPLETE === "true",
      detail: process.env.LEGAL_REVIEW_COMPLETE === "true" ? "LEGAL_REVIEW_COMPLETE is marked true." : "Complete attorney review before charging real sellers.",
    },
  ];

  return {
    ok: true,
    environment: isVercel ? "vercel" : "local",
    dataMode,
    readyForRealCustomers: checks.every((check) => check.status),
    checks,
  };
}

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDb, null, 2), "utf8");
  }
}

function mergeDb(value) {
  return {
    ...structuredClone(defaultDb),
    ...(value || {}),
    profiles: value?.profiles || {},
    listings: value?.listings || {},
    offers: value?.offers || {},
    showings: value?.showings || {},
    documents: value?.documents || {},
    payments: value?.payments || {},
    leads: value?.leads || [],
    sessions: value?.sessions || [],
    users: value?.users || [],
  };
}

async function readDb() {
  if (supabase) {
    const { data, error } = await supabase.from("app_state").select("value").eq("key", "default").maybeSingle();
    if (error) throw error;
    return mergeDb(data?.value);
  }

  ensureDataFiles();
  try {
    return mergeDb(JSON.parse(fs.readFileSync(dbFile, "utf8")));
  } catch {
    return structuredClone(defaultDb);
  }
}

async function writeDb(db) {
  if (supabase) {
    const { error } = await supabase.from("app_state").upsert({ key: "default", value: db, updated_at: new Date().toISOString() });
    if (error) throw error;
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const tempFile = `${dbFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tempFile, dbFile);
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function createDefaultProfile(email = "") {
  return {
    address: "",
    email,
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
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function requireUser(req, res, next) {
  const token = getToken(req);
  const db = await readDb();
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > new Date().toISOString());
  if (!session) {
    return res.status(401).json({ ok: false, message: "Please sign in again." });
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) {
    return res.status(401).json({ ok: false, message: "User not found." });
  }
  req.db = db;
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  if (req.headers["x-admin-token"] !== adminToken) {
    return res.status(401).json({ ok: false, message: "Admin token required." });
  }
  req.db = await readDb();
  next();
}

function sanitizeLead(input) {
  const clean = {
    id: crypto.randomUUID(),
    address: String(input.address || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    state: String(input.state || "").trim(),
    timeline: String(input.timeline || "").trim(),
    propertyType: String(input.propertyType || "").trim(),
    estimatedPrice: Number(input.estimatedPrice || 0),
    source: String(input.source || "website").trim(),
    createdAt: new Date().toISOString(),
  };

  if (!clean.address || clean.address.length < 6) throw new Error("Please enter a complete property address.");
  if (!/^\S+@\S+\.\S+$/.test(clean.email)) throw new Error("Please enter a valid email address.");
  return clean;
}

async function maybeSendLeadEmail(lead) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, LEADS_TO, LEADS_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !LEADS_TO) return { sent: false, reason: "SMTP not configured" };

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: LEADS_FROM || "HomePilot <leads@homepilot.local>",
    to: LEADS_TO,
    subject: `New HomePilot lead: ${lead.address}`,
    text: Object.entries(lead).map(([key, value]) => `${key}: ${value}`).join("\n"),
  });

  return { sent: true };
}

function userScoped(db, collection, userId) {
  if (!db[collection][userId]) db[collection][userId] = [];
  return db[collection][userId];
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiOnly, dbFile, leadsFile, uploadsDir, dataMode, isVercel });
});

app.get("/api/readiness", (_req, res) => {
  res.json(getReadinessReport());
});

app.post("/api/auth/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, message: "Enter a valid email." });
  if (password.length < 8) return res.status(400).json({ ok: false, message: "Password must be at least 8 characters." });

  const db = await readDb();
  if (db.users.some((user) => user.email === email)) return res.status(409).json({ ok: false, message: "Account already exists. Sign in instead." });

  const user = { id: crypto.randomUUID(), email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  const token = crypto.randomUUID();
  db.users.push(user);
  db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  db.profiles[user.id] = createDefaultProfile(email);
  await writeDb(db);

  res.status(201).json({ ok: true, token, user: publicUser(user), profile: db.profiles[user.id] });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = await readDb();
  const user = db.users.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ ok: false, message: "Email or password did not match." });

  const token = crypto.randomUUID();
  db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
  if (!db.profiles[user.id]) db.profiles[user.id] = createDefaultProfile(email);
  await writeDb(db);

  res.json({ ok: true, token, user: publicUser(user), profile: db.profiles[user.id] });
});

app.get("/api/me", requireUser, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user), profile: req.db.profiles[req.user.id] || createDefaultProfile(req.user.email) });
});

app.put("/api/profile", requireUser, async (req, res) => {
  const db = req.db;
  db.profiles[req.user.id] = { ...createDefaultProfile(req.user.email), ...db.profiles[req.user.id], ...req.body, email: req.user.email };
  await writeDb(db);
  res.json({ ok: true, profile: db.profiles[req.user.id] });
});

app.get("/api/workspace", requireUser, (req, res) => {
  const db = req.db;
  const userId = req.user.id;
  res.json({
    ok: true,
    profile: db.profiles[userId] || createDefaultProfile(req.user.email),
    listing: db.listings[userId] || null,
    offers: userScoped(db, "offers", userId),
    showings: userScoped(db, "showings", userId),
    documents: userScoped(db, "documents", userId),
    payments: userScoped(db, "payments", userId),
  });
});

app.put("/api/listing", requireUser, async (req, res) => {
  const db = req.db;
  db.listings[req.user.id] = { ...req.body, updatedAt: new Date().toISOString() };
  await writeDb(db);
  res.json({ ok: true, listing: db.listings[req.user.id] });
});

app.get("/api/offers", requireUser, (req, res) => {
  res.json({ ok: true, offers: userScoped(req.db, "offers", req.user.id) });
});

app.post("/api/offers", requireUser, async (req, res) => {
  const db = req.db;
  const offers = userScoped(db, "offers", req.user.id);
  const offer = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...req.body };
  offers.unshift(offer);
  await writeDb(db);
  res.status(201).json({ ok: true, offer });
});

app.put("/api/offers/:id", requireUser, async (req, res) => {
  const db = req.db;
  const offers = userScoped(db, "offers", req.user.id);
  const index = offers.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ ok: false, message: "Offer not found." });
  offers[index] = { ...offers[index], ...req.body, updatedAt: new Date().toISOString() };
  await writeDb(db);
  res.json({ ok: true, offer: offers[index] });
});

app.delete("/api/offers/:id", requireUser, async (req, res) => {
  const db = req.db;
  db.offers[req.user.id] = userScoped(db, "offers", req.user.id).filter((item) => item.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

app.get("/api/showings", requireUser, (req, res) => {
  res.json({ ok: true, showings: userScoped(req.db, "showings", req.user.id) });
});

app.post("/api/showings", requireUser, async (req, res) => {
  const db = req.db;
  const showings = userScoped(db, "showings", req.user.id);
  const showing = { id: crypto.randomUUID(), status: "Requested", createdAt: new Date().toISOString(), ...req.body };
  showings.unshift(showing);
  await writeDb(db);
  res.status(201).json({ ok: true, showing });
});

app.put("/api/showings/:id", requireUser, async (req, res) => {
  const db = req.db;
  const showings = userScoped(db, "showings", req.user.id);
  const index = showings.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ ok: false, message: "Showing not found." });
  showings[index] = { ...showings[index], ...req.body, updatedAt: new Date().toISOString() };
  await writeDb(db);
  res.json({ ok: true, showing: showings[index] });
});

app.post("/api/documents", requireUser, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "File required." });
  const db = await readDb();
  const docs = userScoped(db, "documents", req.user.id);
  const id = crypto.randomUUID();
  const safeName = req.file.originalname.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  let filename = `${Date.now()}-${id}-${safeName}`;
  let filePath = `/uploads/${filename}`;
  let storageProvider = "local";
  let storagePath = filename;
  let signedUrlExpiresAt = null;

  if (supabase && supabaseStorageBucket) {
    storageProvider = "supabase";
    storagePath = `${req.user.id}/${filename}`;
    const uploadResult = await supabase.storage.from(supabaseStorageBucket).upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (uploadResult.error) throw uploadResult.error;
    const signed = await supabase.storage.from(supabaseStorageBucket).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signed.error) throw signed.error;
    filePath = signed.data.signedUrl;
    signedUrlExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  } else {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
  }

  const doc = {
    id,
    name: req.body.name || req.file.originalname,
    category: req.body.category || "Other",
    originalName: req.file.originalname,
    filename,
    path: filePath,
    storageProvider,
    storageBucket: storageProvider === "supabase" ? supabaseStorageBucket : null,
    storagePath,
    signedUrlExpiresAt,
    size: req.file.size,
    mimeType: req.file.mimetype,
    createdAt: new Date().toISOString(),
  };
  docs.unshift(doc);
  await writeDb(db);
  res.status(201).json({ ok: true, document: doc });
});

app.delete("/api/documents/:id", requireUser, async (req, res) => {
  const db = req.db;
  const docs = userScoped(db, "documents", req.user.id);
  const doc = docs.find((item) => item.id === req.params.id);
  db.documents[req.user.id] = docs.filter((item) => item.id !== req.params.id);
  if (doc?.storageProvider === "supabase" && supabase && doc.storageBucket && doc.storagePath) {
    await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]);
  } else if (doc?.filename) {
    fs.rmSync(path.join(uploadsDir, doc.filename), { force: true });
  }
  await writeDb(db);
  res.json({ ok: true });
});


app.get("/api/billing/plans", (_req, res) => {
  res.json({ ok: true, plans: Object.values(paymentPlans).map(({ envPriceKey, ...plan }) => plan), stripeConfigured: Boolean(stripe) });
});

app.get("/api/billing/status", requireUser, (req, res) => {
  res.json({ ok: true, payments: userScoped(req.db, "payments", req.user.id), stripeConfigured: Boolean(stripe) });
});

app.post("/api/checkout/session", requireUser, async (req, res) => {
  const planId = String(req.body.planId || "launch");
  const plan = paymentPlans[planId];
  if (!plan) return res.status(400).json({ ok: false, message: "Unknown plan." });

  const db = req.db;
  const payments = userScoped(db, "payments", req.user.id);

  if (!stripe) {
    const payment = {
      id: crypto.randomUUID(),
      provider: "mock",
      planId,
      status: "paid",
      amount: plan.amount,
      currency: "usd",
      createdAt: new Date().toISOString(),
    };
    payments.unshift(payment);
    await writeDb(db);
    return res.json({ ok: true, mock: true, payment, checkoutUrl: null, message: "Stripe is not configured, so a mock paid checkout was recorded for local testing." });
  }

  const origin = req.get("origin") || appUrl;
  const configuredPrice = process.env[plan.envPriceKey];
  const lineItem = configuredPrice
    ? { price: configuredPrice, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.amount,
          product_data: { name: `HomePilot ${plan.name}`, description: plan.description },
        },
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    customer_email: req.user.email,
    success_url: `${origin}/app?checkout=success&plan=${planId}`,
    cancel_url: `${origin}/app?checkout=cancelled&plan=${planId}`,
    metadata: { userId: req.user.id, planId },
  });

  payments.unshift({
    id: crypto.randomUUID(),
    provider: "stripe",
    stripeSessionId: session.id,
    planId,
    status: "pending",
    amount: plan.amount,
    currency: "usd",
    checkoutUrl: session.url,
    createdAt: new Date().toISOString(),
  });
  await writeDb(db);

  res.json({ ok: true, mock: false, checkoutUrl: session.url });
});

app.post("/api/leads", async (req, res) => {
  try {
    const lead = sanitizeLead(req.body || {});
    fs.mkdirSync(path.dirname(leadsFile), { recursive: true });
    fs.appendFileSync(leadsFile, `${JSON.stringify(lead)}\n`, "utf8");
    const db = await readDb();
    db.leads.unshift(lead);
    await writeDb(db);
    const email = await maybeSendLeadEmail(lead);
    res.status(201).json({ ok: true, lead, email });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || "Lead could not be saved." });
  }
});

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  const db = req.db;
  const sellers = db.users.map((user) => ({
    user: publicUser(user),
    profile: db.profiles[user.id] || createDefaultProfile(user.email),
    listing: db.listings[user.id] || null,
    offers: userScoped(db, "offers", user.id),
    showings: userScoped(db, "showings", user.id),
    documents: userScoped(db, "documents", user.id),
    payments: userScoped(db, "payments", user.id),
  }));
  res.json({ ok: true, leads: db.leads || [], sellers });
});

if (!apiOnly) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

if (require.main === module) {
  app.listen(port, () => {
    const mode = apiOnly ? "API" : "web + API";
    console.log(`HomePilot ${mode} server running at http://localhost:${port}`);
  });
}

module.exports = app;
