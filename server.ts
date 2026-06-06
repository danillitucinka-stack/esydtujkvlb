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

// --- DUAL DATABASE STRATEGY (PostgreSQL & SQLite with Vercel Write Fallback) ---
const hasPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
let pgPool: pg.Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

if (hasPostgres) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  pgPool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // safe SSL connection for cloud-based PostgreSQL
  });
  console.log("Database Engine initialized: PostgreSQL [Active for Vercel/Cloud]");
} else {
  // On Vercel, the main workspace directory is read-only, so we fallback to /tmp/database.db
  const DB_PATH = process.env.VERCEL ? "/tmp/database.db" : path.join(process.cwd(), "database.db");
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
    console.log("SQLite Engine tables successfully initialized in database.");
  }
}

initDatabase().catch((err) => {
  console.error("Failed to initialize system database tables:", err);
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

const app = express();

// Middleware parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded assets
app.use("/uploads", express.static(UPLOADS_DIR));

// --- API ROUTING SECTION ---

// User Registration endpoint
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

    // Check pre-existing users
    const existingUser = await queryGet("SELECT id FROM users WHERE username = ?", [cleanUsername]);
    if (existingUser) {
      return res.status(400).json({ error: "Это имя пользователя уже занято." });
    }

    // Hash user passwords cleanly using pbkdf2 algorithm
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

// User Login endpoint
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

    // Verify stored password hash
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

// --- YOUTUBE & TWITCH DATA SEEDS & CONTROLLER ---
const YOUTUBE_BACKUP_VIDEOS = [
  {
    title: "React in 100 Seconds",
    original_id: "gU8Z48Xz2qM",
    description: "Learn the basics of React in just 100 seconds! Perfect for developers starting with React 18 and modern component building.",
    author_name: "Fireship",
    uploaded_at: "2026-05-10T12:00:00Z",
    views: 450230,
    category: "Разработка"
  },
  {
    title: "TypeScript in 100 Seconds",
    original_id: "zQnOBzgSZ9Y",
    description: "Learn why TypeScript is the standard wrapper for modern JS apps in 100 seconds.",
    author_name: "Fireship",
    uploaded_at: "2026-05-12T15:30:00Z",
    views: 312100,
    category: "Разработка"
  },
  {
    title: "SQL in 100 Seconds",
    original_id: "byovUP6FqW8",
    description: "Databases are hard. Learn Structured Query Language (SQL) in 100 seconds so you can build robust backends.",
    author_name: "Fireship",
    uploaded_at: "2026-05-15T09:00:00Z",
    views: 289450,
    category: "Базы данных"
  },
  {
    title: "PostgreSQL Explained in 100 Seconds",
    original_id: "n2Fluyr3lsc",
    description: "Postgres is the world's most advanced open-source relational database. Let's explain its features in 100s.",
    author_name: "Fireship",
    uploaded_at: "2026-05-20T10:15:00Z",
    views: 198300,
    category: "Базы данных"
  },
  {
    title: "Vite: The Modern Web Bundler Explained",
    original_id: "KCrXgy8o_Xo",
    description: "Vite is an incredibly fast development server and bundler. Learn how Vite handles code loading dynamically.",
    author_name: "Fireship",
    uploaded_at: "2026-05-22T14:00:00Z",
    views: 154000,
    category: "Разработка"
  },
  {
    title: "Docker in 100 Seconds",
    original_id: "gAkwW2tuIqE",
    description: "Containers make production deployment predictable. Learn Docker in 100 seconds.",
    author_name: "Fireship",
    uploaded_at: "2026-05-25T11:45:00Z",
    views: 389200,
    category: "Лайфхаки"
  },
  {
    title: "Next.js 14 Complete Guide",
    original_id: "wm5gMKuwSYk",
    description: "Everything you need to know about Next.js 14, routing, Server Actions, and partial pre-rendering.",
    author_name: "Vercel",
    uploaded_at: "2026-06-01T08:00:00Z",
    views: 89600,
    category: "Разработка"
  },
  {
    title: "Learn SQL Queries for Beginners with PG Admin",
    original_id: "H0wn31_S-S0",
    description: "Detailed hands-on tutorial on PostgreSQL databases and standard SELECT, JOIN, and INSERT statements.",
    author_name: "freeCodeCamp.org",
    uploaded_at: "2026-05-28T16:00:00Z",
    views: 672400,
    category: "Базы данных"
  }
];

const TWITCH_CHANNELS = [
  { channel_name: "shroud", author_name: "Shroud", title: "Ranked Valorant Grind with Squad | Drops on!", game_name: "Valorant" },
  { channel_name: "gaules", author_name: "Gaules", title: "CS2 Counter-Strike 2 Major Arena Live Tournament", game_name: "Counter-Strike 2" },
  { channel_name: "xqc", author_name: "xQc", title: "Reacting to crazy developer desk structures, then dev chat", game_name: "Just Chatting" },
  { channel_name: "tarik", author_name: "tarik", title: "VCT Masters Co-Stream LIVE - T1 vs Sentinels", game_name: "Valorant" },
  { channel_name: "clix", author_name: "Clix", title: "FNCS Grand Finals Practice with Duo | Fortnite live!", game_name: "Fortnite" },
  { channel_name: "auronplay", author_name: "AuronPlay", title: "Minecraft Survival - Building the ultimate automation farm!", game_name: "Minecraft" },
  { channel_name: "ibai", author_name: "Ibai", title: "Watching absolute best developer fails with chat", game_name: "Just Chatting" },
  { channel_name: "ninja", author_name: "Ninja", title: "Duo arena games with clix - road to unreal", game_name: "Fortnite" },
  { channel_name: "lck", author_name: "LCK", title: "LCK Summer Split Live coverage: T1 vs GenG", game_name: "League of Legends" },
  { channel_name: "freecodecamp", author_name: "freeCodeCamp Live", title: "Live Code-Along: Building a responsive SaaS with React & Tailwind CSS", game_name: "Software & Game Development" }
];

// Asynchronously parse YouTube RSS XML
async function fetchYouTubeFeed(channelId: string): Promise<any[]> {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s timeout so the feed is fast
    
    const res = await globalThis.fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const xml = await res.text();
    
    const entries: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(xml)) !== null) {
      const content = match[1];
      const videoIdMatch = content.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = content.match(/<title>(.*?)<\/title>/);
      const authorMatch = content.match(/<name>(.*?)<\/name>/);
      
      if (videoIdMatch && titleMatch) {
         const videoId = videoIdMatch[1].trim();
         const title = titleMatch[1].trim();
         const authorName = authorMatch ? authorMatch[1].trim() : "YouTube";
         
         // Random category matching from title
         let category = "Разработка";
         const normalizedTitle = title.toLowerCase();
         if (normalizedTitle.includes("sql") || normalizedTitle.includes("db") || normalizedTitle.includes("postgres") || normalizedTitle.includes("database")) {
           category = "Базы данных";
         } else if (normalizedTitle.includes("music") || normalizedTitle.includes("sound") || normalizedTitle.includes("муз") || normalizedTitle.includes("ambient")) {
           category = "Музыка & Саунд";
         } else if (normalizedTitle.includes("tips") || normalizedTitle.includes("lifehack") || normalizedTitle.includes("совет") || normalizedTitle.includes("hack")) {
           category = "Лайфхаки";
         }

         entries.push({
           id: Math.floor(Math.random() * 9000000) + 100000,
           title,
           description: `Смотрите свежее видео напрямую с официального канала YouTube автора ${authorName}.`,
           video_url: `https://www.youtube.com/watch?v=${videoId}`,
           thumbnail_url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
           uploaded_at: new Date().toISOString(),
           user_id: null,
           author_name: authorName,
           type: "youtube",
           views: Math.floor(Math.random() * 85000) + 1200,
           embed_url: `https://www.youtube.com/embed/${videoId}`,
           category
         });
      }
    }
    return entries;
  } catch (error) {
    // Fail silently, backups will cover
    return [];
  }
}

// Fisher-Yates Perfect Shuffle
function shuffleArray(array: any[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Unified Hub Feed Mixer Endpoint
app.get("/api/hub/feed", async (req, res) => {
  try {
    // 1. Load users' own uploads from local DB
    const dbVideos = await queryAll(`
      SELECT videos.*, users.username as author_name 
      FROM videos 
      LEFT JOIN users ON videos.user_id = users.id 
      ORDER BY videos.uploaded_at DESC
    `);
    
    const localVideos = dbVideos.map(v => ({
      ...v,
      type: "local" as const
    }));

    // 2. Fetch/Combine YouTube channel RSS feeds
    const channelIds = [
      "UCsBjURrdUwYMygX69QXYg7A", // Fireship
      "UC7W_67fO9Gqdb87G01W_NHA"  // Vercel
    ];
    
    let ytFeeds: any[] = [];
    try {
      const parsedFeeds = await Promise.all(channelIds.map(id => fetchYouTubeFeed(id)));
      ytFeeds = parsedFeeds.flat();
    } catch (e) {
      console.warn("YouTube feeds loading issue:", e);
    }

    // If dynamic feeds returned nothing, create high performance mock items from backup
    if (ytFeeds.length === 0) {
      ytFeeds = YOUTUBE_BACKUP_VIDEOS.map((vid, key) => ({
        id: 1100000 + key,
        title: vid.title,
        description: vid.description,
        video_url: `https://www.youtube.com/watch?v=${vid.original_id}`,
        thumbnail_url: `https://i.ytimg.com/vi/${vid.original_id}/maxresdefault.jpg`,
        uploaded_at: vid.uploaded_at,
        user_id: null,
        author_name: vid.author_name,
        type: "youtube" as const,
        views: vid.views,
        embed_url: `https://www.youtube.com/embed/${vid.original_id}`,
        category: vid.category
      }));
    }

    // 3. Compile Twitch Live streams
    const twitchStreams = TWITCH_CHANNELS.map((stream, idx) => {
      const viewCount = Math.floor(Math.random() * 48000) + 1200;
      
      // Select appropriate categories matching active tags
      let category = "Все";
      if (stream.channel_name === "freecodecamp") {
        category = "Разработка";
      } else if (idx % 3 === 0) {
        category = "Лайфхаки";
      }

      return {
        id: 2200000 + idx,
        title: stream.title,
        description: `Активный прямой эфир на Twitch от легендарного стримера ${stream.author_name} по игре или категории ${stream.game_name}. Присоединяйтесь к просмотру!`,
        video_url: `https://twitch.tv/${stream.channel_name}`,
        thumbnail_url: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${stream.channel_name}-640x360.jpg`,
        uploaded_at: new Date().toISOString(),
        user_id: null,
        author_name: stream.author_name,
        type: "twitch" as const,
        views: viewCount,
        game_name: stream.game_name,
        channel_name: stream.channel_name,
        category
      };
    });

    // 4. Combine! Keep local uploads prominent, then shuffle YouTube and Twitch
    const mixedYoutubeAndTwitch = shuffleArray([...ytFeeds, ...twitchStreams]);
    const finalFeed = [...localVideos, ...mixedYoutubeAndTwitch];

    return res.json(finalFeed);
  } catch (err: any) {
    console.error("Hub Feed mixer error:", err);
    return res.status(550).json({ error: "Не удалось сформировать общую ленту контента." });
  }
});

// Fetch active videos query endpoint
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

// Upload Video Endpoint (supports both JSON direct URLs and Multipart Form local uploads)
app.post(
  "/api/videos/upload",
  (req, res, next) => {
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

      // 1. Direct Cloud URL method (Default mode to make it completely Serverless/Vercel compatible)
      if (video_url || thumbnail_url) {
        if (!video_url || !video_url.trim()) {
          return res.status(400).json({ error: "Укажите корректную ссылку на видео-ресурс." });
        }
        if (!thumbnail_url || !thumbnail_url.trim()) {
          return res.status(400).json({ error: "Укажите корректную ссылку на изображение превью." });
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

      // 2. Standard Local Files Upload Fallback (Safe inside persistent Docker/VM container containers)
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

// --- SEPARATE THE SERVER BOOTSTRAPPING LOGIC FOR SERVERLESS INJECT ROUTING ---
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  const PORT = 3000;
  // --- VITE DEV SETUP & PRODUCTION FALLBACK ---
  if (process.env.NODE_ENV !== "production") {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`[FullStack Hub serverless-ready] Dev Server running at http://localhost:${PORT}`);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[FullStack Hub serverless-ready] Production Server running at http://localhost:${PORT}`);
    });
  }
}

export default app;
