/* ==========================================================================
   GROW WING — Backend Server
   Node.js built-in SQLite + Nodemailer + Projects CRUD
   Run: node --experimental-sqlite server.js
   Website: http://localhost:3000
   Admin:   http://localhost:3000/admin
   ========================================================================== */

'use strict';

const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');
const { DatabaseSync } = require('node:sqlite');

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}

const PORT           = process.env.PORT            || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME   || 'anson';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD   || 'no1promotion';
const JWT_SECRET     = process.env.JWT_SECRET       || 'GrowWing_JWT_Secret_2026_SecureKey';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL      || 'growwingpromotions@gmail.com';
const GMAIL_USER     = process.env.GMAIL_USER       || '';
const GMAIL_PASS     = process.env.GMAIL_APP_PASSWORD || '';

// ── SQLite Database ────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'growwing.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name      TEXT    NOT NULL,
    email          TEXT    NOT NULL,
    brand_name     TEXT    NOT NULL,
    contact_number TEXT    DEFAULT '',
    service_type   TEXT    NOT NULL,
    message        TEXT    DEFAULT '',
    status         TEXT    DEFAULT 'new',
    created_at     TEXT    DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'branding',
    description TEXT    DEFAULT '',
    image_url   TEXT    DEFAULT '',
    metric_tag  TEXT    DEFAULT '',
    metric_num  TEXT    DEFAULT '',
    is_active   INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS admin_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    action    TEXT NOT NULL,
    detail    TEXT DEFAULT '',
    logged_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
  );
`);

// Add contact_number column if it doesn't exist (migration for existing DBs)
try {
  db.exec(`ALTER TABLE leads ADD COLUMN contact_number TEXT DEFAULT ''`);
} catch { /* column already exists */ }

// ── Seed sample projects (only if table is empty) ──────────────────────────
const projectCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
if (projectCount === 0) {
  const ins = db.prepare(`
    INSERT INTO projects (title, category, description, image_url, metric_tag, metric_num, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    ['Aurélia Organics',        'branding', 'Complete luxury cosmetic brand creation, typography packaging, and nationwide retail rollout campaign.',                                          'images/portfolio-1.jpg', 'Performance',  '+420% Annual Sales',     1],
    ['CyberLux Global Launch',  'paid',     'High-impact 3D curved digital billboard advertising and companion social network advertising blitz.',                                             'images/portfolio-2.jpg', 'Global Reach', '18.4M Impressions',      2],
    ['Viral Creator Growth Engine', 'social','Multi-platform social media marketing services resulting in explosive brand awareness and direct-to-consumer revenue.',                           'images/portfolio-3.jpg', 'Community',    '+850K Followers',        3],
    ['Apex Motors: Night Drive', 'video',   'Cinematic studio commercial filmed with ARRI optics for digital and television distribution.',                                                   'images/portfolio-4.jpg', 'Recognition',  'Best Automotive Ad',     4],
    ['FinEdge Scale Acceleration','paid',   'Omni-channel digital marketing social media marketing strategy achieving aggressive customer acquisition.',                                       'images/portfolio-5.jpg', 'Efficiency',   '5.4x Blended ROAS',      5],
    ['NovaTech Brand Overhaul',  'branding','Strategic repositioning and corporate identity restructuring for an enterprise B2B cloud leader.',                                               'images/portfolio-6.jpg', 'Pipeline',     '+310% Qualified Leads',  6],
  ].forEach(p => ins.run(...p));
  console.log('✅ Sample projects seeded into database.');
}

console.log(`✅ Database ready: ${DB_PATH}`);

// ── Nodemailer Email Transporter ───────────────────────────────────────────
let emailTransporter = null;

if (GMAIL_USER && GMAIL_PASS && !GMAIL_PASS.includes('your_16_char')) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });
  emailTransporter.verify((err) => {
    if (err) {
      console.warn('⚠️  Email transporter error:', err.message);
      emailTransporter = null;
    } else {
      console.log('✅ Gmail email transporter ready →', GMAIL_USER);
    }
  });
} else {
  console.warn('⚠️  Email not configured. Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to enable email notifications.');
}

// ── Send lead notification email ───────────────────────────────────────────
async function sendLeadEmail(lead) {
  if (!emailTransporter) return;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#f5f4f0; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrap { max-width:600px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#0d0d0f; padding:32px 40px; text-align:center; }
  .header h1 { color:#C9A86C; margin:0; font-size:24px; letter-spacing:3px; }
  .header p  { color:#8a8799; margin:6px 0 0; font-size:12px; letter-spacing:2px; text-transform:uppercase; }
  .badge { display:inline-block; background:#C9A86C; color:#0d0d0f; font-weight:700; font-size:12px; padding:6px 18px; border-radius:20px; margin:20px 0 0; letter-spacing:1px; }
  .body { padding:36px 40px; }
  .intro { font-size:15px; color:#333; margin-bottom:28px; line-height:1.6; }
  .field { margin-bottom:20px; }
  .field-label { font-size:11px; font-weight:700; color:#C9A86C; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px; }
  .field-value { font-size:15px; color:#1a1a1a; background:#f8f7f4; border-left:3px solid #C9A86C; padding:10px 16px; border-radius:0 8px 8px 0; }
  .divider { height:1px; background:#e8e6e1; margin:28px 0; }
  .cta { text-align:center; margin:28px 0; }
  .cta a { display:inline-block; background:#0d0d0f; color:#C9A86C; text-decoration:none; padding:14px 36px; border-radius:8px; font-weight:700; font-size:14px; letter-spacing:1px; }
  .footer { background:#f8f7f4; padding:24px 40px; text-align:center; border-top:1px solid #e8e6e1; }
  .footer p { color:#8a8799; font-size:12px; margin:4px 0; }
  .footer strong { color:#C9A86C; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>GROW WING</h1>
    <p>Your Brand, Our Creation</p>
    <div class="badge">🔔 New Lead Inquiry</div>
  </div>

  <div class="body">
    <p class="intro">
      A new proposal request has been submitted through your website contact form.
      Here are the full details:
    </p>

    <div class="field">
      <div class="field-label">👤 Full Name</div>
      <div class="field-value">${lead.full_name}</div>
    </div>
    <div class="field">
      <div class="field-label">📧 Business Email</div>
      <div class="field-value">${lead.email}</div>
    </div>
    <div class="field">
      <div class="field-label">🏢 Company / Brand</div>
      <div class="field-value">${lead.brand_name}</div>
    </div>
    <div class="field">
      <div class="field-label">📞 Contact Number</div>
      <div class="field-value">${lead.contact_number || 'Not provided'}</div>
    </div>
    <div class="field">
      <div class="field-label">🎯 Service Needed</div>
      <div class="field-value">${lead.service_type}</div>
    </div>
    <div class="field">
      <div class="field-label">💬 Message / Description</div>
      <div class="field-value" style="white-space:pre-wrap;">${lead.message || 'No message provided.'}</div>
    </div>

    <div class="divider"></div>

    <div class="cta">
      <a href="http://localhost:${PORT}/admin" target="_blank">Open Admin Dashboard →</a>
    </div>
  </div>

  <div class="footer">
    <p>This notification was sent automatically from your GROW WING website.</p>
    <p>Lead ID: <strong>#${lead.id}</strong> &nbsp;|&nbsp; Received: <strong>${lead.created_at}</strong></p>
    <p style="margin-top:12px; font-size:11px;">© GROW WING Advertising & Marketing Agency</p>
  </div>
</div>
</body>
</html>`;

  await emailTransporter.sendMail({
    from:    `"GROW WING Website" <${GMAIL_USER}>`,
    to:      ADMIN_EMAIL,
    subject: `🔔 New Lead: ${lead.full_name} — ${lead.brand_name} [${lead.service_type}]`,
    html
  });

  console.log(`📧 Lead notification email sent to ${ADMIN_EMAIL}`);
}

// ── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ── JWT Auth Middleware ────────────────────────────────────────────────────
function authRequired(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Unauthorized — no token.' });
  try {
    req.admin = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized — invalid/expired token.' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════

// POST /api/contact — save lead + send email
app.post('/api/contact', async (req, res) => {
  const { fullName, workEmail, brandName, contactNumber, serviceType, projectNotes } = req.body;

  if (!fullName || !workEmail || !brandName || !serviceType) {
    return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  const result = db.prepare(`
    INSERT INTO leads (full_name, email, brand_name, contact_number, service_type, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    fullName.trim(),
    workEmail.trim().toLowerCase(),
    brandName.trim(),
    (contactNumber || '').trim(),
    serviceType,
    (projectNotes || '').trim()
  );

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);

  db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
    .run('NEW_LEAD', `Lead #${result.lastInsertRowid} — ${fullName} (${workEmail}) — ${serviceType}`);

  console.log(`✅ New Lead #${result.lastInsertRowid}: ${fullName} | ${workEmail} | ${contactNumber || 'no phone'}`);

  // Send email asynchronously (don't block response)
  sendLeadEmail(lead).catch(err => console.warn('Email send failed:', err.message));

  return res.json({
    success: true,
    message: `Thank you, ${fullName}! Your inquiry for ${brandName} has been received. Our team will contact you at ${workEmail} within 24 hours.`,
    id: result.lastInsertRowid
  });
});

// GET /api/projects — public: fetch active projects for website portfolio
app.get('/api/projects', (req, res) => {
  const projects = db.prepare(`
    SELECT * FROM projects WHERE is_active = 1 ORDER BY sort_order ASC, id ASC
  `).all();
  return res.json({ success: true, projects });
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════════════════════════════════

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
      .run('ADMIN_LOGIN', `Admin "${username}" signed in.`);
    return res.json({ success: true, token, username });
  }
  return res.status(401).json({ success: false, message: 'Invalid username or password.' });
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — LEADS
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', authRequired, (req, res) => {
  const total     = db.prepare(`SELECT COUNT(*) AS c FROM leads`).get().c;
  const newLeads  = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE status='new'`).get().c;
  const contacted = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE status='contacted'`).get().c;
  const closed    = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE status='closed'`).get().c;
  const today     = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at)=DATE('now','localtime')`).get().c;
  const thisWeek  = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at>=datetime('now','localtime','-7 days')`).get().c;
  const byService = db.prepare(`SELECT service_type AS label, COUNT(*) AS count FROM leads GROUP BY service_type ORDER BY count DESC`).all();
  const recent    = db.prepare(`SELECT id, full_name, email, brand_name, service_type, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5`).all();
  return res.json({ success: true, stats: { total, newLeads, contacted, closed, today, thisWeek, byService, recent } });
});

app.get('/api/admin/leads', authRequired, (req, res) => {
  const { status, service, search } = req.query;
  let q = `SELECT * FROM leads WHERE 1=1`;
  const args = [];
  if (status && status !== 'all')  { q += ` AND status = ?`;        args.push(status); }
  if (service && service !== 'all'){ q += ` AND service_type = ?`;  args.push(service); }
  if (search) {
    q += ` AND (full_name LIKE ? OR email LIKE ? OR brand_name LIKE ? OR contact_number LIKE ?)`;
    const s = `%${search}%`; args.push(s, s, s, s);
  }
  q += ` ORDER BY created_at DESC`;
  const leads = db.prepare(q).all(...args);
  return res.json({ success: true, leads, total: leads.length });
});

app.patch('/api/admin/leads/:id/status', authRequired, (req, res) => {
  const valid = ['new', 'contacted', 'closed', 'spam'];
  if (!valid.includes(req.body.status))
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  db.prepare(`UPDATE leads SET status = ? WHERE id = ?`).run(req.body.status, req.params.id);
  return res.json({ success: true });
});

app.delete('/api/admin/leads/:id', authRequired, (req, res) => {
  const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
  db.prepare(`DELETE FROM leads WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
    .run('DELETE_LEAD', `Deleted Lead #${req.params.id} — ${lead.full_name}`);
  return res.json({ success: true });
});

app.get('/api/admin/export', authRequired, (req, res) => {
  const leads  = db.prepare(`SELECT * FROM leads ORDER BY created_at DESC`).all();
  const header = ['ID', 'Full Name', 'Email', 'Brand', 'Contact Number', 'Service', 'Message', 'Status', 'Date'];
  const rows   = leads.map(l => [
    l.id, `"${l.full_name}"`, l.email, `"${l.brand_name}"`,
    l.contact_number || '', `"${l.service_type}"`,
    `"${(l.message || '').replace(/"/g, "'")}"`, l.status, l.created_at
  ].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="growwing_leads_${Date.now()}.csv"`);
  return res.send([header.join(','), ...rows].join('\r\n'));
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — PROJECTS CRUD
// ══════════════════════════════════════════════════════════════════════════

// GET all projects (admin view — includes inactive)
app.get('/api/admin/projects', authRequired, (req, res) => {
  const projects = db.prepare(`SELECT * FROM projects ORDER BY sort_order ASC, id ASC`).all();
  return res.json({ success: true, projects });
});

// POST — add new project
app.post('/api/admin/projects', authRequired, (req, res) => {
  const { title, category, description, image_url, metric_tag, metric_num, sort_order, is_active } = req.body;
  if (!title || !category)
    return res.status(400).json({ success: false, message: 'Title and category are required.' });

  const result = db.prepare(`
    INSERT INTO projects (title, category, description, image_url, metric_tag, metric_num, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(), category,
    (description || '').trim(), (image_url || '').trim(),
    (metric_tag || '').trim(),  (metric_num || '').trim(),
    parseInt(sort_order) || 0,  is_active === false ? 0 : 1
  );

  db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
    .run('ADD_PROJECT', `Added project #${result.lastInsertRowid}: "${title}"`);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  return res.json({ success: true, project });
});

// PUT — edit project
app.put('/api/admin/projects/:id', authRequired, (req, res) => {
  const { title, category, description, image_url, metric_tag, metric_num, sort_order, is_active } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });

  db.prepare(`
    UPDATE projects SET title=?, category=?, description=?, image_url=?,
    metric_tag=?, metric_num=?, sort_order=?, is_active=? WHERE id=?
  `).run(
    (title || existing.title).trim(),
    category || existing.category,
    (description !== undefined ? description : existing.description).trim(),
    (image_url  !== undefined ? image_url  : existing.image_url).trim(),
    (metric_tag !== undefined ? metric_tag : existing.metric_tag).trim(),
    (metric_num !== undefined ? metric_num : existing.metric_num).trim(),
    parseInt(sort_order) >= 0 ? parseInt(sort_order) : existing.sort_order,
    is_active === false ? 0 : 1,
    req.params.id
  );

  db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
    .run('EDIT_PROJECT', `Edited project #${req.params.id}: "${title || existing.title}"`);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  return res.json({ success: true, project: updated });
});

// DELETE — remove project
app.delete('/api/admin/projects/:id', authRequired, (req, res) => {
  const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!proj) return res.status(404).json({ success: false, message: 'Project not found.' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO admin_log (action, detail) VALUES (?, ?)`)
    .run('DELETE_PROJECT', `Deleted project #${req.params.id}: "${proj.title}"`);
  return res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — ACTIVITY LOG
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/admin/log', authRequired, (req, res) => {
  const logs = db.prepare(`SELECT * FROM admin_log ORDER BY logged_at DESC LIMIT 50`).all();
  return res.json({ success: true, logs });
});

// ── Serve Admin Dashboard ──────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       GROW WING — Server is Running!         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  🌐 Website  →  http://localhost:${PORT}           ║`);
  console.log(`║  📊 Admin    →  http://localhost:${PORT}/admin      ║`);
  console.log(`║  🗄️  Database →  growwing.db (SQLite)          ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Admin credentials: ${ADMIN_USERNAME} / (see .env)`);
  console.log(`  Email alerts  →  ${emailTransporter ? ADMIN_EMAIL : 'NOT CONFIGURED (see .env)'}`);
  console.log('');
});
