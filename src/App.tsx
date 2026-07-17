import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  BookOpen, 
  FileText, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Printer, 
  GraduationCap, 
  AlertCircle, 
  CheckCircle, 
  ChevronRight, 
  Wand2, 
  Clock, 
  Send,
  HelpCircle,
  Dribbble,
  Award,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  BookMarked
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PRESET_TOPICS } from "./presets";
import { LearningModule, ModuleChapter } from "./types";

export default function App() {
  // Formulation state
  const [jenjang, setJenjang] = useState<string>("SMP");
  const [kelas, setKelas] = useState<string>("Kelas 8");
  const [materi, setMateri] = useState<string>("Sistem Pencernaan & Nutrisi Makanan");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // UI States
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(1); // Defaults to SMP
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Active Generated Module state
  const [module, setModule] = useState<LearningModule | null>(null);
  
  // Interactive student solution inputs
  const [studentRemedialAnswer, setStudentRemedialAnswer] = useState<string>("");
  const [studentAdvancedAnswer, setStudentAdvancedAnswer] = useState<string>("");
  const [remedialChecked, setRemedialChecked] = useState<boolean>(false);
  const [advancedChecked, setAdvancedChecked] = useState<boolean>(false);

  // Audio state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentlyPlayingSection, setCurrentlyPlayingSection] = useState<string | null>(null);

  // Active viewing chapter index
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);

  // Live refinement states
  const [refineTarget, setRefineTarget] = useState<string>("all");
  const [refineInstruction, setRefineInstruction] = useState<string>("");
  const [refining, setRefining] = useState<boolean>(false);
  const [refineSuccess, setRefineSuccess] = useState<boolean>(false);

  // Search filtering in list
  const [materiSearch, setMateriSearch] = useState<string>("");

  // Initialize with predefined layout or automatically trigger for quick exploration
  useEffect(() => {
    // Generate an initial default module demo when the app loads so the viewer is not greeted with an empty page
    triggerAutoDemo();
  }, []);

  const triggerAutoDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenjang: "SMP",
          kelas: "Kelas 8",
          materi: "Sistem Pencernaan & Nutrisi Makanan",
          customPrompt: "Fokus pada perjalanan sebutir bakso melewati organ-organ tubuh secara santai."
        })
      });
      if (response.ok) {
        const data = await response.json();
        setModule({
          ...data,
          jenjang: "SMP",
          kelas: "Kelas 8",
          materi: "Sistem Pencernaan & Nutrisi Makanan"
        });
      } else {
        throw new Error("Gagal mengambil modul default.");
      }
    } catch (err: any) {
      console.warn("Failed to load initial demo, letting user generate manually:", err);
    } finally {
      setLoading(false);
    }
  };

  // Preset Selector helper
  const handleSelectPreset = (index: number) => {
    setActivePresetIndex(index);
    const selected = PRESET_TOPICS[index];
    setJenjang(selected.jenjang);
    setKelas(selected.kelas);
    setMateri(selected.materi);
  };

  // Generate Module action
  const handleGenerateModule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!materi.trim()) {
      setError("Isi materi pembelajaran terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setModule(null);
    setStudentRemedialAnswer("");
    setStudentAdvancedAnswer("");
    setRemedialChecked(false);
    setAdvancedChecked(false);
    stopAudio();

    try {
      const res = await fetch("/api/generate-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenjang,
          kelas,
          materi,
          customPrompt
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal mengenerate modul sains.");
      }

      const data = await res.json();
      setModule({
        ...data,
        jenjang,
        kelas,
        materi
      });
      setActiveChapterIndex(0);
    } catch (err: any) {
      setError(err.message || "Koneksi ke backend Pak GuruAI gagal. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  // Refine module parts via custom AI prompt
  const handleRefineModule = async () => {
    if (!module) return;
    if (!refineInstruction.trim()) {
      alert("Masukkan instruksi perbaikan / penyesuaian materi terlebih dahulu!");
      return;
    }

    setRefining(true);
    setRefineSuccess(false);
    stopAudio();

    try {
      const res = await fetch("/api/refine-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentModule: module,
          editTarget: refineTarget,
          instruction: refineInstruction
        })
      });

      if (!res.ok) {
        throw new Error("Metode perbaikan AI gagal merespon.");
      }

      const updatedData = await res.json();
      setModule({
        ...updatedData,
        jenjang: module.jenjang,
        kelas: module.kelas,
        materi: module.materi
      });
      setRefineInstruction("");
      setRefineSuccess(true);
      setTimeout(() => setRefineSuccess(false), 4000);
    } catch (err: any) {
      alert("Gagal melakukan penyelarasan AI: " + err.message);
    } finally {
      setRefining(false);
    }
  };

  // Clean stop of audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentlyPlayingSection(null);
  };

  // Call Text to Speech for interactive study guide
  const handlePlayVoice = async (textToSpeak: string, sectionKey: string) => {
    if (currentlyPlayingSection === sectionKey) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    stopAudio();
    setIsSynthesizing(true);
    setCurrentlyPlayingSection(sectionKey);

    try {
      // Pick voice based on grade to make it highly authentic & enjoyable
      let voiceName = "Puck"; // standard tutor tone
      if (jenjang === "SD") {
        voiceName = "Aoede"; // highly energetic/younger feel
      } else if (jenjang === "SMA") {
        voiceName = "Charon"; // authoritative/thoughtful
      }

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, voice: voiceName })
      });

      if (!res.ok) {
        throw new Error("TTS synthesis failed");
      }

      const data = await res.json();
      if (data.audio) {
        const audioBlobUrl = `data:audio/mp3;base64,${data.audio}`;
        setAudioUrl(audioBlobUrl);
        setIsPlaying(true);

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = audioBlobUrl;
            audioRef.current.play().catch(e => console.log("Audio playback error:", e));
          }
        }, 100);
      }
    } catch (err) {
      console.error(err);
      alert("Fitur suara Suara Pak GuruAI sedang sibuk. Coba sesaat lagi.");
      setCurrentlyPlayingSection(null);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Helper tone styling tags depending on Selected Jenjang
  const getBadgesByJenjang = (level: string) => {
    switch (level) {
      case "SD":
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-300",
          desc: "Bahasa Populer-Edukatif (Ceria, penuh analogi kartun & emoji lucu 🎈)",
          label: "SD (Kelas 4-6)"
        };
      case "SMP":
        return {
          bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
          desc: "Bahasa Gaul Remaja (Kolaboratif, santai, tren kekinian & game 🎮)",
          label: "SMP (Kelas 7-9)"
        };
      case "SMA":
        return {
          bg: "bg-indigo-100 text-indigo-800 border-indigo-300",
          desc: "Bahasa Analitis-Intektual (Mendalam, kasus nyata & panduan karier 🌌)",
          label: "SMA (Kelas 10-11 IPA/IPS)"
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-300",
          desc: "Standar Belajar Aktif",
          label: level
        };
    }
  };

  const currentLevelBadge = getBadgesByJenjang(module?.jenjang || jenjang);

  // Trigger browser-native print layout mapped directly to A4 optimized layouts
  const triggerPrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-indigo-200">
      
      {/* Hidden audio tag for TTS */}
      <audio 
        ref={audioRef} 
        onEnded={() => {
          setIsPlaying(false);
          setCurrentlyPlayingSection(null);
        }} 
        className="hidden"
      />

      <div className="no-print flex flex-col flex-1">
        {/* HEADER BAR */}
      <header className="no-print sticky top-0 z-30 bg-indigo-600 text-white shadow-lg border-b-4 border-yellow-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-md transform hover:rotate-12 transition-all">
              <span className="text-2xl" role="img" aria-label="lightning">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight uppercase font-display">GenZi Academy</h1>
                <span className="bg-yellow-400 text-indigo-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Deep Learning
                </span>
              </div>
              <p className="text-xs font-semibold text-indigo-200 tracking-wider uppercase">by. Pak GuruAI</p>
            </div>
          </div>

          {/* Quick interactive header stats */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl border border-indigo-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
              Pak GuruAI Aktif
            </span>
            
            {module && (
              <button 
                id="btn-export-pdf"
                onClick={triggerPrintPdf}
                className="bg-yellow-400 hover:bg-yellow-300 text-indigo-900 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 transition-all shadow-md transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Printer size={16} />
                Cetak / Ekspor PDF 📄
              </button>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        
        {/* TOP INTRODUCTORY HERO (No-print) */}
        <div className="no-print bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
            <Award size={320} className="text-slate-400" />
          </div>

          <div className="flex-1 space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
              <Sparkles size={14} />
              Metode Kurikulum Merdeka Terpadu
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
              Selamat Datang di Generator Modul <span className="text-indigo-600 underline decoration-yellow-400 decoration-wavy decoration-3 underline-offset-4">Pak GuruAI</span>
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Buat modul ajar cerdas, adaptif, dan mendalam (Deep Learning) secara otomatis dengan 
              vokal pengantar bilingual indrawi. Tulis materi sains, sejarah, atau sosial, dan biarkan AI 
              mengubahnya dalam rincian bertahap sesuai usia murid.
            </p>
          </div>

          {/* Quick Helper card */}
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 w-full lg:w-72 shrink-0">
            <h4 className="text-xs font-black text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Layers size={14} /> Karakteristik Pedagogis
            </h4>
            <ul className="text-xs text-indigo-950 space-y-1.5">
              <li className="flex items-center gap-1.5">🎯 <strong>Mindmap Visual</strong> terstruktur</li>
              <li className="flex items-center gap-1.5">🦖 <strong>Miskonsepsi</strong> &amp; Insight sains</li>
              <li className="flex items-center gap-1.5">🌱 <strong>Scaffolding</strong> Diferensiasi</li>
              <li className="flex items-center gap-1.5">🔊 <strong>TTS Audio</strong> ramah gawai</li>
            </ul>
          </div>
        </div>

        {/* WORKSPACE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT PANELS: CREATION ENGINE (no-print) */}
          <aside className="no-print lg:col-span-4 flex flex-col gap-6">
            
            {/* 1. INPUT FORM */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-indigo-100">
              <h3 className="text-md font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2 border-b pb-2">
                <span className="w-2.5 h-5 bg-indigo-600 rounded-full inline-block"></span>
                Parameter Modul Ajar
              </h3>

              <form onSubmit={handleGenerateModule} className="space-y-4">
                
                {/* JENJANG SELECTION */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    1. Jenjang Pendidikan [Jenjang]
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["SD", "SMP", "SMA"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setJenjang(item);
                          setActivePresetIndex(null);
                          // Auto match kelas
                          if (item === "SD") setKelas("Kelas 5");
                          if (item === "SMP") setKelas("Kelas 8");
                          if (item === "SMA") setKelas("Kelas 11 IPA");
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center border-2 transition-all ${
                          jenjang === item
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {item === "SD" && "🎒 SD (4-6)"}
                        {item === "SMP" && "🏫 SMP (7-9)"}
                        {item === "SMA" && "🎓 SMA (10-11)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KELAS / JURUSAN SECTION */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Kelas &amp; Jurusan [Kelas/Jurusan]
                  </label>
                  <input
                    type="text"
                    value={kelas}
                    onChange={(e) => {
                      setKelas(e.target.value);
                      setActivePresetIndex(null);
                    }}
                    placeholder="Contoh: Kelas 5, Kelas 8, Kelas 11 IPA"
                    className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl p-2.5 outline-none font-medium text-slate-800 transition-all focus:bg-white"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Misalnya: <em>Kelas 4, Kelas 7, Kelas 11 IPS, Kelas 10 Biologi</em>.
                  </p>
                </div>

                {/* MATERI UTAMA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    3. Materi Pembelajaran [Materi]
                  </label>
                  <textarea
                    value={materi}
                    onChange={(e) => {
                      setMateri(e.target.value);
                      setActivePresetIndex(null);
                    }}
                    placeholder="Tulis topik atau konsep di sini..."
                    className="w-full h-20 text-sm bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl p-2.5 outline-none font-medium text-slate-800 transition-all resize-none focus:bg-white"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Buat spesifik agar pembedahan analogi dari Pak GuruAI semakin tajam dan kaya visual.
                  </p>
                </div>

                {/* CUSTOM PEDAGOGY FOCUS */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>4. Fokus Tambahan AI (Opsional)</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">Pedagogi</span>
                  </label>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Contoh: analogikan dengan kehidupan kota Jakarta"
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl p-2.5 outline-none font-medium text-slate-800 transition-all focus:bg-white"
                  />
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Mencari Inspirasi Guru...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="text-yellow-300" />
                      Buat Modul Interaktif 🚀
                    </>
                  )}
                </button>

              </form>
            </div>

            {/* QUICK PRESET SELECTOR */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <BookMarked size={14} className="text-indigo-500" />
                  Materi Preset Terpilih
                </h4>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">4 Modul</span>
              </div>
              
              <div className="space-y-2">
                {PRESET_TOPICS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectPreset(index)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all text-xs flex gap-3 ${
                      activePresetIndex === index
                        ? "bg-yellow-50 border-yellow-400 shadow-sm"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-2xl mt-1 shrink-0">{preset.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-900">{preset.kelas}</span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-semibold px-1 py-0.2 rounded">
                          {preset.jenjang}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 line-clamp-1">{preset.materi}</p>
                      <p className="text-slate-500 text-[10px] mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AUDIO GUIDE GENERAL PANEL */}
            {module && (
              <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-inner border border-slate-800 relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-15">
                  <Volume2 size={48} className="text-yellow-400" />
                </div>
                
                <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  </span>
                  Asisten Vokal Pak GuruAI
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Butuh asisten audio untuk membacakan konsep? Klik tombol suara berlogo mikrofon 🔊 di setiap 
                  bab agar asisten bilingual Pak GuruAI membacakan dengan intonasi ramah sesuai umur siswa.
                </p>

                {currentlyPlayingSection && (
                  <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between border border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 py-1">
                        <span className={`w-1 bg-green-400 rounded transition-all duration-300 ${isPlaying ? 'h-4 animate-bounce' : 'h-1'}`}></span>
                        <span className={`w-1 bg-green-400 rounded transition-all duration-300 delay-75 ${isPlaying ? 'h-6 animate-bounce' : 'h-1'}`}></span>
                        <span className={`w-1 bg-green-400 rounded transition-all duration-300 delay-150 ${isPlaying ? 'h-3 animate-bounce' : 'h-1'}`}></span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-300">
                        {currentlyPlayingSection === "title" ? "Membaca Pengantar & Pertanyaan Pemantik..." : `Membaca Bab ${currentlyPlayingSection.replace("chapter-", "")}...`}
                      </span>
                    </div>
                    
                    <button
                      onClick={stopAudio}
                      className="bg-red-500/20 hover:bg-red-500/40 text-red-300 p-1.5 rounded-lg transition-all"
                      title="Hentikan Audio"
                    >
                      <VolumeX size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

          </aside>

          {/* RIGHT PANELS: THE LEARNING WORKSPACE (Span 8) */}
          <main id="print-content" className="lg:col-span-8 flex flex-col gap-6 print-area">
            
            {/* LOADER STATS */}
            {loading && (
              <div className="bg-white rounded-3xl p-12 border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="absolute inset-0 flex items-center justify-center text-xl">🎓</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 font-display">Sedang Meramu Konsep Deep Learning...</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Pak GuruAI sedang menyusun Mind Map, mematangkan analogi cerdas, dan merancang scaffolding adaptif khusus <strong>{kelas}</strong>.
                  </p>
                </div>
                <div className="inline-flex gap-2 text-[10px] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-bold">
                  <span>Materi: {materi}</span>
                </div>
              </div>
            )}

            {/* ERROR CARD */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-900 p-5 rounded-3xl flex items-start gap-3 shadow-sm">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">Ada Kendala Teknis 🚧</h4>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">{error}</p>
                  <button 
                    onClick={() => handleGenerateModule()}
                    className="mt-3 bg-white border border-red-300 hover:bg-slate-50 font-bold text-xs text-red-900 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Coba Sekali Lagi
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE MODULE CONTAINER */}
            {module && !loading && (
              <div className="space-y-6">

                {/* THEME WRAPPER / CONTAINER WITH VIBRANT PALETTE ACCENTS */}
                <div className="bg-white rounded-[40px] shadow-xl border-t-8 border-yellow-400 p-5 sm:p-8 flex flex-col transition-all">
                  
                  {/* METADATA BANNER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-50 pb-5 mb-6">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${currentLevelBadge.bg}`}>
                          Level: {currentLevelBadge.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                          Kurikulum Merdeka 🌟
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                        Modul Pembelajaran Komprehensif
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-indigo-50 py-1.5 px-3 rounded-2xl border border-indigo-100 text-indigo-900 font-semibold text-xs shrink-0 self-start sm:self-auto">
                      💡 <span>Deep Learning Paradigm</span>
                    </div>
                  </div>

                  {/* TITLE AREA AND ESSENTIAL QUESTION */}
                  <div className="mb-8 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-2xl sm:text-3.5xl font-black text-slate-950 font-display leading-tight tracking-tight">
                        {module.title}
                      </h2>
                      
                      <button
                        onClick={() => handlePlayVoice(`${module.title}. Pertanyaan pemantik utama kita hari ini adalah: Apakah kamu pernah memikirkannya?`, "title")}
                        disabled={isSynthesizing}
                        className={`no-print p-2 rounded-xl border-2 transition-all shrink-0 ${
                          currentlyPlayingSection === "title" 
                            ? "bg-green-100 border-green-400 text-green-700 scale-105" 
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                        title="Dengarkan Pengantar Vokal"
                      >
                        {isSynthesizing && currentlyPlayingSection === "title" ? (
                          <RefreshCw size={18} className="animate-spin text-green-600" />
                        ) : (
                          <Volume2 size={18} />
                        )}
                      </button>
                    </div>

                    <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 sm:p-5 rounded-r-2xl shadow-sm relative overflow-hidden">
                      <div className="absolute right-2 bottom-1 text-4xl opacity-15 select-none font-black italic">HOTS</div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <HelpCircle size={12} />
                        Pertanyaan Pemantik (Essential Question)
                      </p>
                      <p className="text-sm text-slate-800 italic font-medium leading-relaxed">
                        "Bagaimana sebuah perubahan kecil dalam hidupmu atau komponen alam sekitar dapat mendikte kelangsungan sistem yang sangat besar? 🤔"
                      </p>
                    </div>
                  </div>

                  {/* 3 COLUMNS / DOUBLE LAYOUT SECTIONS */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch mb-8">
                    
                    {/* COL 1: MIND MAP NAVIGATION (Span 4) */}
                    <div className="md:col-span-4 bg-slate-50 border-2 border-indigo-100 rounded-3xl p-4 flex flex-col justify-between relative">
                      <div>
                        <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2 mb-3">
                          <h3 className="text-xs font-black text-indigo-700 uppercase tracking-tight flex items-center gap-1.5">
                            <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full inline-block"></span>
                            Mind Map Navigasi
                          </h3>
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-mono font-bold uppercase">visual</span>
                        </div>

                        <div className="prose prose-sm text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto pr-1">
                          {module.mindMap ? (
                            <ReactMarkdown>{module.mindMap}</ReactMarkdown>
                          ) : (
                            <div className="text-slate-400 italic">No Mind Map generated.</div>
                          )}
                        </div>
                      </div>

                      {/* Progress Widget matching sample theme */}
                      <div className="bg-indigo-100/60 p-3 rounded-2xl border border-indigo-200/50 mt-4">
                        <div className="flex justify-between text-[10px] font-black text-indigo-700 mb-1.5 uppercase">
                          <span>Progress Penguasaan</span>
                          <span>{activeChapterIndex === 0 ? "35%" : activeChapterIndex === 1 ? "70%" : "100%"}</span>
                        </div>
                        <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-indigo-200">
                          <div 
                            className="bg-green-400 h-full transition-all duration-500" 
                            style={{ width: activeChapterIndex === 0 ? "35%" : activeChapterIndex === 1 ? "70%" : "100%" }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* COL 2: MICRO-LEARNING CHAPTER READER (Span 8) */}
                    <div className="md:col-span-8 flex flex-col gap-4">
                      
                      {/* Active chapter selector tabs */}
                      <div className="no-print flex border-b border-slate-200 gap-1 pb-1">
                        {module.chapters.map((chap, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setActiveChapterIndex(idx);
                              stopAudio();
                            }}
                            className={`flex-1 py-2 px-1 text-center rounded-t-xl transition-all font-bold text-xs ${
                              activeChapterIndex === idx
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-500 hover:text-slate-900 bg-slate-100/60 hover:bg-slate-100"
                            }`}
                          >
                            Bab {idx + 1}
                          </button>
                        ))}
                      </div>

                      {/* Print layout always lists all chapters sequentially. This container displays active on web, and all when printing */}
                      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                        
                        <div>
                          {module.chapters.map((chapter: ModuleChapter, index: number) => {
                            // On web, only render active. On print, render all.
                            const isActive = activeChapterIndex === index;
                            
                            return (
                              <div key={index} className={`${isActive ? "block" : "hidden md:hidden print:block print:mb-8 border-b pb-6"}`}>
                                <div className="flex items-center justify-between gap-3 mb-3 border-b border-indigo-100/40 pb-2">
                                  <h3 className="text-md font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-yellow-500 font-black">{index + 1}.</span>
                                    {chapter.chapterTitle}
                                  </h3>
                                  
                                  <button
                                    onClick={() => handlePlayVoice(`Bab ${index + 1}: ${chapter.chapterTitle}. ${chapter.chapterContent}`, `chapter-${index + 1}`)}
                                    disabled={isSynthesizing}
                                    className={`no-print p-1.5 rounded-lg border transition-all ${
                                      currentlyPlayingSection === `chapter-${index + 1}`
                                        ? "bg-green-100 border-green-400 text-green-700"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                                    }`}
                                    title="Dengar Pembacaan Bab ini"
                                  >
                                    {isSynthesizing && currentlyPlayingSection === `chapter-${index + 1}` ? (
                                      <RefreshCw size={14} className="animate-spin text-green-600" />
                                    ) : (
                                      <Volume2 size={14} />
                                    )}
                                  </button>
                                </div>

                                <div className="prose prose-sm text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-w-full">
                                  <ReactMarkdown>{chapter.chapterContent}</ReactMarkdown>
                                </div>

                                {chapter.insightBox && (
                                  <blockquote className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 mt-4 shadow-sm relative">
                                    <div className="absolute right-3 top-2 text-xl opacity-30">💡</div>
                                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                      <span>Kotak Wawasan (Insight Box)</span>
                                    </p>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed">
                                      {chapter.insightBox}
                                    </p>
                                  </blockquote>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* SCAFFOLDING & DIFFERENTIATION TRACKS */}
                  <div className="border-t border-indigo-50 pt-6 mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Layers size={18} className="text-indigo-600" />
                      <h3 className="text-lg font-black text-slate-900 tracking-tight font-display">
                        Scaffolding &amp; Diferensiasi Siswa
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* ROW LITE: REMEDIAL (PINK THEME) */}
                      <div className="bg-pink-50/40 border-2 border-pink-100 rounded-3xl p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black bg-pink-100 text-pink-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                              Jalur Dasar / Remedial (Basic Scaffold) 🛠️
                            </span>
                            <span className="text-xs">🌱</span>
                          </div>
                          
                          <h4 className="text-sm font-bold text-slate-900 mb-2">
                            {module.scaffolding.remedialTitle}
                          </h4>
                          
                          <div className="text-xs text-slate-700 leading-relaxed bg-white/70 rounded-xl p-3 border border-pink-100/50 whitespace-pre-wrap mb-4">
                            <ReactMarkdown>{module.scaffolding.remedialContent}</ReactMarkdown>
                          </div>
                        </div>

                        {/* Interactive Workbook Area */}
                        <div className="no-print space-y-2 mt-2 pt-2 border-t border-pink-100">
                          <label className="block text-[10px] font-bold text-pink-700 uppercase">
                            Lembar Verifikasi Mandiri:
                          </label>
                          <textarea
                            value={studentRemedialAnswer}
                            onChange={(e) => setStudentRemedialAnswer(e.target.value)}
                            placeholder="Tuliskan jawaban rangkuman atau poin tantangan di sini..."
                            className="w-full text-xs bg-white border border-slate-200 focus:border-pink-300 p-2 rounded-lg outline-none resize-none h-14"
                          />
                          <button
                            onClick={() => {
                              if (!studentRemedialAnswer.trim()) {
                                alert("Silakan tulis jawaban kamu terlebih dahulu!");
                                return;
                              }
                              setRemedialChecked(true);
                            }}
                            className="bg-pink-600 hover:bg-pink-700 text-white text-[10px] uppercase font-black tracking-wider py-1.5 px-3 rounded-lg transition-all"
                          >
                            Kirim &amp; Periksa 📬
                          </button>

                          {remedialChecked && (
                            <div className="bg-green-100 border border-green-300 text-green-900 p-2 rounded-lg text-xs flex items-center gap-1.5 animate-fadeIn">
                              <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                              <span>Luar biasa! Konsep dasar kamu sudah kokoh. Lanjutkan ke HOTS!</span>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* ROW PRO: ADVANCED LEAP (DARK NAVY THEME) */}
                      <div className="bg-indigo-950 text-white rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-[-10px] bottom-[-10px] text-6xl opacity-10 font-bold select-none">HOTS</div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black bg-indigo-900 text-indigo-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                              Advanced Leap (Tantangan HOTS) 🚀
                            </span>
                            <span className="text-xs">🏆</span>
                          </div>

                          <h4 className="text-sm font-bold text-yellow-300 mb-2">
                            {module.scaffolding.advancedTitle}
                          </h4>

                          <div className="text-xs text-indigo-100 leading-relaxed bg-indigo-900/60 rounded-xl p-3 border border-indigo-800 whitespace-pre-wrap mb-4">
                            <ReactMarkdown>{module.scaffolding.advancedContent}</ReactMarkdown>
                          </div>
                        </div>

                        {/* Interactive Workbook Area */}
                        <div className="no-print space-y-2 mt-2 pt-2 border-t border-indigo-800">
                          <label className="block text-[10px] font-bold text-indigo-300 uppercase">
                            Solusi Kreatif Kamu:
                          </label>
                          <textarea
                            value={studentAdvancedAnswer}
                            onChange={(e) => setStudentAdvancedAnswer(e.target.value)}
                            placeholder="Analisislah skenario HOTS di atas dan ungkapkan ide cemerlangmu di sini..."
                            className="w-full text-xs bg-indigo-900 text-white border border-indigo-800 focus:border-yellow-400 p-2 rounded-lg outline-none resize-none h-14"
                          />
                          <button
                            onClick={() => {
                              if (!studentAdvancedAnswer.trim()) {
                                alert("Silakan tulis argumen kamu terlebih dahulu!");
                                return;
                              }
                              setAdvancedChecked(true);
                            }}
                            className="bg-yellow-400 hover:bg-yellow-300 text-indigo-950 text-[10px] uppercase font-black tracking-wider py-1.5 px-3 rounded-lg transition-all"
                          >
                            Ajukan Solusi Kreatif 💡
                          </button>

                          {advancedChecked && (
                            <div className="bg-yellow-100 text-yellow-950 p-2 rounded-lg text-xs flex items-center gap-1.5 animate-fadeIn">
                              <Award size={14} className="text-yellow-600 flex-shrink-0" />
                              <span>Hebat! Analisis kreatifmu sudah terekam di sistem GenZi Academy.</span>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  </div>

                </div>

                {/* INTERACTIVE EDITOR SECTION: REFIENER / REWRITER (No-print) */}
                <div className="no-print bg-white rounded-3xl p-5 border-2 border-dashed border-indigo-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 size={16} className="text-indigo-600 animate-pulse" />
                    <h4 className="text-sm font-black text-slate-900 font-display">
                      Penyelarasan &amp; Penyesuaian AI Cepat (Pak GuruAI Assistant)
                    </h4>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-4">
                    Kurang sreg dengan bagian tertentu? Pilih bagian target di bawah, lalu masukkan perintah asisten untuk merevisi 
                    gaya bahasa, memperbanyak emoji, menambahkan analogi daerah, ataupun mengganti sub-materi secara langsung.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <select
                      value={refineTarget}
                      onChange={(e) => setRefineTarget(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-indigo-600"
                    >
                      <option value="all">Satu Modul Utuh (Gaya Bahasa)</option>
                      <option value="title">Judul &amp; Pertanyaan Pemantik saja</option>
                      <option value="mindMap">Sistematika Mind Map saja</option>
                      <option value="chapters">Isi Sub-Bab Ajar saja</option>
                      <option value="scaffolding">Jalur Diferensiasi (Dasar/HOTS) saja</option>
                    </select>

                    <input
                      type="text"
                      value={refineInstruction}
                      onChange={(e) => setRefineInstruction(e.target.value)}
                      placeholder="Contoh: Jadikan bahasa jauh lebih sederhana kayak anak SD kelas 4, tambah analogi masak nasi goreng"
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-600"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRefineModule();
                      }}
                    />

                    <button
                      onClick={handleRefineModule}
                      disabled={refining}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1 shrink-0"
                    >
                      {refining ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Menyelaraskan...
                        </>
                      ) : (
                        "Terapkan Penyempurnaan 🪄"
                      )}
                    </button>
                  </div>

                  {refineSuccess && (
                    <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1.5 animate-pulse">
                      ✅ Berhasil diselaraskan! Bagian {refineTarget === "all" ? "Seluruh Modul" : refineTarget} telah berhasil ditulis ulang sesuai arahan.
                    </p>
                  )}
                </div>

                {/* THE MANDATORY PRINT FOOTER */}
                <div className="bg-white border-t border-slate-200 py-4 flex items-center justify-center px-4 rounded-3xl">
                  <p className="text-[10px] text-center font-medium text-slate-400 tracking-tight">
                    Footer: @Copyright GenZi Academy by. Pak GuruAI | Modul ini dapat diunduh dalam format PDF resmi melalui platform GenZi Academy.
                  </p>
                </div>

              </div>
            )}

            {/* IF EMPTY VIEW GUIDES (no-print) */}
            {!module && !loading && (
              <div className="no-print bg-white rounded-3xl p-12 border border-slate-100 flex flex-col items-center text-center justify-center space-y-4">
                <span className="text-5xl">🔭</span>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Belum Ada Modul Aktif</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Pilih salah satu <strong>Materi Preset Terpilih</strong> di sebelah kiri atau tentukan tema belajar kamu sendiri, lalu klik buat modul untuk memulai petualangan sains interaktif!
                  </p>
                </div>
              </div>
            )}

          </main>

        </div>

      </div>

      </div> {/* Closes no-print container */}

      {/* DEDICATED PRINT-ONLY A4 DOCUMENT VIEW */}
      {module && (
        <div className="hidden print:block print-only bg-white text-slate-900 p-8 space-y-8 font-sans max-w-4xl mx-auto">
          {/* Institution Header Block */}
          <div className="border-b-4 border-indigo-600 pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-indigo-900 uppercase font-display leading-none">GenZi Academy</h1>
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase mt-1">by. Pak GuruAI</p>
            </div>
            <div className="text-right">
              <span className="print-badge border border-slate-900 px-3 py-1 text-xs font-bold rounded-full uppercase">
                Modul Ajar Resmi
              </span>
              <p className="text-[10px] text-slate-500 mt-1">Kurikulum Merdeka Belajar</p>
            </div>
          </div>

          {/* Module Meta Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Jenjang &amp; Kelas/Jurusan</p>
              <p className="text-sm font-extrabold text-slate-800">{module.jenjang} - {module.kelas}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Materi Pokok (Topic)</p>
              <p className="text-sm font-extrabold text-slate-800">{module.materi}</p>
            </div>
          </div>

          {/* Title and Essential Question */}
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-indigo-950 font-display">{module.title}</h2>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-xl">
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Pertanyaan Pemantik (Essential Question)</p>
              <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                "Bagaimana sebuah perubahan kecil dalam hidupmu atau komponen alam sekitar dapat mendikte kelangsungan sistem yang sangat besar? 🤔"
              </p>
            </div>
          </div>

          {/* Mind Map Block */}
          <div className="print-card">
            <h3 className="text-sm font-black text-indigo-800 uppercase tracking-tight mb-3 border-b pb-1">
              🗺️ Navigasi Mind Map (Big Picture)
            </h3>
            <pre className="text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {module.mindMap}
            </pre>
          </div>

          {/* All Chapters Sequentially */}
          <div className="space-y-6">
            <h3 className="text-md font-black text-indigo-900 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
              📖 Bab Utama (Micro-learning &amp; Deep Learning)
            </h3>
            {module.chapters.map((chap, idx) => (
              <div key={idx} className="print-card space-y-3">
                <h4 className="text-sm font-black text-slate-900 uppercase">
                  Bab {idx + 1}: {chap.chapterTitle}
                </h4>
                <div className="prose prose-sm text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  <ReactMarkdown>{chap.chapterContent}</ReactMarkdown>
                </div>
                {chap.insightBox && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-950 italic font-medium">
                    <p className="text-[9px] font-bold text-purple-600 uppercase not-italic mb-1">💡 Kotak Wawasan (Insight Box)</p>
                    {chap.insightBox}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scaffolding Differentiation */}
          <div className="grid grid-cols-1 gap-6">
            <div className="print-card">
              <h4 className="text-xs font-black text-pink-700 uppercase tracking-wider mb-2 border-b pb-1">
                🛠️ Jalur Dasar / Remedial (Basic Scaffold)
              </h4>
              <p className="text-xs font-bold text-slate-800 mb-2">{module.scaffolding.remedialTitle}</p>
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border whitespace-pre-wrap">
                <ReactMarkdown>{module.scaffolding.remedialContent}</ReactMarkdown>
              </div>
            </div>

            <div className="print-card">
              <h4 className="text-xs font-black text-indigo-800 uppercase tracking-wider mb-2 border-b pb-1">
                🏆 Advanced Leap / Pengayaan (Tantangan HOTS)
              </h4>
              <p className="text-xs font-bold text-slate-800 mb-2">{module.scaffolding.advancedTitle}</p>
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border whitespace-pre-wrap">
                <ReactMarkdown>{module.scaffolding.advancedContent}</ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="border-t border-slate-200 pt-4 text-center">
            <p className="text-[10px] font-medium text-slate-400">
              Footer: @Copyright GenZi Academy by. Pak GuruAI | Modul ini dapat diunduh dalam format PDF resmi melalui platform GenZi Academy.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
