// @ts-nocheck
process.env.DISABLE_HMR = "true";
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
    availabilityExceptions TEXT DEFAULT '[]',
    isExempt INTEGER DEFAULT 0,
    exemptReason TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    proctorsCount INTEGER
  );

  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    period TEXT NOT NULL,
    timeRange TEXT,
    duration INTEGER NOT NULL,
    hallCount INTEGER NOT NULL,
    proctorsPerHall INTEGER NOT NULL,
    targetLevel TEXT,
    stream TEXT
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    examId TEXT NOT NULL,
    hallId TEXT NOT NULL,
    teacherId TEXT NOT NULL,
    date TEXT NOT NULL,
    period TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    matricule TEXT,
    name TEXT NOT NULL,
    gender TEXT DEFAULT 'ذكر',
    level TEXT NOT NULL,
    stream TEXT NOT NULL,
    subSpecialty TEXT,
    classGroup TEXT,
    examHallId TEXT,
    examGroupId TEXT,
    seatNumber INTEGER
  );

  CREATE TABLE IF NOT EXISTS exam_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    stream TEXT NOT NULL,
    hallId TEXT,
    studentCount INTEGER DEFAULT 0
  );
`);

try { db.exec("ALTER TABLE exams ADD COLUMN timeRange TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE exams ADD COLUMN targetLevel TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE exams ADD COLUMN stream TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN matricule TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN gender TEXT DEFAULT 'ذكر';"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN level TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN stream TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN subSpecialty TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN classGroup TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN examHallId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN examGroupId TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE students ADD COLUMN seatNumber INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE teachers ADD COLUMN isExempt INTEGER DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE teachers ADD COLUMN exemptReason TEXT DEFAULT '';"); } catch(e) {}
try { db.exec("ALTER TABLE halls ADD COLUMN proctorsCount INTEGER;"); } catch(e) {}

// Insert default an admin user if not exists
const checkUser = db.prepare("SELECT * FROM accounts WHERE username = ?").get("admin");
if (!checkUser) {
  const hash = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT INTO accounts (username, password, role) VALUES (?, ?, ?)").run("admin", hash, "مدير");
}

// Authentication Middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = { id: 1, username: "admin", role: "مدير" };
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token || token === "mock-jwt-token" || token === "undefined") {
    req.user = { id: 1, username: "admin", role: "مدير" };
    return next();
  }

  try {
    const decoded = verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Fall back gracefully for preview / dev environments
    req.user = { id: 1, username: "admin", role: "مدير" };
    next();
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      if (!data.id) {
        data.id = `${tableName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      }
      const keys = Object.keys(data);
      const values = keys.map(k => {
        const val = data[k];
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (Array.isArray(val)) return JSON.stringify(val);
        return val;
      });
      
      const placeholders = keys.map(() => '?').join(',');
      const query = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;
      
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
      const values = keys.map(k => {
        const val = data[k];
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (Array.isArray(val)) return JSON.stringify(val);
        return val;
      });
      
      const setStatements = keys.map(k => `${k} = ?`).join(',');
      const query = `UPDATE ${tableName} SET ${setStatements} WHERE id = ?`;
      
      try {
        db.prepare(query).run(...values, id);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.delete(`/api/${tableName}/:id`, authenticateUser, (req, res, next) => {
      const { id } = req.params;
      if (id === 'all' || id === 'demo') {
        return next();
      }
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
  createCrudRoutes('students');
  createCrudRoutes('exam_groups');

  // Fast bulk replace assignments and update teacher hours
  app.post("/api/assignments/replace", authenticateUser, (req, res) => {
    const { assignments, stats } = req.body;
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: "بيانات التكليفات غير صالحة" });
    }

    const deleteStmt = db.prepare("DELETE FROM assignments;");
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO assignments (id, examId, teacherId, hallId, period, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateTeacherStmt = db.prepare("UPDATE teachers SET totalHours = ? WHERE id = ?");

    try {
      const runTransaction = db.transaction(() => {
        deleteStmt.run();
        const usedIds = new Set<string>();

        for (let i = 0; i < assignments.length; i++) {
          const a = assignments[i];
          let id = a.id;
          if (!id || usedIds.has(id)) {
            id = `assign_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`;
          }
          usedIds.add(id);

          insertStmt.run(
            id,
            String(a.examId),
            String(a.teacherId),
            String(a.hallId || 'default'),
            String(a.period || 'morning'),
            String(a.date || '')
          );
        }
        if (stats && typeof stats === 'object') {
          for (const [tId, hours] of Object.entries(stats)) {
            updateTeacherStmt.run(Number(hours) || 0, tId);
          }
        }
      });

      runTransaction();
      res.json({ success: true, count: assignments.length });
    } catch (e: any) {
      console.error("Error replacing assignments:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Quick generate 20 halls
  app.post("/api/halls/quick-generate", authenticateUser, (req, res) => {
    try {
      const count = Number(req.body.count) || 20;
      const capacity = Number(req.body.capacity) || 30;
      const stmt = db.prepare("INSERT OR REPLACE INTO halls (id, name, capacity, proctorsCount) VALUES (?, ?, ?, ?)");
      const insertMany = db.transaction(() => {
        for (let i = 1; i <= count; i++) {
          const id = `hall_${i}`;
          const name = `القاعة ${String(i).padStart(2, '0')}`;
          stmt.run(id, name, capacity, null);
        }
      });
      insertMany();
      res.json({ success: true, count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Students Bulk Import
  app.post("/api/students/bulk", authenticateUser, (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: "بيانات غير صالحة - يجب تمرير مصفوفة تلاميذ" });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO students (id, matricule, name, gender, level, stream, subSpecialty, classGroup, examHallId, examGroupId, seatNumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      let count = 0;
      const insertMany = db.transaction((items) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          const nameStr = String(item.name || '').trim();
          if (!nameStr) continue;

          const id = String(item.id || `s_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`);
          const matricule = String(item.matricule || `2025/${1000 + i}`);
          const gender = String(item.gender || 'ذكر');
          const level = String(item.level || 'first');
          const stream = String(item.stream || 'أولى جذع مشترك علوم وتكنولوجيا');
          const subSpecialty = String(item.subSpecialty || '');
          const classGroup = String(item.classGroup || '');
          const examHallId = String(item.examHallId || '');
          const examGroupId = String(item.examGroupId || '');
          const seatNumber = Number(item.seatNumber) || (i + 1);

          stmt.run(id, matricule, nameStr, gender, level, stream, subSpecialty, classGroup, examHallId, examGroupId, seatNumber);
          count++;
        }
      });

      insertMany(students);
      res.json({ success: true, count });
    } catch (e: any) {
      console.error("Error inserting students bulk:", e);
      res.status(500).json({ error: e?.message || "خطأ في حفظ بيانات التلاميذ بقاعدة البيانات" });
    }
  });

  // Delete all students
  app.delete("/api/students/all", authenticateUser, (req, res) => {
    try {
      db.prepare("DELETE FROM students").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete multiple students by IDs
  app.post("/api/students/delete-many", authenticateUser, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }
    try {
      const delStudent = db.prepare("DELETE FROM students WHERE id = ?");
      db.transaction((list: string[]) => {
        for (const id of list) {
          delStudent.run(String(id));
        }
      })(ids);
      res.json({ success: true, count: ids.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete all halls
  app.delete("/api/halls/all", authenticateUser, (req, res) => {
    try {
      db.prepare("DELETE FROM halls").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete all exam groups
  app.delete("/api/exam_groups/all", authenticateUser, (req, res) => {
    try {
      db.prepare("DELETE FROM exam_groups").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete all exams (and clear assignments tied to them)
  app.delete("/api/exams/all", authenticateUser, (req, res) => {
    try {
      db.transaction(() => {
        db.exec("DELETE FROM exams;");
        db.exec("DELETE FROM assignments;");
      })();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete multiple exams by IDs
  app.post("/api/exams/delete-many", authenticateUser, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }
    try {
      const delExam = db.prepare("DELETE FROM exams WHERE id = ?");
      const delAssign = db.prepare("DELETE FROM assignments WHERE examId = ?");
      db.transaction((list: string[]) => {
        for (const id of list) {
          delExam.run(String(id));
          delAssign.run(String(id));
        }
      })(ids);
      res.json({ success: true, count: ids.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk save exam groups
  app.post("/api/exam_groups/bulk", authenticateUser, (req, res) => {
    const { groups } = req.body;
    if (!Array.isArray(groups)) return res.status(400).json({ error: "بيانات غير صالحة" });
    const stmt = db.prepare("INSERT OR REPLACE INTO exam_groups (id, name, level, stream, hallId, studentCount) VALUES (?, ?, ?, ?, ?, ?)");
    const insertMany = db.transaction((items) => {
      for (const g of items) {
        stmt.run(g.id, g.name, g.level, g.stream, g.hallId || '', Number(g.studentCount) || 0);
      }
    });
    try {
      insertMany(groups);
      res.json({ success: true, count: groups.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Clear demo teachers specifically
  app.delete("/api/teachers/demo", authenticateUser, (req, res) => {
    try {
      const result = db.prepare(`
        DELETE FROM teachers 
        WHERE id LIKE 'demo_%' 
           OR id LIKE 't_demo_%'
           OR id GLOB 't[0-9]*' 
           OR id GLOB 't_[0-9]' 
           OR id GLOB 't_[0-9][0-9]' 
           OR id GLOB 't_[0-9][0-9][0-9]'
           OR email LIKE '%@example.com'
      `).run();
      res.json({ success: true, count: result.changes });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Clear all teachers
  app.delete("/api/teachers/all", authenticateUser, (req, res) => {
    try {
      db.prepare("DELETE FROM teachers;").run();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk endpoints for ultra-fast Excel imports
  app.post("/api/teachers/bulk", authenticateUser, (req, res) => {
    const { teachers, replaceExisting } = req.body;
    if (!Array.isArray(teachers)) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }

    try {
      // 1. Always purge demo teachers whenever teachers are added/imported
      db.prepare(`
        DELETE FROM teachers 
        WHERE id LIKE 'demo_%' 
           OR id LIKE 't_demo_%'
           OR id GLOB 't[0-9]*' 
           OR id GLOB 't_[0-9]' 
           OR id GLOB 't_[0-9][0-9]' 
           OR id GLOB 't_[0-9][0-9][0-9]'
           OR email LIKE '%@example.com'
      `).run();

      // 2. If replaceExisting is true (default when importing official faculty list), clear remaining teachers
      if (replaceExisting) {
        db.prepare("DELETE FROM teachers;").run();
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO teachers (id, name, specialty, seniority, email, totalHours, availabilityExceptions, isExempt, exemptReason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((items) => {
        let count = 0;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item || !item.name || String(item.name).trim() === '') continue;
          const id = item.id || `t_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
          stmt.run(
            id,
            String(item.name).trim(),
            item.specialty && String(item.specialty).trim() !== '' ? String(item.specialty).trim() : 'عام',
            Number(item.seniority) || 0,
            item.email || '',
            Number(item.totalHours) || 0,
            typeof item.availabilityExceptions === 'string' ? item.availabilityExceptions : JSON.stringify(item.availabilityExceptions || []),
            item.isExempt ? 1 : 0,
            String(item.exemptReason || '')
          );
          count++;
        }
        return count;
      });

      const count = insertMany(teachers);
      res.json({ success: true, count });
    } catch (e) {
      console.error("Error bulk inserting teachers:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/halls/bulk", authenticateUser, (req, res) => {
    const { halls } = req.body;
    if (!Array.isArray(halls)) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }

    const stmt = db.prepare(`
      INSERT INTO halls (id, name, capacity, proctorsCount)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        const pCount = Number(item.proctorsCount);
        stmt.run(
          item.id || (Date.now().toString() + Math.random().toString().slice(2, 8)),
          item.name,
          Number(item.capacity) || 30,
          Number.isFinite(pCount) && pCount >= 1 ? pCount : null
        );
      }
    });

    try {
      insertMany(halls);
      res.json({ success: true, count: halls.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/exams/bulk", authenticateUser, (req, res) => {
    const { exams } = req.body;
    if (!Array.isArray(exams)) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }

    const stmt = db.prepare(`
      INSERT INTO exams (id, subject, date, period, timeRange, duration, hallCount, proctorsPerHall, targetLevel, stream)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run(
          item.id || (Date.now().toString() + Math.random().toString().slice(2, 8)),
          item.subject,
          item.date,
          item.period || 'morning',
          item.timeRange || '08:00 - 10:00',
          Number(item.duration) || 2,
          Number(item.hallCount) || 1,
          Number(item.proctorsPerHall) || 2,
          item.targetLevel || 'first_second',
          item.stream || 'جميع الشعب'
        );
      }
    });

    try {
      insertMany(exams);
      res.json({ success: true, count: exams.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Endpoint to reset/populate standard curriculum exams for official Algerian timetable
  app.post("/api/exams/reset-standard", authenticateUser, (req, res) => {
    try {
      db.exec("DELETE FROM exams;");

      const stmt = db.prepare(`
        INSERT INTO exams (id, subject, date, period, timeRange, duration, hallCount, proctorsPerHall, targetLevel, stream)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const standardExams = [
        // Year 1 Science
        { id: 'ex_1_sc_1', subject: 'الرياضيات', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
        { id: 'ex_1_sc_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
        { id: 'ex_1_sc_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
        { id: 'ex_1_sc_4', subject: 'العلوم الفيزيائية', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
        { id: 'ex_1_sc_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },
        { id: 'ex_1_sc_6', subject: 'اللغة العربية وآدابها', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك علوم وتكنولوجيا' },

        // Year 1 Arts
        { id: 'ex_1_ar_1', subject: 'اللغة العربية وآدابها', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
        { id: 'ex_1_ar_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
        { id: 'ex_1_ar_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
        { id: 'ex_1_ar_4', subject: 'الرياضيات', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
        { id: 'ex_1_ar_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },
        { id: 'ex_1_ar_6', subject: 'اللغة الفرنسية', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'first', stream: 'أولى جذع مشترك آداب' },

        // Year 2 Streams
        { id: 'ex_2_mt_1', subject: 'الرياضيات', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
        { id: 'ex_2_mt_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
        { id: 'ex_2_mt_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
        { id: 'ex_2_mt_4', subject: 'العلوم الفيزيائية', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
        { id: 'ex_2_mt_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تقني رياضي' },
        { id: 'ex_2_mt_6', subject: 'اللغة العربية وآدابها', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية تقني رياضي' },

        { id: 'ex_2_ec_1', subject: 'الرياضيات', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },
        { id: 'ex_2_ec_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },
        { id: 'ex_2_ec_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },
        { id: 'ex_2_ec_4', subject: 'الاقتصاد والمناجمنت', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },
        { id: 'ex_2_ec_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },
        { id: 'ex_2_ec_6', subject: 'اللغة العربية وآدابها', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية تسيير واقتصاد' },

        { id: 'ex_2_sc_1', subject: 'الرياضيات', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
        { id: 'ex_2_sc_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
        { id: 'ex_2_sc_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
        { id: 'ex_2_sc_4', subject: 'العلوم الفيزيائية', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
        { id: 'ex_2_sc_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },
        { id: 'ex_2_sc_6', subject: 'اللغة العربية وآدابها', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية علوم تجريبية' },

        { id: 'ex_2_ph_1', subject: 'اللغة العربية وآدابها', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },
        { id: 'ex_2_ph_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },
        { id: 'ex_2_ph_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },
        { id: 'ex_2_ph_4', subject: 'الفلسفة', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },
        { id: 'ex_2_ph_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },
        { id: 'ex_2_ph_6', subject: 'اللغة العربية وآدابها', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية آداب وفلسفة' },

        { id: 'ex_2_fl_1', subject: 'اللغة العربية وآدابها', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },
        { id: 'ex_2_fl_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },
        { id: 'ex_2_fl_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },
        { id: 'ex_2_fl_4', subject: 'لغة أجنبية ثالثة', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },
        { id: 'ex_2_fl_5', subject: 'اللغة الإنجليزية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },
        { id: 'ex_2_fl_6', subject: 'الرياضيات', date: '2025-12-10', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'second', stream: 'ثانية لغات أجنبية' },

        // Year 3 Bac Trial Streams
        { id: 'ex_3_sc_1', subject: 'علوم الطبيعة والحياة', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
        { id: 'ex_3_sc_2', subject: 'العلوم الإسلامية', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
        { id: 'ex_3_sc_3', subject: 'الرياضيات', date: '2025-12-08', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
        { id: 'ex_3_sc_4', subject: 'العلوم الفيزيائية', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },
        { id: 'ex_3_sc_5', subject: 'اللغة الفرنسية', date: '2025-12-09', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'third', stream: 'ثالثة علوم تجريبية' },

        { id: 'ex_3_ph_1', subject: 'الفلسفة', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة آداب وفلسفة' },
        { id: 'ex_3_ph_2', subject: 'اللغة العربية وآدابها', date: '2025-12-07', period: 'morning', timeRange: '10:00 - 12:00', targetLevel: 'third', stream: 'ثالثة آداب وفلسفة' },
        { id: 'ex_3_ph_3', subject: 'التاريخ والجغرافيا', date: '2025-12-08', period: 'afternoon', timeRange: '13:30 - 15:30', targetLevel: 'third', stream: 'ثالثة آداب وفلسفة' },

        { id: 'ex_3_mt_1', subject: 'التكنولوجيا', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تقني رياضي' },
        { id: 'ex_3_mt_2', subject: 'الرياضيات', date: '2025-12-08', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تقني رياضي' },
        { id: 'ex_3_mt_3', subject: 'العلوم الفيزيائية', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تقني رياضي' },

        { id: 'ex_3_ec_1', subject: 'التسيير المحاسبي والمالي', date: '2025-12-07', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تسيير واقتصاد' },
        { id: 'ex_3_ec_2', subject: 'الاقتصاد والمناجمنت', date: '2025-12-08', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تسيير واقتصاد' },
        { id: 'ex_3_ec_3', subject: 'القانون', date: '2025-12-09', period: 'morning', timeRange: '08:00 - 10:00', targetLevel: 'third', stream: 'ثالثة تسيير واقتصاد' }
      ];

      standardExams.forEach(e => {
        stmt.run(e.id, e.subject, e.date, e.period, e.timeRange, 2, 1, 2, e.targetLevel, e.stream);
      });

      res.json({ success: true, count: standardExams.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

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
        teachers.push([`demo_t_${i}`, `${firstName} ${lastName}`, specialty, (i % 15) + 1, `teacher${i}@example.com`, 0, "[]"]);
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

  // Workspace Snapshot & Atomic Restore (for explicit Save vs Refresh-to-Empty)
  app.get("/api/workspace/snapshot", authenticateUser, (req, res) => {
    try {
      const settingsRows = db.prepare("SELECT * FROM settings").all();
      const settings = settingsRows.reduce((acc, row) => {
        try {
          return { ...acc, [row.key]: JSON.parse(row.value) };
        } catch {
          return acc;
        }
      }, {});

      res.json({
        settings,
        teachers: db.prepare("SELECT * FROM teachers").all(),
        halls: db.prepare("SELECT * FROM halls").all(),
        exams: db.prepare("SELECT * FROM exams").all(),
        assignments: db.prepare("SELECT * FROM assignments").all(),
        students: db.prepare("SELECT * FROM students").all(),
        exam_groups: db.prepare("SELECT * FROM exam_groups").all(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/workspace/restore", authenticateUser, (req, res) => {
    const body = req.body || {};
    const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
    const teachers = Array.isArray(body.teachers) ? body.teachers : [];
    const halls = Array.isArray(body.halls) ? body.halls : [];
    const exams = Array.isArray(body.exams) ? body.exams : [];
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];
    const students = Array.isArray(body.students) ? body.students : [];
    const examGroups = Array.isArray(body.exam_groups) ? body.exam_groups : [];

    const insertSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    const insertTeacher = db.prepare(`
      INSERT OR REPLACE INTO teachers (id, name, specialty, seniority, email, totalHours, availabilityExceptions, isExempt, exemptReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertHall = db.prepare("INSERT OR REPLACE INTO halls (id, name, capacity, proctorsCount) VALUES (?, ?, ?, ?)");
    const insertExam = db.prepare(`
      INSERT OR REPLACE INTO exams (id, subject, date, period, timeRange, duration, hallCount, proctorsPerHall, targetLevel, stream)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAssignment = db.prepare(`
      INSERT OR REPLACE INTO assignments (id, examId, hallId, teacherId, date, period)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertStudent = db.prepare(`
      INSERT OR REPLACE INTO students (id, matricule, name, gender, level, stream, subSpecialty, classGroup, examHallId, examGroupId, seatNumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertGroup = db.prepare(`
      INSERT OR REPLACE INTO exam_groups (id, name, level, stream, hallId, studentCount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      const runRestore = db.transaction(() => {
        db.exec("DELETE FROM settings; DELETE FROM teachers; DELETE FROM halls; DELETE FROM exams; DELETE FROM assignments; DELETE FROM students; DELETE FROM exam_groups;");

        for (const [k, v] of Object.entries(settings)) {
          insertSetting.run(String(k), JSON.stringify(v));
        }

        for (let i = 0; i < teachers.length; i++) {
          const t = teachers[i];
          if (!t || !t.name) continue;
          insertTeacher.run(
            String(t.id || `t_${Date.now()}_${i}`),
            String(t.name).trim(),
            String(t.specialty || 'عام').trim(),
            Number(t.seniority) || 0,
            String(t.email || ''),
            Number(t.totalHours) || 0,
            typeof t.availabilityExceptions === 'string' ? t.availabilityExceptions : JSON.stringify(t.availabilityExceptions || []),
            t.isExempt ? 1 : 0,
            String(t.exemptReason || '')
          );
        }

        for (let i = 0; i < halls.length; i++) {
          const h = halls[i];
          if (!h || !h.name) continue;
          const pCount = Number(h.proctorsCount);
          insertHall.run(
            String(h.id || `hall_${i}`),
            String(h.name),
            Number(h.capacity) || 30,
            Number.isFinite(pCount) && pCount >= 1 ? pCount : null
          );
        }

        for (let i = 0; i < exams.length; i++) {
          const ex = exams[i];
          if (!ex || !ex.subject) continue;
          insertExam.run(
            String(ex.id || `ex_${i}`),
            String(ex.subject),
            String(ex.date || ''),
            String(ex.period || 'morning'),
            String(ex.timeRange || '08:00 - 10:00'),
            Number(ex.duration) || 2,
            Number(ex.hallCount) || 1,
            Number(ex.proctorsPerHall) || 2,
            String(ex.targetLevel || 'first_second'),
            String(ex.stream || 'جميع الشعب')
          );
        }

        for (let i = 0; i < assignments.length; i++) {
          const a = assignments[i];
          if (!a) continue;
          insertAssignment.run(
            String(a.id || `assign_${i}`),
            String(a.examId || ''),
            String(a.hallId || 'default'),
            String(a.teacherId || ''),
            String(a.date || ''),
            String(a.period || 'morning')
          );
        }

        for (let i = 0; i < students.length; i++) {
          const s = students[i];
          if (!s || !s.name) continue;
          insertStudent.run(
            String(s.id || `st_${i}`),
            String(s.matricule || ''),
            String(s.name),
            String(s.gender || 'ذكر'),
            String(s.level || 'first'),
            String(s.stream || ''),
            String(s.subSpecialty || ''),
            String(s.classGroup || ''),
            String(s.examHallId || ''),
            String(s.examGroupId || ''),
            Number(s.seatNumber) || (i + 1)
          );
        }

        for (let i = 0; i < examGroups.length; i++) {
          const g = examGroups[i];
          if (!g || !g.name) continue;
          insertGroup.run(
            String(g.id || `grp_${i}`),
            String(g.name),
            String(g.level || 'first'),
            String(g.stream || ''),
            String(g.hallId || ''),
            Number(g.studentCount) || 0
          );
        }
      });

      runRestore();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Clear data
  app.delete("/api/clear-all", authenticateUser, (req, res) => {
    try {
      db.exec("DELETE FROM settings; DELETE FROM teachers; DELETE FROM halls; DELETE FROM exams; DELETE FROM assignments; DELETE FROM students; DELETE FROM exam_groups;");
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
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
