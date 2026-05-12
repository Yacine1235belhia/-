// @ts-nocheck
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const { sign, verify } = jwt;
import path from "path";
import fs from "fs";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), "database.sqlite");
const db = new Database(dbPath);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

// Setup database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    seniority INTEGER,
    email TEXT,
    totalHours INTEGER DEFAULT 0,
    availabilityExceptions TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    period TEXT NOT NULL,
    duration INTEGER NOT NULL,
    hallCount INTEGER NOT NULL,
    proctorsPerHall INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    examId TEXT NOT NULL,
    hallId TEXT NOT NULL,
    teacherId TEXT NOT NULL,
    date TEXT NOT NULL,
    period TEXT NOT NULL
  );
`);

// Insert default an admin user if not exists
const checkUser = db.prepare("SELECT * FROM accounts WHERE username = ?").get("admin");
if (!checkUser) {
  const hash = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT INTO accounts (username, password, role) VALUES (?, ?, ?)").run("admin", hash, "مدير");
}

// Authentication Middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES
  
  // Auth
  app.post("/api/register", (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const checkUser = db.prepare("SELECT * FROM accounts WHERE username = ?").get(username);
    if (checkUser) {
      return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO accounts (username, password, role) VALUES (?, ?, ?)").run(username, hash, role);
    
    const user = db.prepare("SELECT * FROM accounts WHERE username = ?").get(username);
    const token = sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username, role: user.role });
  });

  app.post("/api/login", (req, res) => {
    console.log("Login request body:", JSON.stringify(req.body));
    const { username, password } = req.body;
    console.log(`Login attempt for: ${username}`);
    
    // Case-insensitive search
    const user = db.prepare("SELECT * FROM accounts WHERE LOWER(username) = LOWER(?)").get(username || "");
    
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      console.log(`Invalid password for: ${username}`);
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    console.log(`Login successful for: ${username}`);
    const token = sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username, role: user.role });
  });

  // Settings
  app.get("/api/settings", authenticateUser, (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: JSON.parse(row.value) }), {});
    res.json(settings);
  });
  
  app.post("/api/settings", authenticateUser, (req, res) => {
    const settings = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, JSON.stringify(value));
    }
    res.json({ success: true });
  });

  // Generic CRUD generator
  const createCrudRoutes = (tableName) => {
    app.get(`/api/${tableName}`, authenticateUser, (req, res) => {
      const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
      res.json(rows);
    });

    app.post(`/api/${tableName}`, authenticateUser, (req, res) => {
      const data = req.body;
      const keys = Object.keys(data);
      const values = keys.map(k => data[k]);
      
      const placeholders = keys.map(() => '?').join(',');
      const query = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;
      
      try {
        db.prepare(query).run(...values);
        res.status(201).json({ success: true, id: data.id });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.put(`/api/${tableName}/:id`, authenticateUser, (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data);
      const values = keys.map(k => data[k]);
      
      const setStatements = keys.map(k => `${k} = ?`).join(',');
      const query = `UPDATE ${tableName} SET ${setStatements} WHERE id = ?`;
      
      try {
        db.prepare(query).run(...values, id);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.delete(`/api/${tableName}/:id`, authenticateUser, (req, res) => {
      const { id } = req.params;
      try {
        db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  };

  createCrudRoutes('teachers');
  createCrudRoutes('halls');
  createCrudRoutes('exams');
  createCrudRoutes('assignments');

  // Clear data and seed
  app.post("/api/seed", authenticateUser, (req, res) => {
    try {
      db.exec("DELETE FROM teachers; DELETE FROM halls; DELETE FROM exams; DELETE FROM assignments;");
      
      const insertTeacher = db.prepare("INSERT INTO teachers (id, name, specialty, seniority, email, totalHours, availabilityExceptions) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const teacherFirstNames = ["أحمد", "محمد", "علي", "عمر", "حسن", "حسين", "طارق", "كريم", "ياسر", "خالد", "فاطمة", "زينب", "مريم", "سارة", "ليلى", "نورة", "هدى", "سمية", "عائشة", "لبنى"];
      const teacherLastNames = ["عبد الله", "عبد الرحمن", "محمد", "علي", "محمود", "إبراهيم", "صالح", "سعيد", "خليل", "سليمان", "منصور", "ناصر"];
      const specialties = ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية", "فلسفة", "تربية إسلامية", "إعلام آلي"];

      const teachers = [];
      for (let i = 1; i <= 30; i++) {
        const firstName = teacherFirstNames[i % teacherFirstNames.length];
        const lastName = teacherLastNames[i % teacherLastNames.length];
        const specialty = specialties[i % specialties.length];
        teachers.push([`t${i}`, `${firstName} ${lastName}`, specialty, (i % 15) + 1, `teacher${i}@example.com`, 0, "[]"]);
      }
      teachers.forEach(t => insertTeacher.run(t[0], t[1], t[2], t[3], t[4], t[5], t[6]));

      const insertHall = db.prepare("INSERT INTO halls (id, name, capacity) VALUES (?, ?, ?)");
      const halls = [];
      for (let i = 1; i <= 20; i++) {
        halls.push([`h${i}`, `القاعة ${i}`, 30]);
      }
      halls.forEach(h => insertHall.run(h[0], h[1], h[2]));

      const insertExam = db.prepare("INSERT INTO exams (id, subject, date, period, duration, hallCount, proctorsPerHall) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const subjects = ["رياضيات", "فيزياء", "علوم طبيعية", "لغة عربية", "تاريخ وجغرافيا", "لغة فرنسية", "لغة إنجليزية", "فلسفة", "تربية إسلامية", "تربية مدنية", "إعلام آلي", "اقتصاد", "هندسة مدنية", "تسيير مالي", "هندسة طرائق", "هندسة كهربائية", "قانون"];
      
      const exams = [];
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + (7 - baseDate.getDay()) % 7); // Next Sunday

      for (let i = 0; i < subjects.length; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + (i % 5)); // Spread across 5 days (Sunday to Thursday)
        const dateStr = date.toISOString().split('T')[0];
        const period = i % 2 === 0 ? "morning" : "afternoon";
        exams.push([`e${i+1}`, subjects[i], dateStr, period, 2, (i % 5) + 5, 2]); // between 5 and 9 halls
      }
      exams.forEach(e => insertExam.run(e[0], e[1], e[2], e[3], e[4], e[5], e[6]));

      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Clear data
  app.delete("/api/clear-all", authenticateUser, (req, res) => {
    try {
      db.exec("DELETE FROM teachers; DELETE FROM halls; DELETE FROM exams; DELETE FROM assignments;");
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note Express v4 style matching
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
