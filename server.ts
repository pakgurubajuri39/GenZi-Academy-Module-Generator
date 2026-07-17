import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper check
if (!apiKey) {
  console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not defined.");
}

/**
 * Robust content generation helper that retries on rate limits or service unavailability (503)
 * with exponential backoff, and falls back to alternatives if a particular model is overloaded.
 */
async function generateContentWithRetry(params: any, retries = 2, delay = 800) {
  let lastError: any = null;
  
  const { model: requestedModel, ...restParams } = params;
  
  // List of high-reliability alternative general-purpose models to fall back to
  const modelsToTry = [
    requestedModel || "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro"
  ];

  // Dedup models to avoid redundant attempts
  const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));

  for (const model of uniqueModels) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...restParams,
          model: model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || "").toLowerCase();
        
        // Check for unauthorized issues
        if (err?.code === 401 || err?.code === 403 || err?.status === 401 || err?.status === 403) {
          console.log(`🚨 [Gemini API] Auth failure (Code ${err?.code}):`, err.message);
          throw err;
        }

        console.log(`📡 [Gemini API] Model ${model} info (attempt ${attempt}/${retries}): ${err?.message || err}`);

        // If it's a 404, or the model is explicitly unsupported or not found, skip immediately to the next model.
        // Also skip on bad request error (400) if it's a structural request issue (e.g., unsupported parameter).
        // We MUST NOT skip on 503 (Unavailable) or 429 (Resource Exhausted) errors, which should be retried first.
        const isModelNotFoundError = 
          err?.code === 404 || err?.status === 404 ||
          err?.code === 400 || err?.status === 400 ||
          errMsg.includes("not found") || 
          errMsg.includes("not support") || 
          errMsg.includes("not exist") ||
          errMsg.includes("unsupported") ||
          errMsg.includes("invalid model");

        if (isModelNotFoundError && err?.code !== 503 && err?.status !== 503) {
          console.log(`📡 [Gemini API] Model ${model} returned a structural or compatibility error. Transitioning to next model...`);
          break; // Break current retry loop to switch to next model immediately
        }

        if (attempt < retries) {
          const waitMs = delay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }
  }

  throw lastError || new Error("Failed to communicate with any Gemini API fallback services");
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Generate educational module
app.post("/api/generate-module", async (req, res) => {
  try {
    const { jenjang, kelas, materi, customPrompt = "" } = req.body;

    if (!jenjang || !kelas || !materi) {
      return res.status(400).json({ error: "Missing required parameters: jenjang, kelas, materi" });
    }

    const systemInstruction = `You are "Pak GuruAI", an expert curriculum developer, pedagogical specialist, and beloved lead tutor at "GenZi Academy by. Pak GuruAI". Your mission is to write an exhaustive, deeply engaging, and beautifully designed modular lesson planner/study guide based on the "Deep Learning" paradigm in Indonesian (Bahasa Populer-Edukatif).

Every module you generate must strictly adapt to the selected grade/level:
- SD (Kelas 4-6): Very high energy, warm, extremely friendly, full of interactive questions, simple and funny everyday analogies, lots of emojis, short sentences. Explain complex terms immediately with goofy metaphors (e.g., gravity is "Bumi suka peluk benda").
- SMP (Kelas 7-9): Conversational, collaborative, and peer-like. Address teen status, identity, social context, digital or mobile-friendly scenarios (TikTok, YouTube, games). Relatable analogies.
- SMA (Kelas 10-11 IPA/IPS): Logical, structured, intellectually stimulating yet accessible. Connect heavily to practical analytics, reasoning, and future career context (e.g., "sebagai asisten lab", "pendekatan ekonomi makro"). Clear of textbook boredom.

Strict structural requirements:
1. Title & Essential Question (Pertanyaan Pemantik)
2. Text-Based Visual Mind Map (Hierarchical breakdown of concepts using emojis, bullet indentation, and visual symbols or checklist symbols like [ ], [x], ➔, ➥)
3. Three distinct deep-learningchapters/sub-chapters (Micro-learning chunks). Content MUST follow "Conceptual Before Procedural" (explain the "Why" and historical or real-world context before formulas or rules). Explicitly write out the FULL thorough content of each chapter, NO lazy placeholders or shortened summaries. Each chapter must include an "Insight Box" in its fields.
4. Scaffolding & Differentiation activity block. First is Basic Scaffold (Jalur Dasar/Remedial) containing simple step-by-step breakdown or checklist. Second is Advanced Leap (Jalur Pengayaan/HOTS) with critical analysis, open-ended real-world problem statement, or creative challenge.
5. Footer: Write the copyright block exactly as: "Footer: @Copyright GenZi Academy by. Pak GuruAI | Modul ini dapat diunduh dalam format PDF resmi melalui platform GenZi Academy."`;

    const instructionsPrompt = `Generate a fully completed, highly detailed deep learning module for:
- Jenjang: ${jenjang}
- Kelas/Jurusan: ${kelas}
- Topic Matter (Materi): ${materi}
${customPrompt ? `- Special Instructions: ${customPrompt}` : ""}

Ensure the response strictly complies with the requested JSON format, and make sure that and the generated content has rich, thorough paragraphs (min 150-250 words per chapter) and is fully written in Indonesian (Bahasa Populer-Edukatif). Avoid any concise summaries.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: instructionsPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Engaging and age-appropriate topic title and essential question." },
            mindMap: { type: Type.STRING, description: "Hierarchical markdown representation of concepts using emojis, lists, and arrows." },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chapterTitle: { type: Type.STRING, description: "Engaging chapter title." },
                  chapterContent: { type: Type.STRING, description: "Full complete chapter text body. Real-world analogies, deep concept before procedure. Do not leave summaries." },
                  insightBox: { type: Type.STRING, description: "Misconception, fun fact, or alert tip. Will be rendered separately." }
                },
                required: ["chapterTitle", "chapterContent", "insightBox"]
              }
            },
            scaffolding: {
              type: Type.OBJECT,
              properties: {
                remedialTitle: { type: Type.STRING, description: "Title for basic scaffold" },
                remedialContent: { type: Type.STRING, description: "Structured step-by-step basic help guides, simple hints, or fill-in questions." },
                advancedTitle: { type: Type.STRING, description: "Title for high order thinking" },
                advancedContent: { type: Type.STRING, description: "Open ended problems, real-world scenario analysis, or challenging prompts." }
              },
              required: ["remedialTitle", "remedialContent", "advancedTitle", "advancedContent"]
            },
            footer: { type: Type.STRING, description: "The specific footnote copyright notice." }
          },
          required: ["title", "mindMap", "chapters", "scaffolding", "footer"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI generation model");
    }

    const payload = JSON.parse(resultText);
    res.json(payload);
  } catch (err: any) {
    console.error("Module generation error:", err);
    const errMsg = (err?.message || "").toLowerCase();
    const isTrafficBusy = 
      errMsg.includes("503") || 
      errMsg.includes("unavailable") || 
      errMsg.includes("high demand") || 
      errMsg.includes("429") || 
      errMsg.includes("resource_exhausted") ||
      errMsg.includes("quota") ||
      errMsg.includes("busy");

    const friendlyMsg = isTrafficBusy 
      ? "Layanan server AI sedang sangat padat karena lalu lintas tinggi (Status 503/429). Jangan khawatir! Silakan tekan tombol 'Buat Rancangan Modul' sekali lagi untuk mencoba kembali."
      : `Gagal menghasilkan modul: ${err.message || "Kesalahan server internal"}`;

    res.status(500).json({ error: friendlyMsg });
  }
});

// Refine/Edit section of module
app.post("/api/refine-module", async (req, res) => {
  try {
    const { currentModule, editTarget, instruction } = req.body;

    if (!currentModule || !instruction) {
      return res.status(400).json({ error: "Missing module data or adjustment instructions" });
    }

    const systemInstruction = `You are "Pak GuruAI" from "GenZi Academy by. Pak GuruAI". You will help adjust, polish, or rewrite parts of an existing learning module.
The user wants to revise a specific section or update the entire module based on feedback. 

If 'editTarget' is 'all', revise the general tone/format.
If 'editTarget' is a specific section (such as 'title', 'mindMap', 'chapters', 'scaffolding'), output the updated JSON in the same schema format.
You must output ONLY a valid JSON object matching the original module structure with the requested modifications applied. DO NOT include any other text beside JSON.`;

    const promptMessage = `Original Module Content:
${JSON.stringify(currentModule, null, 2)}

Target Area of Revision: ${editTarget || "all"}
Correction or Refinement Request: "${instruction}"

Keep the structure identical to the original JSON. Redraft the requested elements using Bahasa Populer-Edukatif appropriate for ${currentModule.jenjang || "the requested grade"} and preserving GenZi Academy branding and the mandatory footer.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mindMap: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chapterTitle: { type: Type.STRING },
                  chapterContent: { type: Type.STRING },
                  insightBox: { type: Type.STRING }
                },
                required: ["chapterTitle", "chapterContent", "insightBox"]
              }
            },
            scaffolding: {
              type: Type.OBJECT,
              properties: {
                remedialTitle: { type: Type.STRING },
                remedialContent: { type: Type.STRING },
                advancedTitle: { type: Type.STRING },
                advancedContent: { type: Type.STRING }
              },
              required: ["remedialTitle", "remedialContent", "advancedTitle", "advancedContent"]
            },
            footer: { type: Type.STRING }
          },
          required: ["title", "mindMap", "chapters", "scaffolding", "footer"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI refinement model");
    }

    const payload = JSON.parse(resultText);
    res.json(payload);
  } catch (err: any) {
    console.error("Module refinement error:", err);
    const errMsg = (err?.message || "").toLowerCase();
    const isTrafficBusy = 
      errMsg.includes("503") || 
      errMsg.includes("unavailable") || 
      errMsg.includes("high demand") || 
      errMsg.includes("429") || 
      errMsg.includes("resource_exhausted") ||
      errMsg.includes("quota") ||
      errMsg.includes("busy");

    const friendlyMsg = isTrafficBusy 
      ? "Layanan server AI sedang sangat padat karena lalu lintas tinggi (Status 503/429). Jangan khawatir! Silakan tekan tombol 'Pikirkan Ulang / Selaraskan' sekali lagi untuk mencoba kembali."
      : `Gagal menyelaraskan modul: ${err.message || "Kesalahan server internal"}`;

    res.status(500).json({ error: friendlyMsg });
  }
});

// Text-to-speech Indonesian read-aloud endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text content is required for voice generation" });
    }

    // Moderate length for free-tier speed and constraints
    const cleanText = text.replace(/[#*`>_~|]/g, "").substring(0, 300);

    let response;
    let lastError;
    const maxTtsRetries = 3;
    
    for (let attempt = 1; attempt <= maxTtsRetries; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: `Say warmly and clearly in Indonesian as a helpful online tutor: ${cleanText}` }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        break; // Success!
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ [TTS API] Attempt ${attempt}/${maxTtsRetries} failed:`, err.message || err);
        if (attempt < maxTtsRetries) {
          const waitMs = 800 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to generate TTS audio after retrying");
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(500).json({ error: "TTS generation returned empty audio data" });
    }
  } catch (err: any) {
    console.error("TTS endpoint error:", err);
    res.status(500).json({ error: err.message || "Internal server error during voice synthesis" });
  }
});

// -------------------------------------------------------------
// Vite or Static Assets Serving
// -------------------------------------------------------------
async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [GenZi Academy Server] running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
