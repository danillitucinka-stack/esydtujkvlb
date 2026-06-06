import React, { useState, useEffect, useRef } from "react";
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
  Star
} from "lucide-react";
import { User, Video } from "./types";

export default function App() {
  // Global App States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("fsh_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Authentication States
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Upload States
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(() => null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Client-Side Auto-Extract Thumbnail preview states
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);

  // Player overlay modal path
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Setup refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // System stats generator for High Density dashboard theme
  const [cpuLoad, setCpuLoad] = useState(18);
  const [ramUsage, setRamUsage] = useState(1.1);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(Math.floor(12 + Math.random() * 15));
      setRamUsage(parseFloat((1.0 + Math.random() * 0.3).toFixed(2)));
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Fetch all videos from backend SQLite storage
  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      } else {
        console.error("Failed to load videos from SQLite database");
      }
    } catch (err) {
      console.error("Error communicating with full-stack endpoints:", err);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Handle Client Auth submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername || !passwordInput) {
      setAuthError("Заполните все необходимые поля ввода.");
      return;
    }

    const endpoint = authTab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Произошла непредвиденная ошибка авторизации.");
      } else {
        if (authTab === "register") {
          setAuthSuccess("Аккаунт успешно создан! Войдите под своим паролем.");
          setAuthTab("login");
          setPasswordInput("");
        } else {
          // Logged in
          const loggedInUser: User = data.user;
          setCurrentUser(loggedInUser);
          localStorage.setItem("fsh_user", JSON.stringify(loggedInUser));
          setAuthSuccess(`С возвращением, ${loggedInUser.username}!`);
          setUsernameInput("");
          setPasswordInput("");
        }
      }
    } catch (err) {
      setAuthError("Не удалось связаться с сервером FullStack Hub.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("fsh_user");
    setAuthSuccess("Сессия завершена.");
  };

  // Automated client-side frame extraction at 2.0s using HTML5 Video playback
  const extractVideoFrame = (file: File) => {
    setIsCapturingFrame(true);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const targetTime = Math.min(2, video.duration || 0);
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                setThumbnailBlob(blob);
                const localImgUrl = URL.createObjectURL(blob);
                setThumbnailPreviewUrl(localImgUrl);
              }
              setIsCapturingFrame(false);
            },
            "image/jpeg",
            0.85
          );
        } else {
          setIsCapturingFrame(false);
        }
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.error("Failed to capture frame client-view:", err);
        setIsCapturingFrame(false);
      }
    };

    video.onerror = () => {
      console.warn("Could not extract frame client side. Relying on fallback mechanisms.");
      setIsCapturingFrame(false);
      URL.revokeObjectURL(objectUrl);
    };
  };

  // Video drop or change handling
  const handleFileChange = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".mp4", ".avi", ".mkv"].includes(ext)) {
      setUploadError("Неподдерживаемый видео-формат. Разрешены только: .mp4, .avi, .mkv");
      return;
    }
    setUploadError(null);
    setVideoFile(file);
    extractVideoFrame(file);
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
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Upload Form Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(false);

    if (!titleInput.trim()) {
      setUploadError("Введите название вашего видео.");
      return;
    }
    if (!videoFile) {
      setUploadError("Выберите или перетащите файл видео.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", titleInput.trim());
    formData.append("description", descriptionInput.trim());
    if (currentUser) {
      formData.append("user_id", currentUser.id.toString());
    }

    if (thumbnailBlob) {
      formData.append("thumbnail", thumbnailBlob, "frame_2s.jpg");
    }

    try {
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Ошибка загрузки видео на сервер.");
      } else {
        setUploadSuccess(true);
        setTitleInput("");
        setDescriptionInput("");
        setVideoFile(null);
        setThumbnailBlob(null);
        setThumbnailPreviewUrl(null);
        await fetchVideos();
      }
    } catch (err) {
      setUploadError("Ошибка подключения к серверу при отправке.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveSelectedFile = () => {
    setVideoFile(null);
    setThumbnailPreviewUrl(null);
    setThumbnailBlob(null);
  };

  // Frontend Live Filtering and Search
  const filteredVideos = videos.filter((vid) => {
    const matchesSearch =
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vid.description && vid.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vid.author_name && vid.author_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeCategory === "ALL") return matchesSearch;
    if (activeCategory === "SQL") return matchesSearch && (vid.title.toUpperCase().includes("SQL") || (vid.description && vid.description.toUpperCase().includes("SQL")));
    if (activeCategory === "FRONT") return matchesSearch && (vid.title.toUpperCase().includes("FRONT") || vid.title.toUpperCase().includes("CSS") || vid.title.toUpperCase().includes("HTML") || vid.title.toUpperCase().includes("JS"));
    if (activeCategory === "CORE") return matchesSearch && (vid.title.toUpperCase().includes("FLASK") || vid.title.toUpperCase().includes("DOCKER") || vid.title.toUpperCase().includes("BACKEND") || vid.title.toUpperCase().includes("API"));
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex overflow-hidden font-sans border-t-2 border-indigo-500">
      
      {/* 1. LEFT SIDEBAR CONSOLE */}
      <aside className="w-64 bg-[#121212] border-r border-[#222] flex flex-col shrink-0 hidden md:flex font-sans">
        
        {/* LOGO & BRAND */}
        <div className="p-5 flex items-center gap-2.5 border-b border-[#222]">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/10 shrink-0">
            FS
          </div>
          <div className="min-w-0">
            <span className="font-bold tracking-tight text-base font-display text-white">
              FullStack<span className="text-indigo-500">Hub</span>
            </span>
            <p className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">DEV.SOCIAL.HOSTING</p>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 p-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#555] font-bold mb-2.5 px-2 font-mono">
              Навигация
            </div>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveCategory("ALL"); }}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                  activeCategory === "ALL"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Tv className="w-4 h-4 shrink-0" />
                <span>Глобальная Лента</span>
              </button>
              <button
                onClick={() => { setActiveCategory("SQL"); }}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                  activeCategory === "SQL"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Базы Данных / SQL</span>
              </button>
              <button
                onClick={() => { setActiveCategory("FRONT"); }}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                  activeCategory === "FRONT"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Интерфейсы / CSS</span>
              </button>
              <button
                onClick={() => { setActiveCategory("CORE"); }}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                  activeCategory === "CORE"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span>Бэкенд на Python</span>
              </button>
            </div>
          </div>

          {/* ACTIVE ACCOUNT METADATA BANNER */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#555] font-bold mb-2.5 px-2 font-mono">
              Управление Сессией
            </div>
            
            <AnimatePresence mode="wait">
              {!currentUser ? (
                <motion.div
                  key="guest-card"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-[#18181b]/50 border border-[#2d2d30] rounded-lg p-3 text-center"
                >
                  <UserIcon className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                  <p className="text-[11px] text-zinc-400">Режим Гостя</p>
                  <p className="text-[9px] text-[#555] font-mono mt-0.5">Публикация анонимная</p>
                </motion.div>
              ) : (
                <motion.div
                  key="pro-card"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-indigo-950/20 border border-indigo-500/25 rounded-lg p-3 relative overflow-hidden"
                >
                  <div className="absolute top-1 right-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[8px] font-mono text-green-400">ON</span>
                  </div>
                  <p className="text-xs font-bold text-white max-w-[140px] truncate">@{currentUser.username}</p>
                  <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-tight mt-0.5">FullStack Creator</p>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 border-t border-[#2d2d30] pt-2">
                    <span className="font-mono">ID: {currentUser.id}</span>
                    <button
                      onClick={handleLogout}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      Выход
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RUNTIME STATUS PANEL */}
          <div className="pt-4 border-t border-[#222]">
            <div className="text-[10px] uppercase tracking-widest text-[#555] font-bold mb-2 px-2 font-mono">
              Диспетчер SQLite
            </div>
            <div className="bg-[#151515] rounded-md p-2.5 border border-[#222] font-mono text-[9px] space-y-1.5 text-zinc-400">
              <div className="flex justify-between">
                <span>SQLITE STATE</span>
                <span className="text-green-500 font-semibold flex items-center gap-1">
                  ● ACTIVE
                </span>
              </div>
              <div className="flex justify-between">
                <span>LOCAL UPLOAD</span>
                <span className="text-indigo-400">ENABLED</span>
              </div>
              <div className="flex justify-between">
                <span>STABLE PORT</span>
                <span className="text-zinc-500">3000</span>
              </div>
            </div>
          </div>
        </nav>

        {/* BOTTOM METADATA RAIL */}
        <div className="p-4 mt-auto border-t border-[#222]">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow shadow-green-500/20 animate-pulse"></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold font-mono">SQLite PRO CORE</p>
              <p className="text-[10px] text-zinc-500">Active Connection</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN HUB WORKSPACE LAYOUT */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
        
        {/* COMPACT DENSE HEADER */}
        <header className="h-16 bg-[#121212]/50 backdrop-blur-md border-b border-[#222] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 font-sans">
          
          {/* SEARCH SYSTEM BAR */}
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <div className="relative w-full">
              <span className="absolute left-3 top-2.5 text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию, тегам или автору..."
                className="w-full bg-[#141416]/90 border border-[#2d2d30] rounded-md py-1.5 pl-9 pr-4 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TELEMETRY ENGINE GRAPHS */}
          <div className="flex items-center space-x-6 text-[10px] font-mono text-[#666] uppercase select-none hidden sm:flex">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-emerald-500" />
              <span>CPU Load:</span>
              <span className="text-emerald-400 font-bold">{cpuLoad}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-indigo-400" />
              <span>SQLite Memory:</span>
              <span className="text-indigo-400 font-bold">{ramUsage} GB</span>
            </div>
            <div className="text-zinc-600 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5">
              v1.0.0 Stable
            </div>
          </div>
        </header>

        {/* CONTAINER WORKSPACE BODY */}
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto font-sans">
          
          {/* TOP NOTIFICATION / FEEDBACK FROM DATABASE OPERATIONS */}
          <AnimatePresence>
            {(authSuccess || authError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 gap-2 shrink-0"
              >
                {authSuccess && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      {authSuccess}
                    </span>
                    <button onClick={() => setAuthSuccess(null)} className="hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {authError && (
                  <div className="p-3 bg-rose-950/20 border border-rose-850/40 rounded-lg flex items-center justify-between text-xs text-rose-300">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      {authError}
                    </span>
                    <button onClick={() => setAuthError(null)} className="hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* SECTION A: INITIALIZE NEW STREAM (DENSE DESIGNFORM CARD) */}
          <section className="bg-[#121212] border border-[#222] rounded-xl p-5 shadow-2xl relative overflow-hidden transition-all hover:border-[#333]">
            
            {/* GLOW DECORATIONS */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500"></div>

            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-mono">
                  Инициация нового стрима / Broadcast controller
                </h2>
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                UPLOAD_MODE: SECURE
              </span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* 1. Название по спецификации */}
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block font-mono">
                    Название Проекта / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="Например: Flask Middleware API"
                    className="w-full bg-[#181818] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* 2. Описание лога */}
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block font-mono">
                    Краткий лог / Stream Description
                  </label>
                  <input
                    type="text"
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Разбор сборки SQLite..."
                    className="w-full bg-[#181818] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* 3. Перетаскивание или Загрузка */}
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block font-mono">
                    Файл вещания / Media Source *
                  </label>
                  
                  {!videoFile ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex items-center justify-center bg-[#181818] border-2 border-dashed rounded px-3 py-2 text-[10px] text-zinc-400 cursor-pointer h-[34px] transition-all overflow-hidden ${
                        dragActive
                          ? "border-indigo-500 bg-indigo-500/5 text-white"
                          : "border-[#444] hover:border-indigo-500/70"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.avi,.mkv"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <span className="truncate font-mono font-medium">ЗАГРУЗИТЬ .MP4 / .AVI</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-[#1f1f23] border border-[#333] rounded px-2.5 h-[34px] min-w-0">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-[10px] text-zinc-300 font-mono truncate">
                          {videoFile.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveSelectedFile}
                        className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Отправить в Hub */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={uploading || isCapturingFrame}
                    className="w-full bg-indigo-650 hover:bg-indigo-500 disabled:bg-[#1f1f23] disabled:text-zinc-500 text-white font-bold text-xs py-2 h-[34px] rounded shadow-lg shadow-indigo-600/10 transition-all font-display uppercase tracking-widest cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5 text-zinc-200" />
                        <span>Push to Hub</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* AUTOMATIC TIMECODE VISUAL PREVIEW BAR */}
              <AnimatePresence>
                {(thumbnailPreviewUrl || isCapturingFrame || uploadError || uploadSuccess) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2.5 mt-2.5 border-t border-[#222] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#16161a] p-3 rounded-lg">
                      
                      {/* Left: Alerts */}
                      <div className="min-w-0 flex-1">
                        {uploadError && (
                          <p className="text-xs text-red-400 flex items-center gap-1.5 font-mono">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {uploadError}
                          </p>
                        )}
                        {uploadSuccess && (
                          <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            ОК: Кадр на 2-й секунде успешно вырезан и записан в SQLite!
                          </p>
                        )}
                        {!uploadError && !uploadSuccess && thumbnailPreviewUrl && (
                          <div className="flex items-center space-x-2 text-[10px] text-zinc-400 font-mono">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span>Браузер захватил кадр для бэкапа. Бэкенд вызовет локальный FFmpeg!</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Captured Image preview */}
                      {isCapturingFrame ? (
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#222] rounded text-[10px] font-mono whitespace-nowrap">
                          <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                          <span>Генерация превью...</span>
                        </div>
                      ) : thumbnailPreviewUrl ? (
                        <div className="flex items-center space-x-3 bg-black/45 p-1 px-2.5 rounded-md border border-[#2d2d30]">
                          <img
                            src={thumbnailPreviewUrl}
                            alt="Frame slice 2s"
                            className="w-10 h-6 object-cover rounded border border-zinc-700"
                          />
                          <span className="text-[10px] font-mono text-zinc-400 font-semibold uppercase">
                            TIME: 00:00:02.000
                          </span>
                        </div>
                      ) : null}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </form>
          </section>

          {/* SECTION B: LOCAL AUTH MODAL PROMPT FOR GUESTS TO GAIN IDENTITY */}
          {!currentUser && (
            <div className="bg-gradient-to-r from-indigo-950/20 via-[#101014] to-indigo-950/20 border border-indigo-500/20 rounded-xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-5 shadow-inner">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200 font-mono">
                    Регистрация разработчика / Dev Identity Portal
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                  Хотите постить видео под уникальным именем? Назовите себя в базе SQLite без сложных паролей.
                </p>
              </div>

              {/* INLINE COMPACT REGISTER FORM */}
              <form onSubmit={handleAuthSubmit} className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto shrink-0">
                <div className="flex items-center bg-[#18181c] border border-[#2d2d30] rounded overflow-hidden">
                  <span className="pl-2 text-zinc-600 font-mono font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="alice_dev"
                    className="bg-transparent border-none py-1.5 px-2 text-xs focus:outline-none w-28 text-white"
                  />
                </div>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Пароль"
                  className="bg-[#18181c] border border-[#2d2d30] rounded py-1.5 px-2.5 text-xs focus:outline-none w-24 text-white"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded transition-all duration-150 cursor-pointer text-xs uppercase font-mono tracking-tight"
                >
                  {authTab === "login" ? "Вход" : "Зарег."}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab(authTab === "login" ? "register" : "login")}
                  className="text-indigo-400 hover:text-white px-1 py-1 text-[10px] font-mono uppercase"
                >
                  {authTab === "login" ? "[ Рег ]" : "[ Вход ]"}
                </button>
              </form>
            </div>
          )}

          {/* SECTION C: RECENT SOCIAL VIDEOS FEED */}
          <section className="flex-1 flex flex-col min-h-0 bg-transparent">
            
            {/* GRID HEADER WITH INTERACTIVE LIVE CATEGORIES */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50"></span>
                <h3 className="text-sm font-bold font-display uppercase tracking-wider text-white">
                  {activeCategory === "ALL" ? "Все видеотрансляции" : `Трансляции по тегу: ${activeCategory}`}
                </h3>
              </div>

              {/* SEARCH RESPONSES BAR OR FILTER STATE CONTROL */}
              <div className="flex space-x-1 bg-[#121212] p-0.5 rounded border border-[#222]">
                <button
                  onClick={() => { setActiveCategory("ALL"); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded font-mono ${
                    activeCategory === "ALL" ? "bg-[#222] text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => { setActiveCategory("SQL"); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded font-mono ${
                    activeCategory === "SQL" ? "bg-[#222] text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  SQL
                </button>
                <button
                  onClick={() => { setActiveCategory("FRONT"); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded font-mono ${
                    activeCategory === "FRONT" ? "bg-[#222] text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  CSS/HTML
                </button>
                <button
                  onClick={() => { setActiveCategory("CORE"); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded font-mono ${
                    activeCategory === "CORE" ? "bg-[#222] text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Backend
                </button>
              </div>
            </div>

            {/* VIDEO COLLECTION */}
            {loadingVideos ? (
              <div className="py-24 flex flex-col items-center justify-center bg-[#121212] border border-[#222] rounded-xl">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mb-3" />
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Connect to SQLite backend...</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-20 border border-dashed border-[#222] rounded-xl text-center flex flex-col items-center justify-center p-6 bg-[#121212]/30">
                <div className="w-10 h-10 bg-[#121212] border border-[#222] rounded-lg flex items-center justify-center mb-3 text-zinc-500">
                  <VideoIcon className="w-5 h-5 text-zinc-600" />
                </div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Медиаресурсы не обнаружены</h3>
                <p className="text-xs text-zinc-600 max-w-sm leading-relaxed">
                  {searchQuery ? "По вашему запросу ничего не найдено. Попробуйте сбросить поисковый фильтр." : "Нет активных видеотрансляций по данному тегу. Станьте первым, кто загрузит контент!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVideos.map((vid, idx) => {
                  
                  // Dynamically assign tag classifications based on title for pristine developer feel
                  let tag = "Full Stack";
                  let tagBg = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                  if (vid.title.toUpperCase().includes("SQL") || (vid.description && vid.description.toUpperCase().includes("SQL"))) {
                    tag = "SQLite Schema";
                    tagBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  } else if (vid.title.toUpperCase().includes("FLASK") || vid.title.toUpperCase().includes("BACKEND") || vid.title.toUpperCase().includes("API")) {
                    tag = "Flask Service";
                    tagBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  } else if (vid.title.toUpperCase().includes("FRONT") || vid.title.toUpperCase().includes("CSS") || vid.title.toUpperCase().includes("HTML") || vid.title.toUpperCase().includes("JS")) {
                    tag = "Frontend UI";
                    tagBg = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                  }

                  return (
                    <motion.div
                      key={vid.id || idx}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      onClick={() => setSelectedVideo(vid)}
                      className="bg-[#121212] border border-[#222] rounded-xl overflow-hidden group hover:border-indigo-500/40 cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 transition-all text-left flex flex-col"
                    >
                      {/* PREVIEW BOX AS SPECIFIED IN THE HIGH DENSITY ARCHITECTURE */}
                      <div className="aspect-video bg-[#1e1e1e] relative overflow-hidden shrink-0">
                        <img
                          src={`/uploads/thumbnails/${vid.thumbnail_filename}`}
                          alt={vid.title}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1618401471353-b98aedd07871?q=80&w=640&auto=format&fit=crop`;
                          }}
                          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        />
                        
                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-indigo-600/10 transition-colors duration-150 flex items-center justify-center">
                          <div className="w-12 h-12 bg-indigo-650 text-white rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200">
                            <Play className="w-4 h-4 fill-white translate-x-0.5" />
                          </div>
                        </div>

                        {/* Top Category Tag Badge */}
                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wide border border-zinc-800 text-zinc-300">
                          {tag}
                        </div>

                        {/* SQLite Identifier Banner */}
                        <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-mono text-indigo-400 border border-zinc-800">
                          ID: {vid.id}
                        </div>
                      </div>

                      {/* DETAILED INFO PANEL WITH MODERN CSS GRID & TEXT LABELS */}
                      <div className="p-4 flex flex-col flex-grow font-sans">
                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors duration-150 line-clamp-2 leading-tight mb-2 h-8">
                          {vid.title}
                        </h4>
                        
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-4 flex-grow">
                          {vid.description || "Описания не предоставлено."}
                        </p>

                        <div className="mt-auto pt-3 border-t border-[#222] flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] text-white font-bold font-mono">
                              {(vid.author_name ? vid.author_name[0] : "G").toUpperCase()}
                            </div>
                            <span className="truncate max-w-[85px] text-zinc-400 font-bold">
                              {vid.author_name ? `@${vid.author_name}` : "@гость"}
                            </span>
                          </div>
                          <span className="text-zinc-600 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-500" />
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

        {/* REFINED MOBILE FLOATING BOTTOM STATUS */}
        <footer className="py-4 px-8 border-t border-[#222] bg-[#0E0E10] text-center text-[10px] text-zinc-600 font-mono flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto select-none shrink-0">
          <p>© 2026 FullStack Hub. Полнофункциональный MVP для разработчиков. SQLite Engine stable.</p>
          <div className="flex items-center gap-2 text-[9px]">
            <span className="p-1 px-2 bg-indigo-500/10 text-indigo-400 rounded-sm border border-indigo-500/10">UI COMPRESSION: ACTIVE</span>
            <span className="p-1 px-2 bg-[#1a1a20] text-zinc-400 rounded-sm">SERVER RESPONSE: SECURE</span>
          </div>
        </footer>

      </main>

      {/* DETAILED PLAYER MODAL WINDOW OVERLAY */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#060608]/95 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl relative"
            >
              {/* HEADER CAPTION */}
              <div className="p-4 border-b border-[#222] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight font-display">
                    {selectedVideo.title}
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-500 uppercase mt-1">
                    Опубликовал:{" "}
                    <span className="text-indigo-400 font-bold">
                      {selectedVideo.author_name ? `@${selectedVideo.author_name}` : "Гость"}
                    </span>{" "}
                    | {new Date(selectedVideo.uploaded_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* IMMERSIVE VIDEO BOX */}
              <div className="bg-[#0b0b0d] p-1 flex items-center justify-center aspect-video relative group">
                <video
                  src={`/uploads/videos/${selectedVideo.video_filename}`}
                  poster={`/uploads/thumbnails/${selectedVideo.thumbnail_filename}`}
                  controls
                  autoPlay
                  preload="auto"
                  className="max-h-[500px] w-full h-full object-contain focus:outline-none"
                />
              </div>

              {/* DETAILED METADATA COMPLIANCE BOX */}
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                    Описание медиаресурса
                  </h4>
                  <div className="bg-[#1a1a20] border border-[#222] rounded-xl p-3 text-xs text-zinc-350 leading-relaxed whitespace-pre-wrap">
                    {selectedVideo.description || "Опубликовано без расширенного описания."}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] pt-3 border-t border-[#222] font-mono text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded text-[9px] font-bold">
                      ID: {selectedVideo.id}
                    </span>
                    <span className="p-1.5 bg-zinc-900 border border-zinc-800 rounded text-[9px]">
                      SQLite DB Verified
                    </span>
                  </div>
                  <div>
                    Предоставлено медиа-платформой: <span className="text-zinc-300">FullStack Hub v1.0.0</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
