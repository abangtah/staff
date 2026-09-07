const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const db = new Database(path.join(__dirname, 'appraisal.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    fullName TEXT,
    role TEXT,
    department TEXT,
    staffId TEXT UNIQUE,
    createdAt TEXT,
    isActive INTEGER DEFAULT 1,
    certificates TEXT,
    bio TEXT,
    phone TEXT,
    profileImage TEXT,
    loginAttempts INTEGER DEFAULT 0,
    handoverCode TEXT
  );

  CREATE TABLE IF NOT EXISTS departments (
    name TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    status TEXT,
    createdBy TEXT,
    createdAt TEXT,
    closedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    staffId TEXT,
    sessionId TEXT,
    sessionName TEXT,
    department TEXT,
    type TEXT,
    details TEXT,
    certificates TEXT,
    date TEXT,
    status TEXT,
    reviewedBy TEXT,
    reviewedDate TEXT
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    sessionId TEXT,
    sessionName TEXT,
    staffId TEXT,
    department TEXT,
    evaluatorId TEXT,
    evaluatorRole TEXT,
    scores TEXT,
    totalRaw INTEGER,
    totalScore INTEGER,
    comments TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS hodReviews (
    id TEXT PRIMARY KEY,
    sessionId TEXT,
    sessionName TEXT,
    staffId TEXT,
    department TEXT,
    evaluatorId TEXT,
    recommendation TEXT,
    comments TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT,
    message TEXT,
    type TEXT,
    read INTEGER DEFAULT 0,
    date TEXT,
    link TEXT
  );
`);

// Seed Departments
const getDeptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get();
if (getDeptCount.count === 0) {
  const insertDept = db.prepare('INSERT INTO departments (name) VALUES (?)');
  const defaultDepts = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
    'Biology', 'Economics', 'Business Administration', 'Law',
    'Medicine', 'Engineering', 'Agriculture', 'Education'
  ];
  const insertManyDepts = db.transaction((depts) => {
    for (const dept of depts) insertDept.run(dept);
  });
  insertManyDepts(defaultDepts);
}

// Seed VC if not exists
const vcExists = db.prepare("SELECT * FROM users WHERE email = 'vc@university.edu'").get();
if (!vcExists) {
  const hash = bcrypt.hashSync('vc123456', 10);
  db.prepare(`
    INSERT INTO users (id, email, password, fullName, role, department, staffId, createdAt, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'STF/2026/001', 'vc@university.edu', hash, 'Vice Chancellor', 'VC', 'Administration', 'VC001', new Date().toISOString(), 1
  );
}

// Seed default users if not exists
const defaultUsers = [
  { id: 'STF/2026/002', email: 'hod@university.edu', password: 'hod123456', fullName: 'Dr. John HOD', role: 'HOD', department: 'Computer Science', staffId: 'HOD001' },
  { id: 'STF/2026/003', email: 'lecturer@university.edu', password: 'lec123456', fullName: 'Jane Lecturer', role: 'Lecturer', department: 'Computer Science', staffId: 'LEC001' },
  { id: 'STF/2026/004', email: 'student@university.edu', password: 'stu123456', fullName: 'Alice Student', role: 'Student', department: 'Computer Science', staffId: 'STU001' }
];

const insertUser = db.prepare(`
  INSERT INTO users (id, email, password, fullName, role, department, staffId, createdAt, isActive)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const du of defaultUsers) {
  const exists = db.prepare('SELECT * FROM users WHERE email = ?').get(du.email);
  if (!exists) {
    const hash = bcrypt.hashSync(du.password, 10);
    insertUser.run(du.id, du.email, hash, du.fullName, du.role, du.department, du.staffId, new Date().toISOString(), 1);
  }
}

module.exports = db;
