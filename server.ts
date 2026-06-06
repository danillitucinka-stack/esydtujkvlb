import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import sqlite3 from "sqlite3";
import pg from "pg";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

// Ensure upload directories exist (for local sandbox caching)
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// --- DUAL DATABASE STRATEGY (PostgreSQL & SQLite) ---
const hasPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
let pgPool: pg.Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

if (hasPostgres) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  pgPool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // safe connection for Vercel Serverless Postgres
  });
  console.log("Database Engine initialized: PostgreSQL [Active for Vercel/Cloud]");
} else {
  // SQLite safe offline-first container database
  const DB_PATH = path.join(process.cwd(), "database.db");
  sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error("Error opening offline SQLite database:", err.message);
    else console.log("Database Engine initialized: SQLite [Fallback Local Container Mode] at", DB_PATH);
  });
}

// Unified Query Execution Interface
async function queryRun(sql: string, params: any[] = []): Promise<{ id: number; changes: number }> {
  if (hasPostgres && pgPool) {
    let finalSql = sql;
    // Append RETURNING id to INSERT statements to fetch the serial primary key
    if (sql.trim().toUpperCase().startsWith("INSERT") && !sql.toUpperCase().includes("RETURNING")) {
      finalSql = `${sql} RETURNING id`;
    }
    // Map ? to $1, $2, $3 for Postgres query formatting
    let paramIndex = 1;
    finalSql = finalSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    const res = await pgPool.query(finalSql, params);
    const lastRow = res.rows[res.rows.length - 1];
    return {
      id: lastRow ? lastRow.id : 0,
      changes: res.rowCount ?? 0,
    };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function (this: any, err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
  throw new Error("No database active");
}

async function queryAll(sql: string, params: any[] = []): Promise<any[]> {
  if (hasPostgres && pgPool) {
    let finalSql = sql;
    let paramIndex = 1;
    finalSql = finalSql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(finalSql, params);
    return res.rows;
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  return [];
}

async function queryGet(sql: string, params: any[] = []): Promise<any> {
  if (hasPostgres && pgPool) {
    let finalSql = sql;
    let paramIndex = 1;
    finalSql = finalSql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(finalSql, params);
    return res.rows[0] || null;
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  return null;
}

// Bootstrap table schemas
async function initDatabase() {
  if (hasPostgres && pgPool) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        video_filename TEXT,
        thumbnail_filename TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id)
      )
    `);
    console.log("PostgreSQL Database initialized successfully matching serverless spec.");
  } else {
    await queryRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRun(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        video_filename TEXT,
        thumbnail_filename TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    console.log("SQLite Engine tables successfully initialized with advanced columns.");
  }
}

initDatabase().catch((err) => {
  console.error("Failed to initialize system database columns:", err);
});

// Helper: Escape SVG HTML to prevent corruption inside generated fallback thumbnails
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate high-quality sleek neon fallback SVG poster when FFmpeg extraction is not possible
function generateFallbackThumbnail(thumbnailPath: string, title: string) {
  const escapedTitle = escapeHtml(title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="100%" height="100%" fill="#131316"/>
    <defs>
      <linearGradient id="radialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/>
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#121214" stop-opacity="0.1"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#radialGrad)"/>
    <rect x="2" y="2" width="636" height="356" rx="4" fill="none" stroke="#2a2a30" stroke-width="1.5"/>
    <circle cx="320" cy="150" r="38" fill="#6366f1" fill-opacity="0.12" stroke="#6366f1" stroke-width="1.5"/>
    <polygon points="314,138 334,150 314,162" fill="#6366f1"/>
    <text x="320" y="235" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" text-anchor="middle">${escapedTitle}</text>
    <text x="320" y="265" fill="#6366f1" font-family="monospace" font-size="12" font-weight="bold" letter-spacing="3" text-anchor="middle">FULLSTACK HUB</text>
    <text x="320" y="290" fill="#52525b" font-family="system-ui, -apple-system, sans-serif" font-size="11" text-anchor="middle">Serverless Dynamic URL Broadcast</text>
  </svg>`;
  fs.writeFileSync(thumbnailPath, svg);
}

// Extract poster frame at 2.0s using standard FFmpeg binary
function extractThumbnailWithFFmpeg(videoPath: string, thumbnailPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = `ffmpeg -ss 00:00:02 -i "${videoPath}" -vframes 1 -q:v 2 -y "${thumbnailPath}"`;
    exec(command, (error) => {
      if (error) {
        console.warn("FFmpeg process unavailable or returned error:", error.message);
        resolve(false);
      } else {
        console.log("FFmpeg thumbnail successfully extracted at 2.0 seconds.");
        resolve(true);
      }
    });
  });
}

// Config Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") cb(null, VIDEOS_DIR);
    else cb(null, THUMBNAILS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "video") {
      if ([".mp4", ".avi", ".mkv"].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Допустимы только форматы видео: MP4, AVI, MKV."));
      }
    } else {
      if ([".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Неверный формат изображения для превью."));
      }
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for basic parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Expose static directories
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API ROUTING SECTION ---

  // User Auth - Register (Postgres compatible with crypto password digestion)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Пожалуйста, введите логин и пароль." });
      }

      const cleanUsername = username.trim();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: "Имя пользователя должно содержать не менее 3 символов." });
      }

      // Check if user already exists
      const existingUser = await queryGet("SELECT id FROM users WHERE username = ?", [cleanUsername]);
      if (existingUser) {
        return res.status(400).json({ error: "Это имя пользователя уже занято." });
      }

      // Safe password pbkdf2 algorithm similar to werkzeug standard (pbkdf2:sha256)
      const salt = crypto.randomBytes(16).toString("hex");
      const iterations = 100000;
      const keylen = 64;
      const digest = "sha256";
      
      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
      const passwordHash = `pbkdf2:sha256:${iterations}$${salt}$${derivedKey.toString("hex")}`;

      const result = await queryRun(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        [cleanUsername, passwordHash]
      );

      return res.json({
        success: true,
        user: { id: result.id, username: cleanUsername },
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      return res.status(500).json({ error: "Внутренняя ошибка при регистрации" });
    }
  });

  // User Auth - Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Пожалуйста, введите логин и пароль." });
      }

      const cleanUsername = username.trim();
      const user = await queryGet(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        [cleanUsername]
      );

      if (!user) {
        return res.status(400).json({ error: "Неверное имя пользователя или пароль." });
      }

      // Verify digestion format (support legacy plain hash and new pbkdf2:sha256 format)
      let isVerified = false;
      const storedHash = user.password_hash;
      
      if (storedHash.startsWith("pbkdf2:sha256:")) {
        const parts = storedHash.replace("pbkdf2:sha256:", "").split("$");
        const iterations = parseInt(parts[0], 10);
        const salt = parts[1];
        const hash = parts[2];
        const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha256");
        isVerified = derivedKey.toString("hex") === hash;
      } else {
        // Fallback for previous simple SHA256 hashes
        const checkHash = crypto.createHash("sha256").update(password).digest("hex");
        isVerified = checkHash === storedHash;
      }

      if (!isVerified) {
        return res.status(400).json({ error: "Неверное имя пользователя или пароль." });
      }

      return res.json({
        success: true,
        user: { id: user.id, username: user.username },
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Внутренняя ошибка при входе" });
    }
  });

  // Video Hosting - Fetch active stream lists
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await queryAll(`
        SELECT videos.*, users.username as author_name 
        FROM videos 
        LEFT JOIN users ON videos.user_id = users.id 
        ORDER BY videos.uploaded_at DESC
      `);
      return res.json(videos);
    } catch (err: any) {
      console.error("Error fetching videos list:", err);
      return res.status(500).json({ error: "Не удалось получить список видео из базы данных." });
    }
  });

  // Video Hosting - Dual Upload (Supports File Upload and Serverless URLs as requested)
  app.post(
    "/api/videos/upload",
    (req, res, next) => {
      // Direct JSON URL posts skip multipart parse
      const contentType = req.headers["content-type"] || "";
      if (req.is("json") || contentType.includes("application/json")) {
        return next();
      }
      upload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ])(req, res, next);
    },
    async (req, res) => {
      try {
        const { title, description, user_id, video_url, thumbnail_url } = req.body;

        if (!title || !title.trim()) {
          return res.status(400).json({ error: "Пожалуйста, укажите название видео." });
        }

        const authorId = user_id ? parseInt(user_id, 10) : null;

        // --- Serverless logic: Accepts url-based links instead of local disc files if passed --
        if (video_url || thumbnail_url) {
          if (!video_url || !video_url.trim()) {
            return res.status(400).json({ error: "Укажите корректную ссылку на видео-ресурс." });
          }
          if (!thumbnail_url || !thumbnail_url.trim()) {
            return res.status(400).json({ error: "Укажите корректную ссылку на изображение превью фильма." });
          }

          const result = await queryRun(
            "INSERT INTO videos (title, description, video_url, thumbnail_url, user_id) VALUES (?, ?, ?, ?, ?)",
            [title.trim(), description ? description.trim() : "", video_url.trim(), thumbnail_url.trim(), authorId]
          );

          return res.json({
            success: true,
            video: {
              id: result.id,
              title: title.trim(),
              video_url: video_url.trim(),
              thumbnail_url: thumbnail_url.trim(),
              user_id: authorId,
            },
          });
        }

        // --- Standard Local Files Upload Fallback ---
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (!files || !files.video || files.video.length === 0) {
          return res.status(400).json({ error: "Для публикации укажите URL ссылки, или загрузите файл видео (.mp4, .avi)." });
        }

        const videoFile = files.video[0];
        const videoFilename = videoFile.filename;
        const videoPath = videoFile.path;

        let thumbnailFilename = "";
        const thumbnailUUID = crypto.randomUUID();
        const destThumbnailFilename = `${thumbnailUUID}.jpg`;
        const destThumbnailPath = path.join(THUMBNAILS_DIR, destThumbnailFilename);

        const ffmpegSuccess = await extractThumbnailWithFFmpeg(videoPath, destThumbnailPath);

        if (ffmpegSuccess) {
          thumbnailFilename = destThumbnailFilename;
        } else if (files.thumbnail && files.thumbnail.length > 0) {
          const customThumbFile = files.thumbnail[0];
          const uploadedThumbExt = path.extname(customThumbFile.originalname).toLowerCase() || ".jpg";
          const finalThumbName = `${thumbnailUUID}${uploadedThumbExt}`;
          const finalThumbPath = path.join(THUMBNAILS_DIR, finalThumbName);

          fs.renameSync(customThumbFile.path, finalThumbPath);
          thumbnailFilename = finalThumbName;
        } else {
          const svgThumbnailName = `${thumbnailUUID}.svg`;
          const svgThumbnailPath = path.join(THUMBNAILS_DIR, svgThumbnailName);
          generateFallbackThumbnail(svgThumbnailPath, title);
          thumbnailFilename = svgThumbnailName;
        }

        const result = await queryRun(
          "INSERT INTO videos (title, description, video_filename, thumbnail_filename, user_id) VALUES (?, ?, ?, ?, ?)",
          [title.trim(), description ? description.trim() : "", videoFilename, thumbnailFilename, authorId]
        );

        return res.json({
          success: true,
          video: {
            id: result.id,
            title,
            video_filename: videoFilename,
            thumbnail_filename: thumbnailFilename,
            user_id: authorId,
          },
        });
      } catch (err: any) {
        console.error("Upload process error status:", err);
        return res.status(500).json({ error: err.message || "Ошибка записи видео в базу данных." });
      }
    }
  );

  // --- VITE DEV SETUP & PRODUCTION FALLBACK ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind server listener to port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FullStack Hub serverless-ready] Server running online at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting backend server:", err);
});
