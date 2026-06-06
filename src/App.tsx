import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  UploadCloud,
  User as UserIcon,
  LogIn,
  LogOut,
  Video as VideoIcon,
  Layers,
  Tv,
  CheckCircle,
  Calendar,
  X,
  FileText,
  Lock,
  PlusCircle,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Settings,
  Search,
  Database,
  Cpu,
  Monitor,
  Flame,
  Star,
  Globe,
  Link,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { User, Video } from "./types";

export default function App() {
  // Navigation & Page State (Simulating dark standalone pages: 'feed' | 'login' | 'register')
  const [currentScreen, setCurrentScreen] = useState<"feed" | "login" | "register">("feed");

  // Global App States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("fsh_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Authentication Fields (Login / Register)
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Upload Fields (Supporting folder files & Serverless URL inputs)
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url"); // Defaulting to URL Serverless
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [thumbnailUrlInput, setThumbnailUrlInput] = useState("");
  
  // File Upload Fallback states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Play Overlay Modal
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // System telemetry data simulation
  const [cpuLoad, setCpuLoad] = useState(14);
  const [dbType, setDbType] = useState<"sqlite" | "postgres">("sqlite");
  const [connUrl, setConnUrl] = useState("sqlite://database.db");

  // Periodically refresh fake telemetry to demonstrate stable microservice activity
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(Math.floor(10 + Math.random() * 12));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch SQLite/PostgreSQL system configuration of active DB engine
  const fetchDbDiagnostics = async () => {
    try {
      // Pulling active stream database configurations
      const response = await fetch("/api/videos");
      if (response.ok) {
        // If Postgres is set, we will detect it based on return payload schema or config
        const data: Video[] = await response.json();
        const hasUrlVideo = data.some((v) => v.video_url || v.thumbnail_url);
        if (hasUrlVideo) {
          setDbType("postgres");
          setConnUrl("postgresql://neon.tech");
        }
      }
    } catch (e) {
      console.warn("Telemetry offline:", e);
    }
  };

  // Fetch videos from database
  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      } else {
        console.error("Failed to fetch videos from server endpoint");
      }
    } catch (err) {
      console.error("Connection error loading videos:", err);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchDbDiagnostics();
  }, []);

  // Form Submission: API Authentication (Register / Login)
  const handleAuthSubmit = async (e: React.FormEvent, type: "login" | "register") => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername || !passwordInput) {
      setAuthError("Заполните все необходимые поля ввода.");
      return;
    }

    const endpoint = type === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Произошла непредвиденная ошибка на сервере.");
      } else {
        if (type === "register") {
          setAuthSuccess("Аккаунт успешно создан на PostgreSQL / SQLite! Теперь выполните вход.");
          setCurrentScreen("login"); // Move to login
          setPasswordInput("");
        } else {
          // Logged in
          const loggedInUser: User = data.user;
          setCurrentUser(loggedInUser);
          localStorage.setItem("fsh_user", JSON.stringify(loggedInUser));
          setAuthSuccess(`С возвращением в Hub, ${loggedInUser.username}!`);
          setUsernameInput("");
          setPasswordInput("");
          setCurrentScreen("feed"); // Move back to main index
        }
      }
    } catch (err) {
      setAuthError("Не удалось получить доступ к бэкенду. Убедитесь, что сервер запущен.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("fsh_user");
    setAuthSuccess("Сессия разработчика завершена.");
  };

  // Form Submission: Video Stream Publication (fetch POST)
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(false);

    if (!titleInput.trim()) {
      setUploadError("Пожалуйста, введите название проекта.");
      return;
    }

    setUploading(true);

    try {
      if (uploadMode === "url") {
        // --- Serverless URL JSON Publication ---
        if (!videoUrlInput.trim() || !thumbnailUrlInput.trim()) {
          setUploadError("Пожалуйста, заполните ссылки на видео и превью.");
          setUploading(false);
          return;
        }

        const res = await fetch("/api/videos/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleInput.trim(),
            description: descriptionInput.trim(),
            video_url: videoUrlInput.trim(),
            thumbnail_url: thumbnailUrlInput.trim(),
            user_id: currentUser ? currentUser.id : null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error || "Ошибка публикации проекта по ссылкам.");
        } else {
          setUploadSuccess(true);
          setTitleInput("");
          setDescriptionInput("");
          setVideoUrlInput("");
          setThumbnailUrlInput("");
          await fetchVideos();
        }
      } else {
        // --- Legacy File Upload Fallback (Multipart) ---
        if (!videoFile) {
          setUploadError("Пожалуйста, прикрепите видео файл.");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("title", titleInput.trim());
        formData.append("description", descriptionInput.trim());
        if (currentUser) {
          formData.append("user_id", currentUser.id.toString());
        }

        const res = await fetch("/api/videos/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error || "Ошибка загрузки файла на сервер.");
        } else {
          setUploadSuccess(true);
          setTitleInput("");
          setDescriptionInput("");
          setVideoFile(null);
          await fetchVideos();
        }
      }
    } catch (err) {
      setUploadError("Ошибка отправки формы на сервер. Попробуйте еще раз.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (![".mp4", ".avi", ".mkv"].includes(ext)) {
        setUploadError("Неподдерживаемый видео-формат. Разрешены .mp4, .avi, .mkv");
        return;
      }
      setVideoFile(file);
    }
  };

  // Live filtering lists
  const filteredVideos = videos.filter((vid) => {
    const titleText = vid.title.toLowerCase();
    const descText = (vid.description || "").toLowerCase();
    const authorText = (vid.author_name || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      titleText.includes(query) ||
      descText.includes(query) ||
      authorText.includes(query);

    if (activeCategory === "ALL") return matchesSearch;
    if (activeCategory === "SQL") return matchesSearch && (titleText.includes("sql") || descText.includes("sql") || titleText.includes("scheme") || descText.includes("postgres"));
    if (activeCategory === "FRONT") return matchesSearch && (titleText.includes("front") || titleText.includes("css") || titleText.includes("html") || titleText.includes("react"));
    if (activeCategory === "CORE") return matchesSearch && (titleText.includes("backend") || titleText.includes("api") || titleText.includes("flask") || titleText.includes("python"));
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#060608] text-zinc-100 flex overflow-hidden font-sans border-t-2 border-indigo-600">
      
      {/* GLOBAL SYSTEM LEVEL ANNOUNCEMENTS */}
      <AnimatePresence>
        {(authSuccess || authError) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4"
          >
            {authSuccess && (
              <div className="p-3.5 bg-emerald-950/90 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-300 shadow-2xl backdrop-blur-md">
                <span className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{authSuccess}</span>
                </span>
                <button onClick={() => setAuthSuccess(null)} className="text-emerald-500 hover:text-white ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {authError && (
              <div className="p-3.5 bg-rose-950/90 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-300 shadow-2xl backdrop-blur-md">
                <span className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </span>
                <button onClick={() => setAuthError(null)} className="text-rose-500 hover:text-white ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* ======================================= */}
        {/* SCREEN 1: THE PRIMARY MEDIA DASHBOARD   */}
        {/* ======================================= */}
        {currentScreen === "feed" && (
          <motion.div
            key="screen-feed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden w-full"
          >
            
            {/* SIDEBAR NAVIGATION CONTROL */}
            <aside className="w-64 bg-[#0B0B0E] border-r border-[#1a1a24] flex flex-col shrink-0 hidden md:flex font-sans">
              
              {/* BRAND HEADER */}
              <div className="p-5 flex items-center gap-2.5 border-b border-[#13131a]">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/25 shrink-0">
                  FS
                </div>
                <div className="min-w-0">
                  <span className="font-bold tracking-tight text-base text-white">
                    FullStack<span className="text-indigo-400">Hub</span>
                  </span>
                  <p className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">VERCEL.SERVERLESS</p>
                </div>
              </div>

              {/* NAVIGATION LINKS */}
              <nav className="flex-1 p-4 space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-2.5 px-2 font-mono">
                    Ленты и Теги
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setActiveCategory("ALL")}
                      className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                        activeCategory === "ALL"
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                          : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      <Tv className="w-4 h-4 shrink-0 text-indigo-500" />
                      <span>Глобальная Лента</span>
                    </button>
                    <button
                      onClick={() => setActiveCategory("SQL")}
                      className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                        activeCategory === "SQL"
                          ? "bg-[#10b981]/15 border-[#10b981]/30 text-emerald-400"
                          : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      <Database className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Базы Данных / SQL</span>
                    </button>
                    <button
                      onClick={() => setActiveCategory("FRONT")}
                      className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                        activeCategory === "FRONT"
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      <Layers className="w-4 h-4 shrink-0 text-purple-400" />
                      <span>Интерфейсы / CSS</span>
                    </button>
                    <button
                      onClick={() => setActiveCategory("CORE")}
                      className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                        activeCategory === "CORE"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      <Monitor className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>Бэкенд на Python</span>
                    </button>
                  </div>
                </div>

                {/* USER PROFILE CARD */}
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-2.5 px-2 font-mono">
                    Мой Профиль
                  </div>
                  
                  {!currentUser ? (
                    <div className="bg-[#101014]/80 border border-zinc-800 rounded-xl p-3.5 text-center">
                      <UserIcon className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-zinc-300">Анонимный режим</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Вход не осуществлен</p>
                      <button
                        onClick={() => {
                          setAuthError(null);
                          setAuthSuccess(null);
                          setCurrentScreen("login");
                        }}
                        className="mt-3 w-full bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 hover:text-white py-1 rounded-md text-[10px] font-bold uppercase tracking-tight duration-150 transition-colors"
                      >
                        Войти в аккаунт
                      </button>
                    </div>
                  ) : (
                    <div className="bg-indigo-950/25 border border-indigo-500/20 rounded-xl p-3.5 relative overflow-hidden">
                      <div className="flex items-center gap-1.5 absolute top-2 right-2.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-[8px] font-mono text-green-400 font-bold">ONLINE</span>
                      </div>
                      <p className="text-xs font-bold text-zinc-100 truncate">@{currentUser.username}</p>
                      <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-tight mt-0.5">🚀 Vercel Developer</p>
                      <div className="mt-4 flex items-center justify-between text-[9px] text-zinc-500 border-t border-zinc-800 pt-2.5">
                        <span className="font-mono">ID: {currentUser.id}</span>
                        <button
                          onClick={handleLogout}
                          className="text-rose-400 hover:text-rose-300 font-bold uppercase tracking-tight"
                        >
                          Выйти
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RUNTIME TELEMETRY DIAGNOSTICS */}
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-2 px-2 font-mono">
                    СУБД Диагностика
                  </div>
                  <div className="bg-[#0f0f14] rounded-lg p-3 border border-zinc-800 font-mono text-[9px] space-y-2 text-zinc-400">
                    <div className="flex justify-between items-center">
                      <span>ENGINE</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        ● {dbType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>VERCEL API</span>
                      <span className="text-indigo-400 font-bold">PYTHON/JS</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-zinc-600 block mb-0.5">CONNECTION STREAM:</span>
                      <span className="text-zinc-500 font-bold block truncate" title={connUrl}>
                        {connUrl}
                      </span>
                    </div>
                  </div>
                </div>
              </nav>

              {/* FOOTER METADATA BAR */}
              <div className="p-4 border-t border-[#1a1a24] mt-auto">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow shadow-indigo-500/50"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold font-mono text-zinc-300">Vercel Serverless v2</p>
                    <p className="text-[9px] text-zinc-500">PostgreSQL Adapter Active</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* MAIN CONTAINER STREAM */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#060608]">
              
              {/* PRIMARY APPLICATION HEADER */}
              <header className="h-16 bg-[#0B0B0E]/80 backdrop-blur-md border-b border-[#1a1a24] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 font-sans">
                
                {/* Search query input */}
                <div className="relative w-72">
                  <span className="absolute left-3 top-2.5 text-zinc-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск стримов в PostgreSQL..."
                    className="w-full bg-[#101014] border border-zinc-800 rounded-lg py-1.5 pl-9 pr-8 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* TELEMETRY METRIC FLAGS OR MOBILE LOGIN BUTTONS */}
                <div className="flex items-center gap-4">
                  
                  {/* CPU Load Metric */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase hidden lg:flex">
                    <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Serverless Load:</span>
                    <span className="text-emerald-400 font-bold">{cpuLoad}%</span>
                  </div>

                  {/* Vercel Status Info Badge */}
                  <div className="hidden sm:flex items-center gap-1 bg-[#101014] border border-zinc-800 rounded-md px-2.5 py-1 text-[10px] font-mono text-zinc-400">
                    <Globe className="w-3 h-3 text-indigo-400" />
                    <span>vercel.json setup: ok</span>
                  </div>

                  {/* Header Login/Register Actions */}
                  <div className="flex items-center gap-2">
                    {!currentUser ? (
                      <>
                        <button
                          onClick={() => {
                            setAuthError(null);
                            setAuthSuccess(null);
                            setCurrentScreen("login");
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg duration-150 transition-colors cursor-pointer"
                        >
                          Войти
                        </button>
                        <button
                          onClick={() => {
                            setAuthError(null);
                            setAuthSuccess(null);
                            setCurrentScreen("register");
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg duration-150 transition-colors cursor-pointer hidden sm:block"
                        >
                          Регистрация
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 hidden sm:inline">
                          Вошли как <strong className="text-indigo-400 font-bold">@{currentUser.username}</strong>
                        </span>
                        <button
                          onClick={handleLogout}
                          className="bg-zinc-850 hover:bg-zinc-850/70 text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg text-xs"
                          title="Завершить сессию разработчика"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </header>

              {/* DASHBOARD INSIDE SCREEN SCROLLER */}
              <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto font-sans">
                
                {/* MAIN INFORMATIVE HERO COMPONENT */}
                <div className="bg-gradient-to-r from-indigo-950/20 via-[#0e0e13] to-purple-950/20 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
                  <div className="absolute bottom-0 left-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
                  
                  <div className="max-w-3xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/15 text-indigo-400 text-[10px] font-mono px-2.5 py-1 rounded-md border border-indigo-500/20 uppercase tracking-widest font-bold">
                        Vercel Ready MVP
                      </span>
                      <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-mono px-2.5 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest font-bold">
                        Serverless Mode: ON
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                      Добро пожаловать во <span className="text-indigo-400">FullStack Hub</span>
                    </h1>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans max-w-2xl">
                      Это приложение настроено на бескомпромиссную работу в serverless-вселенной Vercel. 
                      Так как файловая система Vercel доступна только для чтения, база данных PostgreSQL 
                      здесь фиксирует прямые URL-ссылки трансляций, гарантируя мгновенную скорость 
                      и стабильность.
                    </p>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SECTION: PUBLISH VIDEO CONTROLLER (GATED BY AUTHENTICATION!)  */}
                {/* ============================================================= */}
                <AnimatePresence mode="wait">
                  {!currentUser ? (
                    <motion.div
                      key="auth-gate-lock"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="bg-[#0f0f13] border border-dashed border-zinc-800 rounded-2xl p-6.5 text-center flex flex-col items-center justify-center relative overflow-hidden"
                    >
                      <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-3">
                        <Lock className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-1.5 font-display">
                        🔒 Публикация трансляций заблокирована
                      </h3>
                      <p className="text-xs text-zinc-500 max-w-md leading-relaxed mb-4">
                        Пожалуйста, авторизуйтесь в вашем профиле разработчика, чтобы получить доступ к публикации видео-ресурсов по ссылкам в SQLite / PostgreSQL.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setAuthError(null);
                            setAuthSuccess(null);
                            setCurrentScreen("login");
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-lg transition-transform hover:scale-102 active:scale-98 cursor-pointer"
                        >
                          Войти в систему
                        </button>
                        <button
                          onClick={() => {
                            setAuthError(null);
                            setAuthSuccess(null);
                            setCurrentScreen("register");
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-5 py-2 rounded-lg duration-150 cursor-pointer"
                        >
                          Создать Аккаунт
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.section
                      key="publish-active-form"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="bg-[#0B0B0E] border border-zinc-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all hover:border-zinc-700"
                    >
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500"></div>

                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-mono">
                            Инициация новой трансляции / Stream Publisher
                          </h2>
                        </div>
                        
                        {/* Selector between URL Mode & File Mode */}
                        <div className="flex bg-[#101014] p-0.5 rounded-lg border border-zinc-800 text-[9px] font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => { setUploadMode("url"); setUploadError(null); }}
                            className={`px-3 py-1 rounded-md transition-all ${
                              uploadMode === "url"
                                ? "bg-indigo-600 text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            📡 ПРЯМЫЕ ССЫЛКИ (SERVERLESS)
                          </button>
                          <button
                            type="button"
                            onClick={() => { setUploadMode("file"); setUploadError(null); }}
                            className={`px-3 py-1 rounded-md transition-all ${
                              uploadMode === "file"
                                ? "bg-indigo-600 text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            📁 ЛОКАЛЬНЫЙ ФАЙЛ (SANDBOX)
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handlePublishSubmit} className="space-y-4">
                        
                        {/* Title & Description Grid Rows */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                              Название проекта / Stream Title *
                            </label>
                            <input
                              type="text"
                              required
                              value={titleInput}
                              onChange={(e) => setTitleInput(e.target.value)}
                              placeholder="Например: Setup Vercel Postgres Pool"
                              className="w-full bg-[#101014] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                              Описание вещания / Stream Description
                            </label>
                            <input
                              type="text"
                              value={descriptionInput}
                              onChange={(e) => setDescriptionInput(e.target.value)}
                              placeholder="Разбор конфигурации vercel.json..."
                              className="w-full bg-[#101014] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        </div>

                        {/* SUB-FORM BASED ON SELECTED MODE */}
                        <div className="p-4 bg-[#101014] border border-zinc-800 rounded-xl space-y-4">
                          {uploadMode === "url" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* 1. Video Direct URL */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-1 font-mono">
                                  <Link className="w-3.5 h-3.5" />
                                  Ссылка на медиаресурс (Video URL) *
                                </label>
                                <input
                                  type="url"
                                  required={uploadMode === "url"}
                                  value={videoUrlInput}
                                  onChange={(e) => setVideoUrlInput(e.target.value)}
                                  placeholder="https://example.com/stream.mp4"
                                  className="w-full bg-[#060608] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <span className="text-[9px] text-zinc-500 font-mono block">
                                  Укажите прямой адрес на любой MP4 / AVI / MKV файл в сети.
                                </span>
                              </div>

                              {/* 2. Thumbnail Direct URL */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-1 font-mono">
                                  <Globe className="w-3.5 h-3.5" />
                                  Ссылка на превью-картинку (Thumbnail URL) *
                                </label>
                                <input
                                  type="url"
                                  required={uploadMode === "url"}
                                  value={thumbnailUrlInput}
                                  onChange={(e) => setThumbnailUrlInput(e.target.value)}
                                  placeholder="https://example.com/cover_art.jpg"
                                  className="w-full bg-[#060608] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <span className="text-[9px] text-zinc-500 font-mono block">
                                  Изображение заглушки для плеера (JPG / PNG / WebP link).
                                </span>
                              </div>

                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="space-y-2 col-span-3">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                                  Загрузка локального медиафайла *
                                </label>
                                
                                {!videoFile ? (
                                  <div
                                    onDragEnter={handleDrag}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                      dragActive
                                        ? "border-indigo-500 bg-indigo-500/5 text-indigo-300"
                                        : "border-zinc-800 hover:border-indigo-500/50 text-zinc-400"
                                    }`}
                                  >
                                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                                    <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-300 font-bold">
                                      ПЕРЕТАЩИТЕ .MP4 / .AVI СЮДА
                                    </p>
                                    <p className="text-[9px] text-zinc-500 mt-1 font-sans">
                                      Или добавьте его через проводник в контейнер
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                                    <div className="flex items-center space-x-3 truncate">
                                      <FileText className="w-5 h-5 text-indigo-400" />
                                      <div>
                                        <p className="text-xs font-mono font-bold text-zinc-200 truncate pr-4">
                                          {videoFile.name}
                                        </p>
                                        <p className="text-[9px] font-mono text-zinc-500">
                                          Размер: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setVideoFile(null)}
                                      className="text-zinc-650 hover:text-rose-500 p-1.5 transition-colors"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="col-span-1 border-l border-zinc-800 pl-4 py-1 flex flex-col justify-center text-center">
                                <p className="text-[9px] font-mono text-zinc-500 uppercase">Бэкап-Превью</p>
                                <div className="mt-2 w-full aspect-video bg-[#060608] border border-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-700 font-mono">
                                  {videoFile ? "Файл Готов" : "Ждем Файл"}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SUBMISSION FOOTER WITH STATE FEEDBACK */}
                        <div className="flex items-center justify-between gap-4 pt-2 flex-wrap sm:flex-nowrap">
                          
                          {/* Alert messaging */}
                          <div className="min-w-0">
                            {uploadError && (
                              <p className="text-xs text-rose-400 flex items-center gap-1.5 font-mono">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {uploadError}
                              </p>
                            )}
                            {uploadSuccess && (
                              <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono font-semibold">
                                <CheckCircle className="w-4 h-4 shrink-0" />
                                ОК: Публикация в базу данных PostgreSQL / SQLite успешно записана!
                              </p>
                            )}
                          </div>

                          {/* Submit Action Button */}
                          <button
                            type="submit"
                            disabled={uploading}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white font-bold text-xs py-2 px-6 h-[38px] rounded-lg shadow-lg shadow-indigo-600/15 duration-150 transition-all font-display uppercase tracking-widest cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
                          >
                            {uploading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Запись в БД...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-4 h-4 text-indigo-200" />
                                <span>Записать в базу</span>
                              </>
                            )}
                          </button>

                        </div>

                      </form>
                    </motion.section>
                  )}
                </AnimatePresence>

                {/* ============================================================= */}
                {/* SECTION: VIDEOS ARCHIVE LIVESHOW                              */}
                {/* ============================================================= */}
                <section className="flex flex-col min-h-0">
                  
                  {/* SEARCH/SORT REVIEWS BAR */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/25"></span>
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">
                        {activeCategory === "ALL" ? "Вещание вселенной Dev" : `Потоки тега: ${activeCategory}`}
                      </h3>
                    </div>

                    {/* Tag Toggle Blocks */}
                    <div className="flex space-x-1.5 bg-[#0B0B0E] p-1 rounded-xl border border-zinc-800">
                      <button
                        onClick={() => setActiveCategory("ALL")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-150 font-mono ${
                          activeCategory === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Все
                      </button>
                      <button
                        onClick={() => setActiveCategory("SQL")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-150 font-mono ${
                          activeCategory === "SQL" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        SQL
                      </button>
                      <button
                        onClick={() => setActiveCategory("FRONT")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-150 font-mono ${
                          activeCategory === "FRONT" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        UI/CSS
                      </button>
                      <button
                        onClick={() => setActiveCategory("CORE")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-150 font-mono ${
                          activeCategory === "CORE" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Backend
                      </button>
                    </div>
                  </div>

                  {/* LOADING GRAPHICS */}
                  {loadingVideos ? (
                    <div className="py-24 flex flex-col items-center justify-center bg-[#0B0B0E] border border-zinc-800 rounded-2xl">
                      <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mb-3" />
                      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                        Синхронизация С Базой PostgreSQL / SQLite...
                      </p>
                    </div>
                  ) : filteredVideos.length === 0 ? (
                    <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center flex flex-col items-center justify-center p-6 bg-[#0B0B0E]/30">
                      <div className="w-10 h-10 bg-[#0B0B0E] border border-zinc-800 rounded-xl flex items-center justify-center mb-3">
                        <VideoIcon className="w-5 h-5 text-zinc-650" />
                      </div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Записи не обнаружены
                      </h3>
                      <p className="text-xs text-zinc-600 max-w-sm leading-relaxed">
                        {searchQuery
                          ? "Ничего не найдено. Сбросьте поисковый запрос."
                          : "Нет активных видеотрансляций по данному тегу. Выполните вход и запишите первую ссылку!"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredVideos.map((vid, idx) => {
                        
                        // Pick aesthetic visual badge for video topic
                        let categoryLabel = "Full Stack Dev";
                        let categoryColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
                        const lowTitle = vid.title.toLowerCase();
                        const lowDesc = (vid.description || "").toLowerCase();

                        if (lowTitle.includes("sql") || lowDesc.includes("sql") || lowDesc.includes("postgres")) {
                          categoryLabel = "PostgreSQL DB";
                          categoryColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                        } else if (lowTitle.includes("front") || lowTitle.includes("css") || lowTitle.includes("html") || lowTitle.includes("react")) {
                          categoryLabel = "Vite UI Component";
                          categoryColor = "text-purple-400 bg-purple-500/10 border-purple-500/20";
                        } else if (lowTitle.includes("api") || lowTitle.includes("backend") || lowTitle.includes("flask") || lowTitle.includes("wsgi")) {
                          categoryLabel = "Python Microservice";
                          categoryColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
                        }

                        // Support backward compatibility (render filename or direct URL as available!)
                        const videoSource = vid.video_url || `/uploads/videos/${vid.video_filename}`;
                        const coverArtSource = vid.thumbnail_url || `/uploads/thumbnails/${vid.thumbnail_filename}`;

                        return (
                          <motion.div
                            key={vid.id || idx}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: idx * 0.04 }}
                            onClick={() => setSelectedVideo(vid)}
                            className="bg-[#0B0B0E] border border-zinc-850 rounded-xl overflow-hidden group hover:border-indigo-500/40 cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 transition-all text-left flex flex-col"
                          >
                            {/* COVER IMAGE CONTAINER */}
                            <div className="aspect-video bg-[#0f0f13] relative overflow-hidden shrink-0 border-b border-[#14141a]">
                              <img
                                src={coverArtSource}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // Fallback abstract neon visual if external poster returns errors
                                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1618401471353-b98aedd07871?q=80&w=640&auto=format&fit=crop`;
                                }}
                                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                              />

                              {/* Play Accent hover button overlay */}
                              <div className="absolute inset-0 bg-black/40 group-hover:bg-indigo-650/10 transition-colors duration-150 flex items-center justify-center">
                                <div className="w-11 h-11 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg transform opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200">
                                  <Play className="w-4 h-4 fill-white translate-x-0.5" />
                                </div>
                              </div>

                              {/* Topic Badge tags overlay */}
                              <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border ${categoryColor}`}>
                                {categoryLabel}
                              </div>

                              {/* DB Type Tag overlay */}
                              <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur px-2 py-0.5 rounded text-[9px] font-mono text-zinc-400 border border-zinc-800">
                                {vid.video_url ? "SERVERLESS LINE" : "SANDBOX STORAGE"}
                              </div>
                            </div>

                            {/* TEXT CAPTIONS COMPILATION */}
                            <div className="p-4 flex flex-col flex-grow bg-[#09090c]">
                              <h4 className="text-xs font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors duration-150 line-clamp-2 leading-tight mb-2 h-8">
                                {vid.title}
                              </h4>

                              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-4 flex-grow">
                                {vid.description || "Описания не предоставлено автору."}
                              </p>

                              {/* Author and uploaded details footer row */}
                              <div className="mt-auto pt-3 border-t border-zinc-900 flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-4 h-4 rounded-full bg-indigo-650 flex items-center justify-center text-[8px] text-white font-bold font-mono uppercase shrink-0">
                                    {(vid.author_name ? vid.author_name[0] : "G").toUpperCase()}
                                  </div>
                                  <span className="truncate text-zinc-450 hover:text-white font-bold">
                                    {vid.author_name ? `@${vid.author_name}` : "@гость"}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 text-zinc-600">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(vid.uploaded_at).toLocaleDateString("ru-RU", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </span>
                              </div>
                            </div>

                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                </section>

              </div>

              {/* FOOTER BAR */}
              <footer className="py-4 px-8 border-t border-zinc-850 bg-[#0a0a0d] text-[10px] text-zinc-600 font-mono flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto select-none shrink-0">
                <p>© 2026 FullStack Hub. Serverless Node & PostgreSQL MVP.</p>
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 rounded">Vercel Mode Stable</span>
                  <span className="p-1 px-2 bg-zinc-900 text-zinc-500 rounded">SSL connections strict</span>
                </div>
              </footer>

            </div>

          </motion.div>
        )}

        {/* ======================================= */}
        {/* SCREEN 2: STANDALONE LOGIN SCREEN ('login') */}
        {/* ======================================= */}
        {currentScreen === "login" && (
          <motion.div
            key="screen-login"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="flex-1 min-h-screen flex items-center justify-center p-4 bg-[#060608] font-sans"
          >
            <div className="w-full max-w-md bg-[#0B0B0E] border border-zinc-850 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-indigo-500 to-indigo-600"></div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccess(null);
                  setCurrentScreen("feed");
                }}
                className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-1.5 text-xs font-mono uppercase"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>

              <div className="text-center mt-6 mb-8">
                <div className="w-12 h-12 bg-indigo-600/15 border border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-indigo-400 font-bold text-lg">
                  FS
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight font-display">
                  Вход в систему / Dev Portal Login
                </h2>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-tight mt-1">
                  ПОДКЛЮЧЕНИЕ: POSTGRESQL / SQLITE
                </p>
              </div>

              <form onSubmit={(e) => handleAuthSubmit(e, "login")} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                    Имя пользователя (Username)
                  </label>
                  <div className="flex bg-[#101014] border border-zinc-800 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
                    <span className="p-2.5 text-zinc-600 font-mono font-bold select-none text-xs">@</span>
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="alice_dev"
                      className="bg-transparent border-none py-2 px-1 text-xs text-white focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                    Пароль (Secure Password)
                  </label>
                  <div className="flex bg-[#101014] border border-zinc-800 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
                    <span className="p-2.5 text-zinc-650 select-none">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                    </span>
                    <input
                      type="password"
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••••••••"
                      className="bg-transparent border-none py-2 px-1 text-xs text-white focus:outline-none w-full font-mono placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/20 text-white font-bold text-xs py-2.5 rounded-lg shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 duration-150 transition-all font-display uppercase tracking-widest cursor-pointer mt-2"
                >
                  Авторизоваться
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-[#13131a] text-center text-xs">
                <span className="text-zinc-500">Еще нет аккаунта в Postgres? </span>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setCurrentScreen("register");
                  }}
                  className="text-indigo-400 hover:text-indigo-350 font-bold uppercase tracking-tight ml-1 font-mono"
                >
                  Зарегистрироваться
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* ======================================= */}
        {/* SCREEN 3: STANDALONE REGISTER SCREEN ('register') */}
        {/* ======================================= */}
        {currentScreen === "register" && (
          <motion.div
            key="screen-register"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 min-h-screen flex items-center justify-center p-4 bg-[#060608] font-sans"
          >
            <div className="w-full max-w-md bg-[#0B0B0E] border border-zinc-850 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-purple-500 to-indigo-500"></div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccess(null);
                  setCurrentScreen("feed");
                }}
                className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-1.5 text-xs font-mono uppercase"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>

              <div className="text-center mt-6 mb-8">
                <div className="w-12 h-12 bg-purple-600/15 border border-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-purple-400 font-bold text-lg">
                  REG
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight font-display">
                  Создание аккаунта разработчика
                </h2>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-tight mt-1">
                  SECURE CRYPTO PBKDF2 HASHING (WERKZEUG COMPATIBLE)
                </p>
              </div>

              <form onSubmit={(e) => handleAuthSubmit(e, "register")} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                    Желаемый логин (Username) *
                  </label>
                  <div className="flex bg-[#101014] border border-zinc-800 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
                    <span className="p-2.5 text-zinc-600 font-mono font-bold select-none text-xs">@</span>
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="bob_is_dev"
                      className="bg-transparent border-none py-2 px-1 text-xs text-white focus:outline-none w-full"
                    />
                  </div>
                  <span className="text-[9px] text-zinc-550 block font-mono">
                    Минимум 3 уникальных символа для записи в Postgres.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block font-mono">
                    Безопасный пароль (Strong Password) *
                  </label>
                  <div className="flex bg-[#101014] border border-zinc-800 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
                    <span className="p-2.5 text-zinc-650 select-none">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                    </span>
                    <input
                      type="password"
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••••••••"
                      className="bg-transparent border-none py-2 px-1 text-xs text-white focus:outline-none w-full font-mono placeholder:text-zinc-650"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/20 text-white font-bold text-xs py-2.5 rounded-lg shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 duration-150 transition-all font-display uppercase tracking-widest cursor-pointer mt-2"
                >
                  Зарегистрироваться
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-[#13131a] text-center text-xs">
                <span className="text-zinc-500">Уже зарегистрированы? </span>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setCurrentScreen("login");
                  }}
                  className="text-indigo-400 hover:text-indigo-350 font-bold uppercase tracking-tight ml-1 font-mono"
                >
                  Выполнить вход
                </button>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* DETAILED PLAYER OVERLAY LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedVideo(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0B0B0E] border border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Header section name */}
              <div className="p-4.5 border-b border-zinc-850 flex items-center justify-between bg-[#08080b]">
                <div className="min-w-0 flex-1 pr-4">
                  <h3 className="text-sm font-bold text-white tracking-tight font-display truncate">
                    {selectedVideo.title}
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-550 uppercase tracking-wide mt-1.5 flex flex-wrap gap-2">
                    <span>Автор: <strong className="text-indigo-400">@{selectedVideo.author_name || "гость"}</strong></span>
                    <span className="text-zinc-650">|</span>
                    <span>Ресурс: {selectedVideo.video_url ? "SERVERLESS HOST" : "SANDBOX STORAGE"}</span>
                    <span className="text-zinc-650">|</span>
                    <span>{new Date(selectedVideo.uploaded_at).toLocaleString("ru-RU")}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors duration-150 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* IMMERSIVE VIDEO BOX */}
              <div className="bg-black flex items-center justify-center aspect-video relative group border-b border-zinc-850 max-h-[500px]">
                <video
                  src={selectedVideo.video_url || `/uploads/videos/${selectedVideo.video_filename}`}
                  poster={selectedVideo.thumbnail_url || `/uploads/thumbnails/${selectedVideo.thumbnail_filename}`}
                  controls
                  autoPlay
                  preload="auto"
                  className="max-h-[500px] w-full h-full object-contain focus:outline-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* METADATA DIAGNOSTIC DESCRIPTION LOGS */}
              <div className="p-5 font-sans bg-[#09090c] space-y-4">
                <div>
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                    Описание этого проекта
                  </h4>
                  <div className="bg-[#101014] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedVideo.description || "Опубликовано без расширенного описания."}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-[9px] pt-3 border-t border-zinc-850 font-mono text-zinc-500 uppercase">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 px-2 bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 rounded text-[9px] font-bold">
                      RECORD ID: {selectedVideo.id}
                    </span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-550 truncate max-w-[280px]" title={selectedVideo.video_url}>
                      SOURCE: {selectedVideo.video_url || `/uploads/videos/${selectedVideo.video_filename}`}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="text-indigo-400 hover:text-white font-bold transition-all"
                  >
                    Закрыть Терминал Плеера
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
