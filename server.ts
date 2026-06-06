import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import sqlite3 from "sqlite3";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

// Ensure upload directories exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// Initialize SQLite Database
const DB_PATH = path.join(process.cwd(), "database.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database at:", DB_PATH);
  }
});

// Wrap DB commands in helper Promises for modern async/await syntax
const dbRun = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Bootstrap database tables
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      video_filename TEXT NOT NULL,
      thumbnail_filename TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  console.log("SQLite tables successfully initialized.");
}

initDatabase().catch((err) => {
  console.error("Failed to initialize database tables:", err);
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
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15"/>
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#121214" stop-opacity="0.1"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#radialGrad)"/>
    <rect x="2" y="2" width="636" height="356" rx="4" fill="none" stroke="#2a2a30" stroke-width="1.5"/>
    <circle cx="320" cy="150" r="38" fill="#3b82f6" fill-opacity="0.12" stroke="#3b82f6" stroke-width="1.5"/>
    <polygon points="314,138 334,150 314,162" fill="#3b82f6"/>
    <text x="320" y="235" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" text-anchor="middle">${escapedTitle}</text>
    <text x="320" y="265" fill="#3b82f6" font-family="monospace" font-size="12" font-weight="bold" letter-spacing="3" text-anchor="middle">FULLSTACK HUB</text>
    <text x="320" y="290" fill="#52525b" font-family="system-ui, -apple-system, sans-serif" font-size="11" text-anchor="middle">Click to play developer media</text>
  </svg>`;
  fs.writeFileSync(thumbnailPath, svg);
}

// Extract poster frame at 2.0s using standard FFmpeg binary
function extractThumbnailWithFFmpeg(videoPath: string, thumbnailPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    // ffprobe can be used to extract lengths, but here we enforce taking frame on the 2nd second (00:00:02)
    // -y overrides destination if exists, -q:v 2 manages quality conversion standard
    const command = `ffmpeg -ss 00:00:02 -i "${videoPath}" -vframes 1 -q:v 2 -y "${thumbnailPath}"`;
    exec(command, (error, stdout, stderr) => {
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
    if (file.fieldname === "video") {
      cb(null, VIDEOS_DIR);
    } else {
      cb(null, THUMBNAILS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Limiting videos to 100MB max
  },
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

  // Expose upload static assets securely
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API ROUTING SECTION ---

  // User Auth - Register
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
      const existingUser = await dbGet("SELECT id FROM users WHERE username = ?", [cleanUsername]);
      if (existingUser) {
        return res.status(400).json({ error: "Это имя пользователя уже занято." });
      }

      // Cryptographically sound simple digest hash for storing passwords safely
      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

      const result = await dbRun(
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
      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

      const user = await dbGet(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        [cleanUsername]
      );

      if (!user || user.password_hash !== passwordHash) {
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

  // Video Hosting: Get All Videos
  app.get("/api/videos", async (req, res) => {
    try {
      // Pull videos linked with respective authors, descending sequence
      const videos = await dbAll(`
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

  // Video Hosting: Video Upload Handler
  app.post(
    "/api/videos/upload",
    upload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const { title, description, user_id } = req.body;

        if (!title || !title.trim()) {
          return res.status(400).json({ error: "Пожалуйста, укажите название видео." });
        }

        if (!files || !files.video || files.video.length === 0) {
          return res.status(400).json({ error: "Файл видео не загружен или имеет некорректный формат." });
        }

        const videoFile = files.video[0];
        const videoFilename = videoFile.filename;
        const videoPath = videoFile.path;

        let thumbnailFilename = "";

        // Determine destination thumbnail name
        const thumbnailUUID = crypto.randomUUID();
        const destThumbnailFilename = `${thumbnailUUID}.jpg`;
        const destThumbnailPath = path.join(THUMBNAILS_DIR, destThumbnailFilename);

        // Attempt ffmpeg extraction first
        const ffmpegSuccess = await extractThumbnailWithFFmpeg(videoPath, destThumbnailPath);

        if (ffmpegSuccess) {
          thumbnailFilename = destThumbnailFilename;
        } else if (files.thumbnail && files.thumbnail.length > 0) {
          // If FFmpeg fails, use the uploaded thumbnail generated by browser canvas (if present)
          const customThumbFile = files.thumbnail[0];
          // Move/rename uploaded file to fit .jpg
          const uploadedThumbExt = path.extname(customThumbFile.originalname).toLowerCase() || ".jpg";
          const finalThumbName = `${thumbnailUUID}${uploadedThumbExt}`;
          const finalThumbPath = path.join(THUMBNAILS_DIR, finalThumbName);

          fs.renameSync(customThumbFile.path, finalThumbPath);
          thumbnailFilename = finalThumbName;
          console.log("Using browser-generated canvas thumbnail fallback.");
        } else {
          // Absolute fallback: write custom sleek neon SVG poster file
          const svgThumbnailName = `${thumbnailUUID}.svg`;
          const svgThumbnailPath = path.join(THUMBNAILS_DIR, svgThumbnailName);
          generateFallbackThumbnail(svgThumbnailPath, title);
          thumbnailFilename = svgThumbnailName;
          console.log("Using dynamic SVG thumbnail fallback.");
        }

        // Write SQLite database record
        const authorId = user_id ? parseInt(user_id) : null;
        const result = await dbRun(
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
          },
        });
      } catch (err: any) {
        console.error("Upload handler exception:", err);
        return res.status(500).json({ error: err.message || "Ошибка при обработке загруженного видео." });
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

  // Bind server listener
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FullStack Hub] Server running online at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting backend server:", err);
});
