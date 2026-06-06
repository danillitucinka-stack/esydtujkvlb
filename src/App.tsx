import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Upload,
  User as UserIcon,
  LogOut,
  X,
  Search,
  Globe,
  Link,
  Plus,
  Home,
  CheckCircle,
  AlertCircle,
  Clock,
  Compass,
  Video as VideoIcon,
  ChevronRight,
  TrendingUp,
  ThumbsUp,
  Share2,
  Tv,
  Info
} from "lucide-react";
import { User, Video } from "./types";

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("fsh_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [sidebarTab, setSidebarTab] = useState<"home" | "subscriptions" | "my-channel">("home");

  // Modals & Popups Control
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Authentication Fields
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Upload/Add Video Fields
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [thumbnailUrlInput, setThumbnailUrlInput] = useState("");
  
  // File Upload fields
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Fetch videos from API database
  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await fetch("/api/hub/feed");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      } else {
        console.error("Failed to load video list from backend API endpoint");
      }
    } catch (err) {
      console.error("Connection error loading video resources:", err);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Handle Authentication API
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername || !passwordInput) {
      setAuthError("Пожалуйста, заполните необходимые поля ввода.");
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
        setAuthError(data.error || "Ошибка аутентификации.");
      } else {
        if (authTab === "register") {
          setAuthSuccess("Аккаунт успешно создан! Теперь выполните вход.");
          setAuthTab("login");
          setPasswordInput("");
        } else {
          // Success Login
          const loggedInUser: User = data.user;
          setCurrentUser(loggedInUser);
          localStorage.setItem("fsh_user", JSON.stringify(loggedInUser));
          setAuthSuccess(`С возвращением, ${loggedInUser.username}!`);
          setUsernameInput("");
          setPasswordInput("");
          setIsAuthOpen(false);
        }
      }
    } catch (err) {
      setAuthError("Не удалось связаться с сервером. Повторите попытку.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("fsh_user");
    setAuthSuccess("Вы успешно вышли из аккаунта.");
    if (sidebarTab === "my-channel") {
      setSidebarTab("home");
    }
  };

  // Video stream publish submission
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(false);

    if (!titleInput.trim()) {
      setUploadError("Укажите название проекта.");
      return;
    }

    setUploading(true);

    try {
      if (uploadMode === "url") {
        if (!videoUrlInput.trim() || !thumbnailUrlInput.trim()) {
          setUploadError("Пожалуйста, укажите прямые ссылки на видео и обложку.");
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
          setUploadError(data.error || "Ошибка публикации.");
        } else {
          setUploadSuccess(true);
          setTitleInput("");
          setDescriptionInput("");
          setVideoUrlInput("");
          setThumbnailUrlInput("");
          await fetchVideos();
          setTimeout(() => {
            setIsUploadOpen(false);
            setUploadSuccess(false);
          }, 1500);
        }
      } else {
        // Multipart File Upload fallback
        if (!videoFile) {
          setUploadError("Прикрепите видеофайл.");
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
          setUploadError(data.error || "Ошибка загрузки файла.");
        } else {
          setUploadSuccess(true);
          setTitleInput("");
          setDescriptionInput("");
          setVideoFile(null);
          await fetchVideos();
          setTimeout(() => {
            setIsUploadOpen(false);
            setUploadSuccess(false);
          }, 1500);
        }
      }
    } catch (err) {
      setUploadError("Ошибка отправки данных. Повторите попытку.");
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
        setUploadError("Недопустимый формат. Разрешены только MP4, AVI, MKV.");
        return;
      }
      setVideoFile(file);
    }
  };

  // Helper resolvers for streams and images
  const getVideoUrl = (video: Video) => {
    if (video.video_url) return video.video_url;
    if (video.video_filename) return `/uploads/videos/${video.video_filename}`;
    return "";
  };

  const getThumbnailUrl = (video: Video) => {
    if (video.thumbnail_url) return video.thumbnail_url;
    if (video.thumbnail_filename) return `/uploads/thumbnails/${video.thumbnail_filename}`;
    return "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=80";
  };

  // Generate color palette gradient based on user ID or username
  const getUserColors = (username: string) => {
    const gradients = [
      "from-red-600 to-amber-600",
      "from-amber-600 to-yellow-500",
      "from-emerald-600 to-teal-500",
      "from-blue-600 to-indigo-500",
      "from-purple-600 to-pink-500",
      "from-pink-600 to-rose-500",
    ];
    let code = 0;
    for (let i = 0; i < username.length; i++) {
         code += username.charCodeAt(i);
    }
    return gradients[code % gradients.length];
  };

  // Simulate stats and duration stably based on Video ID
  const getSimulatedViews = (id: number) => {
    return ((id * 187 + 14) % 950) + 21;
  };

  const getSimulatedLikes = (id: number) => {
    return ((id * 43 + 7) % 150) + 3;
  };

  const getSimulatedDurationText = (id: number) => {
    const minutes = ((id * 3) % 12) + 2;
    const seconds = ((id * 7) % 45) + 12;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const getSimulatedDaysAgo = (id: number, dateStr: string) => {
    // Generate deterministic display date
    const d = new Date(dateStr);
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
  };

  const handleSearchReset = () => {
    setSearchQuery("");
  };

  // Filter video lists based on tags, search queries, and sidebar tab selection
  const filteredVideos = videos.filter((vid) => {
    const titleText = vid.title.toLowerCase();
    const descText = (vid.description || "").toLowerCase();
    const authorText = (vid.author_name || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    // 1. Search Query filter
    const matchesSearch =
      titleText.includes(query) ||
      descText.includes(query) ||
      authorText.includes(query);

    if (!matchesSearch) return false;

    // 2. Sidebar Tab Filter
    if (sidebarTab === "my-channel") {
      if (!currentUser) return false;
      return vid.user_id === currentUser.id;
    }

    if (sidebarTab === "subscriptions") {
      // Simulate subscriptions listing standard system accounts or curated titles
      return vid.id % 2 === 0;
    }

    // 3. Category Chip Filter
    if (activeCategory === "Все") return true;
    if (vid.category) {
      return vid.category === activeCategory;
    }
    if (activeCategory === "Разработка") {
      return (
        titleText.includes("разраб") ||
        titleText.includes("code") ||
        titleText.includes("react") ||
        titleText.includes("js") ||
        titleText.includes("full") ||
        descText.includes("код")
      );
    }
    if (activeCategory === "Базы данных") {
      return (
        titleText.includes("sql") ||
        titleText.includes("db") ||
        titleText.includes("postgre") ||
        titleText.includes("sqlite") ||
        descText.includes("баз")
      );
    }
    if (activeCategory === "Музыка & Саунд") {
      return (
        titleText.includes("music") ||
        titleText.includes("sound") ||
        titleText.includes("муз") ||
        titleText.includes("трек")
      );
    }
    if (activeCategory === "Лайфхаки") {
      return (
        titleText.includes("лайф") ||
        titleText.includes("tips") ||
        titleText.includes("совет") ||
        descText.includes("сделай")
      );
    }

    return false;
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] flex flex-col font-sans select-none antialiased">
      
      {/* 1. NOTIFICATIONS GRID */}
      <AnimatePresence>
        {(authSuccess || authError) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            {authSuccess && (
              <div className="bg-[#212121] border-l-4 border-emerald-500 rounded-md p-3.5 flex items-center justify-between text-xs text-emerald-300 shadow-2xl backdrop-blur-md">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{authSuccess}</span>
                </span>
                <button onClick={() => setAuthSuccess(null)} className="text-zinc-500 hover:text-white ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {authError && (
              <div className="bg-[#212121] border-l-4 border-red-500 rounded-md p-3.5 flex items-center justify-between text-xs text-red-300 shadow-2xl backdrop-blur-md">
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{authError}</span>
                </span>
                <button onClick={() => setAuthError(null)} className="text-zinc-500 hover:text-white ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. YOUTUBE HEADER (ВЕРХНЯЯ ПАНЕЛЬ) */}
      <header className="h-14 bg-[#0f0f0f] border-b border-[#212121] sticky top-0 z-40 px-4 flex items-center justify-between">
        
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-4">
          <div 
            onClick={() => {
              setSidebarTab("home");
              setActiveCategory("Все");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {/* Minimalist Red Video-Hosting styled icon */}
            <div className="w-7 h-5 bg-red-600 rounded flex items-center justify-center shadow-md">
              <Play className="w-3.5 h-3.5 text-white fill-white translate-x-0.5" />
            </div>
            <span className="font-bold tracking-tighter text-[19px] text-white font-sans hidden sm:block">
              FullStack<span className="text-red-500 font-extrabold ml-0.5">Hub</span>
            </span>
          </div>
        </div>

        {/* Center Side: Youtube Circle Search Bar */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="flex items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите поисковый запрос (например: React, SQL, баг...)"
                className="w-full bg-[#121212] border border-[#303030] rounded-l-full py-1.5 px-4 text-sm text-[14px] leading-6 font-normal text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 focus:bg-[#0f0f0f] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleSearchReset}
                  className="absolute right-3 top-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button className="bg-[#222222] hover:bg-[#303030] border-y border-r border-[#303030] rounded-r-full py-1.5 px-5 flex items-center justify-center text-zinc-300 hover:text-white active:bg-zinc-800 transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Account state and post controls */}
        <div className="flex items-center gap-3">
          
          {/* Header Action: Add video (Добавить видео) */}
          <button
            onClick={() => {
              if (!currentUser) {
                setAuthTab("login");
                setIsAuthOpen(true);
                setAuthError("Зарегистрируйтесь или авторизуйтесь, чтобы загружать видео.");
              } else {
                setIsUploadOpen(true);
              }
            }}
            className="flex items-center gap-1 bg-[#272727] hover:bg-[#3f3f3f] px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer text-white active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="hidden md:inline">Добавить</span>
          </button>

          {/* User Status / Account Action button */}
          {!currentUser ? (
            <button
              onClick={() => {
                setAuthError(null);
                setAuthSuccess(null);
                setAuthTab("login");
                setIsAuthOpen(true);
              }}
              className="flex items-center gap-1.5 hover:bg-[#263850] text-[#3ea6ff] border border-[#303030] hover:border-transparent px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors active:scale-95 duration-150"
            >
              <UserIcon className="w-4 h-4 shrink-0" />
              <span>Войти</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Profile Avatar Trigger */}
              <div 
                onClick={() => setSidebarTab("my-channel")}
                className="group relative cursor-pointer"
                title={`Перейти на мой канал: @${currentUser.username}`}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getUserColors(currentUser.username)} flex items-center justify-center font-bold text-xs ring-2 ring-[#303030] hover:ring-red-500 transition-all text-white`}>
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
              </div>

              {/* Log out */}
              <button
                onClick={handleLogout}
                className="bg-[#272727] hover:bg-[#3f3f3f] text-zinc-400 hover:text-red-500 p-1.5 rounded-full cursor-pointer transition-colors"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </header>

      {/* 3. ROOT MAIN VIEWS CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR NAVIGATION (ЛЕВОЕ БОКОВОЕ МЕНЮ) */}
        <aside className="w-60 bg-[#0f0f0f] border-r border-[#212121] flex flex-col shrink-0 hidden md:flex p-3 justify-between">
          
          <div className="space-y-6">
            
            {/* Primary Main tabs navigation block */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setSidebarTab("home");
                  setActiveCategory("Все");
                }}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-left text-xs font-bold font-sans transition-colors ${
                  sidebarTab === "home"
                    ? "bg-[#272727] text-white"
                    : "text-zinc-300 hover:bg-[#1f1f1f] hover:text-white"
                }`}
              >
                <Home className={`w-5 h-5 ${sidebarTab === "home" ? "text-red-500" : "text-zinc-400"}`} />
                <span className="text-[13px] font-medium">Главная</span>
              </button>

              <button
                onClick={() => setSidebarTab("subscriptions")}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-left text-xs font-bold font-sans transition-colors ${
                  sidebarTab === "subscriptions"
                    ? "bg-[#272727] text-white"
                    : "text-zinc-300 hover:bg-[#1f1f1f] hover:text-white"
                }`}
              >
                <Tv className={`w-5 h-5 ${sidebarTab === "subscriptions" ? "text-red-500" : "text-zinc-400"}`} />
                <span className="text-[13px] font-medium">Подписки</span>
              </button>

              <button
                onClick={() => {
                  if (!currentUser) {
                    setAuthTab("login");
                    setIsAuthOpen(true);
                    setAuthError("Войдите в свой аккаунт разработчика, чтобы открыть ваш личный видеоканал.");
                  } else {
                    setSidebarTab("my-channel");
                  }
                }}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-left text-xs font-bold font-sans transition-colors ${
                  sidebarTab === "my-channel"
                    ? "bg-[#272727] text-white"
                    : "text-zinc-300 hover:bg-[#1f1f1f] hover:text-white"
                }`}
              >
                <Compass className={`w-5 h-5 ${sidebarTab === "my-channel" ? "text-red-500" : "text-zinc-400"}`} />
                <span className="text-[13px] font-medium">Мой канал</span>
              </button>
            </div>

            {/* CURATED SUBSCRIBERS SUGGESTIONS */}
            <div className="border-t border-[#212121] pt-4">
              <span className="px-3 text-[12px] font-semibold text-zinc-500 block mb-2 font-mono uppercase tracking-wider">
                Подписки
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-[#1c1c1c] rounded-lg cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">
                    VS
                  </div>
                  <span className="text-[12px] text-zinc-300 truncate font-semibold">Vercel Studio</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-[#1c1c1c] rounded-lg cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                    PD
                  </div>
                  <span className="text-[12px] text-zinc-300 truncate font-semibold">Postgres Dev</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-[#1c1c1c] rounded-lg cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-[10px] text-white font-bold">
                    SH
                  </div>
                  <span className="text-[12px] text-zinc-300 truncate font-semibold">Serverless Hero</span>
                </div>
              </div>
            </div>

          </div>

          {/* BOTTOM PROFILE / GUEST ACCOUNT SECTION */}
          <div className="border-t border-[#212121] pt-3">
            {!currentUser ? (
              <div className="p-2 text-center text-zinc-500">
                <p className="text-[11px] leading-tight mb-2.5">
                  Войдите в аккаунт, чтобы ставить лайки и загружать полезные вещания.
                </p>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthTab("login");
                    setIsAuthOpen(true);
                  }}
                  className="w-full text-center border border-[#3ea6ff] hover:bg-[#263850] text-[#3ea6ff] font-bold text-xs py-1.5 rounded-full duration-150 transition-colors"
                >
                  Войти
                </button>
              </div>
            ) : (
              <div className="bg-[#1f1f1f] rounded-xl p-3 flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getUserColors(currentUser.username)} flex items-center justify-center font-bold text-xs text-white shrink-0`}>
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">@{currentUser.username}</p>
                  <p className="text-[10px] text-red-400 font-medium">Канал активен</p>
                </div>
              </div>
            )}
            
            {/* System attribution */}
            <div className="mt-3 text-center text-[10px] text-zinc-650">
              © 2026 FullStack Hub, LLC
            </div>
          </div>

        </aside>

        {/* MAIN FEED CONTENT GRID AND HEADER CHIPS */}
        <main className="flex-1 flex flex-col bg-[#0f0f0f] overflow-y-auto">
          
          {/* CATEGORY CHIPS SCROLLER (ЕСТЕСТВЕННЫЙ ФИЛЬТР YOUTUBE) */}
          {sidebarTab !== "my-channel" && (
            <div className="h-14 shrink-0 px-4 flex items-center gap-2 overflow-x-auto border-b border-[#212121] no-scrollbar">
              {["Все", "Разработка", "Базы данных", "Музыка & Саунд", "Лайфхаки"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setActiveCategory(chip)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap active:scale-95 ${
                    activeCategory === chip
                      ? "bg-white text-black"
                      : "bg-[#272727] hover:bg-[#3f3f3f] text-white"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* DYNAMIC VIDEOS FEED */}
          <div className="p-6 md:p-8 flex-1">
            
            {/* Active section title context (Channel specific header or list layout) */}
            {sidebarTab === "my-channel" && currentUser && (
              <div className="bg-[#1f1f1f] border border-[#2d2d2d] rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getUserColors(currentUser.username)} flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-black/35`}>
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-white">@{currentUser.username}</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">Личный видеохостинг FullStack Hub</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                    <span>Подписчиков: 0</span>
                    <span>•</span>
                    <span>Загруженных видео: {filteredVideos.length}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4  py-2 rounded-full cursor-pointer transition-all"
                >
                  Управление контентом
                </button>
              </div>
            )}

            {loadingVideos ? (
              <div className="py-24 text-center">
                <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm font-mono text-zinc-400 uppercase tracking-widest">
                  Подключение к PostgreSQL / SQLite...
                </p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="py-20 text-center max-w-sm mx-auto flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#212121] rounded-full flex items-center justify-center mb-4">
                  <VideoIcon className="w-7 h-7 text-zinc-500" />
                </div>
                <h3 className="text-md font-bold text-white mb-1.5">Ничего не найдено</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  {sidebarTab === "my-channel"
                    ? "Вы еще не опубликовали ни одного видеоролика. Нажмите «Добавить», чтобы залить свое первое видео в базу."
                    : "По данному тегу или запросу роликов в базе данных еще нет. Станьте первым авторитетным автором!"}
                </p>
                <button
                  onClick={() => {
                    handleSearchReset();
                    setActiveCategory("Все");
                  }}
                  className="bg-[#272727] hover:bg-[#303030] border border-[#3f3f3f] text-white px-4 py-1.5 rounded-full text-xs font-semibold"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              /* THE YOUTUBE CLASSIC GRID LIST */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedVideo(video);
                    }}
                    className="group cursor-pointer flex flex-col transition-transform relative duration-200"
                  >
                    
                    {/* VIDEO CONTAINER OVERLAY (LARGE CORNER PREVIEW) */}
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-[#212121] mb-3">
                      <img
                        src={getThumbnailUrl(video)}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Dark gradient shadow inside preview bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-transform scale-95 group-hover:scale-100 duration-150">
                          <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
                        </div>
                      </div>

                      {/* Pill Badge overlays */}
                      {video.type === "twitch" ? (
                        <span className="absolute top-2 left-2 bg-red-650 text-white font-extrabold text-[9px] uppercase font-mono px-2 py-0.5 rounded flex items-center gap-1 shadow-lg shadow-black/50 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                          LIVE • Twitch
                        </span>
                      ) : video.type === "youtube" ? (
                        <span className="absolute top-2 left-2 bg-[#0c0c0f]/95 border border-zinc-700 text-white font-bold text-[9px] uppercase font-mono px-2 py-0.5 rounded flex items-center gap-1 shadow-lg shadow-black/50">
                          <span className="w-1.5 h-1.5 bg-red-650 rounded-full"></span>
                          YouTube • Видео
                        </span>
                      ) : (
                        <span className="absolute top-2 left-2 bg-indigo-600/90 border border-indigo-500/20 text-white font-medium text-[9px] uppercase font-mono px-2 py-0.5 rounded flex items-center gap-1 shadow-lg shadow-black/50">
                          FullStack Hub • Вебинар
                        </span>
                      )}

                      {/* Video Simulated Duration Label */}
                      {video.type !== "twitch" && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-[11px] font-bold font-mono px-1.5 py-0.5 rounded text-white tracking-tight">
                          {getSimulatedDurationText(video.id)}
                        </span>
                      )}
                    </div>

                    {/* CARD INFO CONTENT ROW (AVATAR, TITLE, STATS) */}
                    <div className="flex gap-3">
                      
                      {/* Author Circle User Initials */}
                      <div className="shrink-0">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getUserColors(video.author_name || "аноним")} flex items-center justify-center text-xs text-white font-bold font-mono shadow-md`}>
                          {(video.author_name || "АН").substring(0, 2).toUpperCase()}
                        </div>
                      </div>

                      {/* Title block */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[14px] leading-tight font-semibold text-white line-clamp-2 py-0.5 group-hover:text-red-500 transition-colors">
                          {video.title}
                        </h4>
                        
                        <p className="text-[12px] text-zinc-400 mt-1 hover:text-white transition-colors truncate">
                          {video.author_name || "Анонимный разработчик"}
                        </p>
                        
                        <div className="text-[12px] text-zinc-400 flex items-center flex-wrap gap-1 mt-0.5 font-sans">
                          {video.type === "twitch" ? (
                            <>
                              <span className="text-red-500 font-bold">{video.views ? video.views.toLocaleString() : getSimulatedViews(video.id)}</span>
                              <span>зрителей</span>
                              <span>• сейчас в эфире</span>
                            </>
                          ) : (
                            <>
                              <span>{video.views ? video.views.toLocaleString() : getSimulatedViews(video.id)} просмотров</span>
                              <span>•</span>
                              <span>{getSimulatedDaysAgo(video.id, video.uploaded_at)}</span>
                            </>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>

        </main>

      </div>

      {/* ======================================================== */}
      {/* MODAL 1: AUTHENTICATION LOGIN AND REGISTER MODAL         */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isAuthOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#212121] border border-[#2d2d2d] rounded-2xl w-full max-w-sm overflow-hidden p-6 relative shadow-2xl z-10"
            >
              <button
                onClick={() => setIsAuthOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* TABS SELECTOR */}
              <div className="flex border-b border-[#303030] mb-5 text-[13px] font-mono font-bold uppercase text-center mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("login");
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 pb-2.5 transition-all outline-none ${
                    authTab === "login"
                      ? "border-b-2 border-red-500 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Вход в аккаунт
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("register");
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 pb-2.5 transition-all outline-none ${
                    authTab === "register"
                      ? "border-b-2 border-red-500 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Регистрация
                </button>
              </div>

              {/* AUTH INPUT FIELDS FORM */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight block">
                    Имя пользователя (Логин)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="ivan_developer"
                    className="w-full bg-[#121212] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight block">
                    Пароль
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#121212] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                  />
                </div>

                {authError && (
                  <div className="text-xs text-red-400 bg-red-900/10 border border-red-500/20 p-2.5 rounded-lg font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-full transition-colors font-sans cursor-pointer mt-2"
                >
                  {authTab === "login" ? "Войти" : "Зарегистрироваться"}
                </button>

                <p className="text-[10px] text-zinc-500 text-center leading-normal pt-2">
                  Пароли зашифрованы криптографическими алгоритмами хэширования на сервере.
                </p>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2: ADD/UPLOAD NEW VIDEO OVERLAY (YOUTUBE CREATOR) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#212121] border border-[#2d2d2d] rounded-2xl w-full max-w-xl overflow-hidden relative shadow-2xl z-10 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#303030] flex items-center justify-between">
                <span className="font-bold text-sm tracking-tight text-white font-sans">
                  Публикация нового видео
                </span>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handlePublishSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[85vh]">
                
                {/* Method selection panel */}
                <div className="flex bg-[#121212] p-0.5 rounded-lg border border-[#303030] text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setUploadMode("url"); setUploadError(null); }}
                    className={`flex-1 py-1.5 rounded-md transition-all ${
                      uploadMode === "url" ? "bg-[#2d2d2d] text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📡 С КОРРЕКТНЫМИ ССЫЛКАМИ (URL)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUploadMode("file"); setUploadError(null); }}
                    className={`flex-1 py-1.5 rounded-md transition-all ${
                      uploadMode === "file" ? "bg-[#2d2d2d] text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📁 ЗАГРУЗИТЬ ФАЙЛ С ПК (FILES)
                  </button>
                </div>

                {/* Common fields: Title & Description */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-bold uppercase block font-sans">
                      Название видео *
                    </label>
                    <input
                      type="text"
                      required
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="Например: Как настроить Express-сервер за 5 минут"
                      className="w-full bg-[#121212] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-bold uppercase block font-sans">
                      Полное подробное описание
                    </label>
                    <textarea
                      value={descriptionInput}
                      onChange={(e) => setDescriptionInput(e.target.value)}
                      rows={3}
                      placeholder="В данном видеоролике мы детально разберем..."
                      className="w-full bg-[#121212] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Specific form: URL lists mode */}
                {uploadMode === "url" ? (
                  <div className="space-y-3 p-4 bg-[#121212] border border-[#303030] rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        Ссылка на видеофайл (URL) *
                      </label>
                      <input
                        type="url"
                        required={uploadMode === "url"}
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        placeholder="https://example.com/stream.mp4"
                        className="w-full bg-[#1d1d1d] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-650 focus:outline-none focus:border-red-600 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Ссылка на превью-картинку (Thumbnail) *
                      </label>
                      <input
                        type="url"
                        required={uploadMode === "url"}
                        value={thumbnailUrlInput}
                        onChange={(e) => setThumbnailUrlInput(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-X..."
                        className="w-full bg-[#1d1d1d] border border-[#303030] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-650 focus:outline-none focus:border-red-600 transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  /* Drag and drop local system loader fallback */
                  <div className="p-4 bg-[#121212] border border-[#303030] rounded-xl space-y-3">
                    <label className="text-[11px] text-zinc-400 font-bold uppercase block font-sans">
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
                            ? "border-red-500 bg-red-500/5 text-red-300"
                            : "border-[#303030] hover:border-red-500/50 text-zinc-400"
                        }`}
                      >
                        <Upload className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <p className="text-[11px] font-sans font-bold text-zinc-300">
                          ПЕРЕТАЩИТЕ ВИДЕОФАЙЛ СЮДА
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Разрешены форматы: .mp4, .avi, .mkv (Макс: 100MB)
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-[#1d1d1d] border border-[#303030] rounded-xl p-3.5">
                        <div className="min-w-0 flex-1 flex items-center space-x-3">
                          <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center shrink-0">
                            <VideoIcon className="w-4 h-4 text-red-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate pr-4">
                              {videoFile.name}
                            </p>
                            <p className="text-[9px] text-zinc-500 font-mono">
                              Размер: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVideoFile(null)}
                          className="text-zinc-500 hover:text-white p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Form feedback block */}
                <div className="min-h-4 text-xs">
                  {uploadError && (
                    <div className="text-red-400 bg-red-900/10 border border-red-500/20 p-2.5 rounded-lg flex items-center gap-1.5 font-sans font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="text-emerald-400 bg-emerald-900/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center gap-1.5 font-sans font-medium">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Медиа успешно добавлено в общую базу данных!</span>
                    </div>
                  )}
                </div>

                {/* Form submit/post control */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="border border-[#3a3a3a] text-xs font-bold px-4 py-2 hover:bg-[#2d2d2d] rounded-full transition-colors cursor-pointer text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold text-xs px-6 py-2 rounded-full shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Отправка контента...</span>
                      </>
                    ) : (
                      "Опубликовать видео"
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 3: THEATER watch/PLAY PLAYER MODAL OVERLAY       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
            
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVideo(null)}
              className="absolute inset-0 bg-[#070708]/90"
            />

            {/* Immersive Theater Layout panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-[#0f0f0f] border-0 md:border border-[#232328] w-full max-w-6xl h-full md:h-[90vh] overflow-hidden relative shadow-2xl z-10 flex flex-col md:rounded-2xl"
            >
              
              {/* Close watch button floating top right */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/95 text-white flex items-center justify-center transition-colors shadow shadow-black/50 hover:text-red-500 cursor-pointer"
                title="Закрыть плеер"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Theater Mode layout stream split header */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto no-scrollbar">
                
                {/* 1. Main player column left */}
                <div className="flex-1 flex flex-col p-4 md:p-6 lg:border-r lg:border-[#212121] justify-start min-w-0">
                  
                  {/* HTML5 / Embedded Video Screen box */}
                  <div className="aspect-video w-full rounded-2xl bg-black border border-[#232328] relative overflow-hidden shadow-2xl">
                    {selectedVideo.type === "youtube" ? (
                      <iframe
                        src={`${selectedVideo.embed_url}?autoplay=1&mute=0`}
                        title={selectedVideo.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : selectedVideo.type === "twitch" ? (
                      <iframe
                        src={`https://player.twitch.tv/?channel=${selectedVideo.channel_name}&parent=${window.location.hostname || "localhost"}&autoplay=true&muted=false`}
                        title={selectedVideo.title}
                        frameBorder="0"
                        allowFullScreen
                        scrolling="no"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={getVideoUrl(selectedVideo)}
                        poster={getThumbnailUrl(selectedVideo)}
                        controls
                        autoPlay
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Video Metadata display list */}
                  <div className="mt-5 space-y-4">
                    
                    {/* Primary Title */}
                    <h2 className="text-lg md:text-xl font-bold text-white tracking-tight leading-snug">
                      {selectedVideo.title}
                    </h2>

                    {/* Meta bar views & likes */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#212121] pb-4">
                      
                      {/* Views / Date */}
                      <p className="text-xs text-zinc-400">
                        {selectedVideo.type === "twitch" ? (
                          <span className="flex items-center gap-1.5 text-red-500 font-bold">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            {(selectedVideo.views || 2500).toLocaleString()} зрителей в эфире Twitch
                          </span>
                        ) : (
                          <>{(selectedVideo.views || getSimulatedViews(selectedVideo.id)).toLocaleString()} просмотров • {getSimulatedDaysAgo(selectedVideo.id, selectedVideo.uploaded_at)}</>
                        )}
                      </p>

                      {/* User interaction counts (Likes, share, etc) */}
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 bg-[#272727] hover:bg-[#3f3f3f] px-3.5 py-1.5 rounded-full text-xs font-semibold hover:text-red-500 transition-colors">
                          <ThumbsUp className="w-4 h-4" />
                          <span>{getSimulatedLikes(selectedVideo.id)}</span>
                        </button>
                        <button className="flex items-center gap-1.5 bg-[#272727] hover:bg-[#3f3f3f] px-3.5 py-1.5 rounded-full text-xs font-semibold hover:text-red-500 transition-colors">
                          <Share2 className="w-4 h-4" />
                          <span>Поделиться</span>
                        </button>
                      </div>

                    </div>

                    {/* Curated Author Bio card */}
                    <div className="flex items-start gap-3 bg-[#17171d]/60 border border-[#232328] rounded-xl p-4">
                      
                      <div className="shrink-0 mt-0.5">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getUserColors(selectedVideo.author_name || "аноним")} flex items-center justify-center text-sm text-white font-bold font-mono shadow`}>
                          {(selectedVideo.author_name || "АН").substring(0, 2).toUpperCase()}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {selectedVideo.author_name || "Анонимный разработчик"}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Автор трансляции FullStack Hub</p>
                        
                        {/* Description field */}
                        <p className="text-xs text-zinc-300 leading-relaxed mt-2.5 whitespace-pre-line bg-[#0c0c0f] p-2.5 rounded-lg border border-[#1f1f25] font-sans">
                          {selectedVideo.description || "Описание вещания отсутствует."}
                        </p>
                      </div>

                    </div>

                  </div>

                </div>

                {/* 2. Youtube sidebar recommendations columns Right */}
                <div className="w-full lg:w-80 p-4 shrink-0 space-y-4">
                  
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#aaa] font-mono">
                    Рекомендуем к просмотру
                  </h3>

                  <div className="space-y-4">
                    {videos
                      .filter((vid) => vid.id !== selectedVideo.id)
                      .slice(0, 6)
                      .map((recVideo) => (
                        <div
                          key={recVideo.id}
                          onClick={() => setSelectedVideo(recVideo)}
                          className="flex gap-3 hover:bg-[#1a1a1f] p-1.5 rounded-xl transition-all cursor-pointer group shrink-0"
                        >
                          {/* Left layout: Preview Mini aspect video */}
                          <div className="relative aspect-video w-[110px] rounded-lg overflow-hidden bg-zinc-900 border border-[#212121] shrink-0">
                            <img
                              src={getThumbnailUrl(recVideo)}
                              alt={recVideo.title}
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                              referrerPolicy="no-referrer"
                            />
                            
                            <span className="absolute bottom-1 right-1 bg-black/85 text-[9px] font-bold font-mono px-1 py-0.2 rounded text-white tracking-tight">
                              {getSimulatedDurationText(recVideo.id)}
                            </span>
                          </div>

                          {/* Right layout: info text */}
                          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                            <h4 className="text-[12px] leading-tight font-semibold text-white line-clamp-2 uppercase-none group-hover:text-red-500 transition-colors">
                              {recVideo.title}
                            </h4>
                            <div className="mt-1">
                              <p className="text-[10px] text-zinc-400 truncate">
                                {recVideo.author_name || "Автор"}
                              </p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                {getSimulatedViews(recVideo.id)} просмотров
                              </p>
                            </div>
                          </div>

                        </div>
                      ))}

                    {/* Backup suggestion fallback if not enough items in DB */}
                    {videos.filter((v) => v.id !== selectedVideo.id).length === 0 && (
                      <div className="p-4 border border-dashed border-[#232328] rounded-xl text-center text-[11px] text-zinc-500">
                        Других опубликованных вещаний в системе пока нет.
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
