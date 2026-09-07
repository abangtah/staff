const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = 'super-secret-key'; // In prod, use environment variable

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (!bcrypt.compareSync(password, user.password)) {
     return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isActive) {
     return res.status(403).json({ error: 'Account disabled' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, department: user.department }, JWT_SECRET);
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
});

app.post('/api/users', (req, res) => {
  const { id, email, password, fullName, staffId, department, role, profileImage } = req.body;
  
  const exists = db.prepare('SELECT * FROM users WHERE email = ? OR staffId = ?').get(email, staffId);
  if (exists) return res.status(400).json({ error: 'Email or Staff ID already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO users (id, email, password, fullName, staffId, department, role, profileImage, createdAt, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, hash, fullName, staffId, department, role, profileImage, now, 1);
    
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', authenticateToken, (req, res) => {
  const users = db.prepare('SELECT id, email, fullName, staffId, department, role, isActive, profileImage, certificates FROM users').all();
  res.json(users);
});

app.get('/api/users/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, fullName, staffId, department, role, isActive, profileImage, certificates FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.get('/api/departments', (req, res) => {
  const depts = db.prepare('SELECT name FROM departments').all().map(d => d.name);
  res.json(depts);
});

app.get('/api/sessions', authenticateToken, (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY createdAt DESC').all();
  res.json(sessions);
});

app.post('/api/sessions', authenticateToken, (req, res) => {
  if (req.user.role !== 'HOD') return res.status(403).json({ error: 'Forbidden' });
  
  const { id, name } = req.body;
  
  db.prepare("UPDATE sessions SET status = 'Closed', closedAt = ? WHERE status = 'Open'").run(new Date().toISOString());

  try {
    db.prepare('INSERT INTO sessions (id, name, status, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, 'Open', req.user.id, new Date().toISOString());
    res.status(201).json({ message: 'Session created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/close-active', authenticateToken, (req, res) => {
  if (req.user.role !== 'HOD') return res.status(403).json({ error: 'Forbidden' });
  db.prepare("UPDATE sessions SET status = 'Closed', closedAt = ? WHERE status = 'Open'").run(new Date().toISOString());
  res.json({ message: 'Active session closed' });
});

app.get('/api/applications', authenticateToken, (req, res) => {
  const apps = db.prepare('SELECT * FROM applications').all();
  apps.forEach(a => {
     try { a.certificates = JSON.parse(a.certificates); } catch (e) { a.certificates = []; }
  });
  res.json(apps);
});

app.post('/api/applications', authenticateToken, (req, res) => {
  const { id, sessionId, sessionName, department, type, details, certificates } = req.body;
  db.prepare('INSERT INTO applications (id, staffId, sessionId, sessionName, department, type, details, certificates, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, sessionId, sessionName, department, type, details, JSON.stringify(certificates || []), new Date().toISOString(), 'Pending');
  res.status(201).json({ message: 'Application submitted' });
});

app.put('/api/applications/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'HOD') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE applications SET status = ?, reviewedBy = ?, reviewedDate = ? WHERE id = ?')
    .run(req.body.status, req.user.id, new Date().toISOString(), req.params.id);
  res.json({ message: 'Status updated' });
});

app.get('/api/evaluations', authenticateToken, (req, res) => {
  const evals = db.prepare('SELECT * FROM evaluations').all();
  evals.forEach(e => {
     try { e.scores = JSON.parse(e.scores); } catch (e) {}
  });
  res.json(evals);
});

app.post('/api/evaluations', authenticateToken, (req, res) => {
  const { id, sessionId, sessionName, staffId, department, scores, totalRaw, totalScore, comments } = req.body;
  db.prepare(`
    INSERT INTO evaluations (id, sessionId, sessionName, staffId, department, evaluatorId, evaluatorRole, scores, totalRaw, totalScore, comments, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, sessionName, staffId, department, req.user.id, req.user.role, JSON.stringify(scores), totalRaw, totalScore, comments, new Date().toISOString());
  res.status(201).json({ message: 'Evaluation submitted' });
});

app.get('/api/hodReviews', authenticateToken, (req, res) => {
  const reviews = db.prepare('SELECT * FROM hodReviews').all();
  res.json(reviews);
});

app.post('/api/hodReviews', authenticateToken, (req, res) => {
  const { id, sessionId, sessionName, staffId, department, recommendation, comments } = req.body;
  db.prepare(`
    INSERT INTO hodReviews (id, sessionId, sessionName, staffId, department, evaluatorId, recommendation, comments, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, sessionName, staffId, department, req.user.id, recommendation, comments, new Date().toISOString());
  res.status(201).json({ message: 'Review submitted' });
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY date DESC').all(req.user.id);
  res.json(notifications);
});

app.post('/api/notifications', authenticateToken, (req, res) => {
  const { id, userId, message, type, link } = req.body;
  db.prepare('INSERT INTO notifications (id, userId, message, type, date, link) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, message, type || 'info', new Date().toISOString(), link);
  res.status(201).json({ message: 'Notification created' });
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE userId = ?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
