import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../types";
import { Play, Send, Sparkles, RotateCcw, AlertCircle, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SandboxPlaygroundProps {
  systemPrompt: string;
}

export default function SandboxPlayground({ systemPrompt }: SandboxPlaygroundProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleReset = () => {
    setMessages([]);
    setErrorStatus(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    setErrorStatus(null);
    const userText = inputValue.trim();
    setInputValue("");

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      message: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      // Create simplified history for backend payload
      // Backends formats it as role: assistant | user
      const payloadHistory = messages.map((m) => ({
        role: m.role,
        message: m.message,
      }));

      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          message: userText,
          history: payloadHistory,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        message: data.reply || "No output returned.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.error("Playground session error:", err);
      setErrorStatus(err?.message || "Failed to generate model response.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!systemPrompt) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/30 text-center">
        <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-3" />
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">No Prompt Active</p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-xs mt-1">
          Set up parameters on the left and hit <strong>"Architect System Prompt"</strong> to compile a prompt, then use this Playground to test-drive its execution live!
        </p>
      </div>
    );
  }

  return (
    <div id="sandbox-playground" className="flex flex-col h-[520px] border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      {/* Playground Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Prompt Sandbox Active</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-550 hidden sm:inline">| System instructions loaded sandbox container</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-450 hover:text-neutral-800 dark:hover:text-neutral-200 transition px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Chat
        </button>
      </div>

      {/* Active System Instruction quick panel */}
      <div className="px-3.5 py-2.5 bg-neutral-100/50 dark:bg-neutral-950/20 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-4 h-4 text-neutral-500 dark:text-neutral-450 shrink-0" />
          <p className="text-[11px] text-neutral-500 dark:text-neutral-450 font-mono truncate">
            Active System Instruction loaded: "{systemPrompt.slice(0, 80)}..."
          </p>
        </div>
        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-200/50 dark:bg-neutral-800 px-2 py-0.5 rounded shrink-0 select-none">
          Gemini 3.5 Flash
        </div>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/30 dark:bg-neutral-950/10 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-white dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-800 rounded-lg mx-4 my-2">
            <Play className="w-6 h-6 text-neutral-300 dark:text-neutral-700 mb-2 rotate-90" />
            <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Immediate Test Playground</h5>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm mt-1 leading-normal">
              Test your newly architected system rules! Provide input goals or scenarios to verify if the model enforces your constraints, holds the persona specialty, and behaves as expected.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-neutral-400 dark:text-neutral-500 px-1">
                  <span>{isUser ? "User Input" : "Persona Response"}</span>
                  <span>•</span>
                  <span>{m.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] text-xs leading-relaxed px-3.5 py-2.5 rounded-lg shadow-sm border ${
                    isUser
                      ? "bg-neutral-900 dark:bg-neutral-950 border-neutral-800 dark:border-neutral-900 text-white rounded-tr-none"
                      : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-tl-none"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{m.message}</p>
                  ) : (
                    <div className="markdown-body space-y-1 overflow-x-auto dark:prose-invert">
                      <ReactMarkdown>{m.message}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1 mb-1 text-[10px] text-neutral-400 dark:text-neutral-500 px-1">
              <span>Generating response...</span>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg rounded-tl-none p-3 max-w-[85%] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-550"></span>
              </span>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">Cognitive execution in progress...</p>
            </div>
          </div>
        )}

        {/* Error presentation */}
        {errorStatus && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Playground Error:</span> {errorStatus}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-2">
        <input
          id="sandbox-message-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          placeholder="Type a goal or command to test prompt..."
          className="flex-1 text-xs px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 dark:focus:ring-neutral-700 dark:focus:border-neutral-700 dark:text-white disabled:opacity-50"
        />
        <button
          id="sandbox-send-btn"
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="px-3 py-2 bg-neutral-900 dark:bg-neutral-950 text-white rounded-md hover:bg-neutral-850 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center border border-transparent dark:border-neutral-800"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
