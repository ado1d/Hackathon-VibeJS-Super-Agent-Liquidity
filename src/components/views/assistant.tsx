"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useSaliStore } from "@/lib/store";
import { ROLES } from "@/lib/config";
import { Pill } from "@/components/app/primitives";
import {
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
  Loader2,
  User,
  Bot,
  Trash2,
  AlertTriangle,
  Volume2,
  Mic,
  Square,
} from "lucide-react";
import { toast } from "sonner";

// Web Speech API type shim
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  ts: number;
}

const SUGGESTED = [
  "What's the network status?",
  "Which providers are running low?",
  "Which outlets are under most pressure?",
  "Are there any unusual activity alerts?",
  "How many open coordination cases?",
];

export function AssistantView() {
  const role = useSaliStore((s) => s.role);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello! I'm SALI Assistant. I can answer questions about the synthetic network — liquidity, anomalies, agent pressure, and coordination cases. I'm advisory only: I never execute actions or declare fraud. You're viewing as ${ROLES.find((r) => r.key === role)?.name}.`,
      source: "fallback",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice output: fetch TTS audio and play it
  async function speak(msgId: string, text: string) {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setSpeakingId(msgId);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      await audio.play();
      toast.success("Speaking…", { description: "Voice output enabled." });
    } catch {
      toast.error("Voice output failed", { description: "Could not generate speech." });
      setSpeakingId(null);
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }

  // Voice input: use the browser's Web Speech API for speech-to-text
  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported", { description: "Use Chrome/Edge for speech recognition." });
      return;
    }
    const rec: SpeechRecognitionLike = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      toast.success("Heard: " + transcript.slice(0, 40) + (transcript.length > 40 ? "…" : ""));
    };
    rec.onerror = (e: any) => {
      toast.error("Voice input error", { description: e.error || "Could not capture speech." });
      setListening(false);
    };
    rec.onend = () => { setListening(false); };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    toast.info("Listening…", { description: "Speak your question." });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      // Send conversation history (exclude the welcome message) for follow-up context.
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const r = await api.assistant(question, role, history);
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: r.answer,
        source: r.source,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch {
      toast.error("Assistant failed to respond");
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "Sorry, I couldn't process that. Please try again.", source: "fallback", ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Chat cleared. Ask me anything about the synthetic network. You're viewing as ${ROLES.find((r) => r.key === role)?.name}.`,
        source: "fallback",
        ts: Date.now(),
      },
    ]);
  }

  return (
    <div className="space-y-4 fade-up">
      {/* Header */}
      <div className="surface rounded-xl p-4 flex items-center gap-3">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">AI Operations Assistant</div>
          <div className="text-[11px] text-muted-foreground">
            Natural-language Q&A about the synthetic network. Advisory only — never executes actions or declares fraud.
          </div>
        </div>
        <button onClick={clearChat} className="grid place-items-center w-8 h-8 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors" title="Clear chat">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chat area */}
      <div className="surface rounded-xl flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5 slide-in", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("grid place-items-center w-7 h-7 rounded-lg shrink-0 mt-0.5", m.role === "user" ? "bg-primary/15 text-primary" : "bg-violet-500/15 text-violet-300")}>
                {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={cn("max-w-[80%] rounded-lg p-3", m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-card/60 border border-border")}>
                {m.role === "assistant" && m.source && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {m.source === "ai" ? (
                      <Pill className="border-violet-500/30 text-violet-300 bg-violet-500/10 text-[9px]">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </Pill>
                    ) : (
                      <Pill className="border-sky-500/30 text-sky-300 bg-sky-500/10 text-[9px]">
                        <ShieldCheck className="w-2.5 h-2.5" /> safe fallback
                      </Pill>
                    )}
                  </div>
                )}
                <p className="text-[12.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap">{m.content}</p>
                {m.role === "assistant" && m.id !== "welcome" && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1">
                    {speakingId === m.id ? (
                      <button
                        onClick={stopSpeaking}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                        title="Stop voice"
                      >
                        <Square className="w-2.5 h-2.5 fill-current" /> Stop voice
                      </button>
                    ) : (
                      <button
                        onClick={() => speak(m.id, m.content)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                        title="Speak this answer"
                      >
                        <Volume2 className="w-2.5 h-2.5" /> Speak
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2.5 slide-in">
              <div className="grid place-items-center w-7 h-7 rounded-lg shrink-0 mt-0.5 bg-violet-500/15 text-violet-300">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="rounded-lg p-3 bg-card/60 border border-border flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing network context…
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3 flex items-center gap-2">
          <button
            onClick={toggleListening}
            disabled={busy}
            className={cn(
              "grid place-items-center w-9 h-9 rounded-md border transition-colors shrink-0",
              listening
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            placeholder={listening ? "Listening…" : "Ask about liquidity, anomalies, pressure, cases…"}
            disabled={busy}
            className="flex-1 h-9 rounded-md border border-border bg-card/60 px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          />
          <button
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            className="grid place-items-center w-9 h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Safety note */}
      <div className="surface rounded-xl p-3 flex items-start gap-2 border-l-2 border-amber-500/40">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The assistant uses live network context + an LLM with strict safety rules. It never declares fraud, never recommends blocking/freezing/accusing, and always reminds that human review is required. If the LLM is unavailable, a safe template fallback is used. All data is synthetic.
        </p>
      </div>
    </div>
  );
}
