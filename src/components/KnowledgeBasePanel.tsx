"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Brain, Upload, FileText, Trash2, Plus, Check, X, Globe,
  ChevronDown, ChevronUp, Database, BookOpen, Zap, AlertCircle,
  Loader2, CheckCircle2, Tag, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aceApi } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KBCollection {
  collection_id: string;
  name: string;
  file_name: string;
  file_type: string;
  chunk_count: number;
  character_count: number;
  tags: string[];
  created_at: string;
  status: string;
}

export interface InstructionProfile {
  profile_id: string;
  name: string;
  instructions: string;
  tags: string[];
  created_at: string;
}

export interface KnowledgeSnippet {
  snippet_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Phase3Context {
  knowledge_collections: string[];     // collection IDs
  instruction_profiles: string[];       // profile IDs
  direct_text?: string;
  web_search_enabled: boolean;
}

interface KnowledgeBasePanelProps {
  onContextChange?: (ctx: Phase3Context) => void;
  className?: string;
}

const FILE_TYPES = [
  { value: "txt",  label: "TXT",  icon: "📄" },
  { value: "pdf",  label: "PDF",  icon: "📕" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function KnowledgeBasePanel({ onContextChange, className }: KnowledgeBasePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // KB state
  const [collections, setCollections] = useState<KBCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState("pdf"); // Default to pdf as requested
  const [hasLoadedPersisted, setHasLoadedPersisted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instructions state
  const [profiles, setProfiles] = useState<InstructionProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileText, setNewProfileText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Section visibility
  const [kbExpanded, setKbExpanded] = useState(true);
  const [instrExpanded, setInstrExpanded] = useState(false);
  const [directTextExpanded, setDirectTextExpanded] = useState(false);
  const [directText, setDirectText] = useState("");

  // Web search — always enabled
  const webSearchEnabled = true;

  const [persistedDirectText, setPersistedDirectText] = useState("");
  const [savingDirectText, setSavingDirectText] = useState(false);

  // Snippets state
  const [snippets, setSnippets] = useState<KnowledgeSnippet[]>([]);
  const [selectedSnippetIds, setSelectedSnippetIds] = useState<string[]>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [savingSnippet, setSavingSnippet] = useState(false);

  // ── Persistence ─────────────────────────────────────────────────────────────

  const STORAGE_KEYS = {
    COLLECTIONS: "ace_kb_selected_collections",
    PROFILES: "ace_kb_selected_profiles",
    SNIPPETS: "ace_kb_selected_snippets",
    FILE_TYPE: "ace_kb_selected_file_type",
  };

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadCollections = useCallback(async () => {
    setLoadingCollections(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/knowledge/collections");
      const data = await res.json();
      if (data.success) setCollections(data.collections || []);
    } catch { /* silent */ }
    setLoadingCollections(false);
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/instructions");
      const data = await res.json();
      if (data.success) setProfiles(data.profiles || []);
    } catch { /* silent */ }
    setLoadingProfiles(false);
  }, []);

  const loadDirectKnowledge = useCallback(async () => {
    try {
      const res = await aceApi.secureFetchPublic("/api/user/direct-knowledge");
      const data = await res.json();
      if (data.success) {
        const text = data.direct_text || "";
        setDirectText(text);
        setPersistedDirectText(text);
      }
    } catch { /* silent */ }
  }, []);

  const loadSnippets = useCallback(async () => {
    setLoadingSnippets(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/user/knowledge-snippets");
      const data = await res.json();
      if (data.success) setSnippets(data.snippets || []);
    } catch { /* silent */ }
    setLoadingSnippets(false);
  }, []);

  const saveDirectKnowledge = async () => {
    setSavingDirectText(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/user/direct-knowledge", {
        method: "POST",
        body: JSON.stringify({ text: directText }),
      });
      const data = await res.json();
      if (data.success) {
        setPersistedDirectText(directText);
      }
    } catch { /* silent */ }
    setSavingDirectText(false);
  };

  const saveAsSnippet = async () => {
    if (!directText.trim()) return;
    setSavingSnippet(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/user/knowledge-snippets", {
        method: "POST",
        body: JSON.stringify({ content: directText }),
      });
      const data = await res.json();
      if (data.success) {
        await loadSnippets();
        setSelectedSnippetIds(prev => [...prev, data.snippet_id]);
        setDirectText(""); // Clear after saving to snippets
      }
    } catch { /* silent */ }
    setSavingSnippet(false);
  };

  const deleteSnippet = async (id: string) => {
    try {
      await aceApi.secureFetchPublic(`/api/user/knowledge-snippets?id=${id}`, { method: "DELETE" });
      setSnippets(prev => prev.filter(s => s.snippet_id !== id));
      setSelectedSnippetIds(prev => prev.filter(x => x !== id));
    } catch { /* silent */ }
  };

  const toggleSnippet = (id: string) => {
    setSelectedSnippetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    loadCollections();
    loadProfiles();
    loadDirectKnowledge();
    loadSnippets();

    // Load persisted selections
    try {
      const savedColls = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      if (savedColls) setSelectedCollections(JSON.parse(savedColls));

      const savedProfs = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (savedProfs) setSelectedProfiles(JSON.parse(savedProfs));

      const savedSnips = localStorage.getItem(STORAGE_KEYS.SNIPPETS);
      if (savedSnips) setSelectedSnippetIds(JSON.parse(savedSnips));

      const savedFileType = localStorage.getItem(STORAGE_KEYS.FILE_TYPE);
      if (savedFileType) setSelectedFileType(savedFileType);
    } catch (e) {
      console.error("Failed to load KB selections from localStorage", e);
    } finally {
      setHasLoadedPersisted(true);
    }
  }, [loadCollections, loadProfiles, loadDirectKnowledge, loadSnippets]);

  // Save selections to localStorage
  useEffect(() => {
    if (!hasLoadedPersisted) return;
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(selectedCollections));
  }, [selectedCollections, hasLoadedPersisted]);

  useEffect(() => {
    if (!hasLoadedPersisted) return;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(selectedProfiles));
  }, [selectedProfiles, hasLoadedPersisted]);

  useEffect(() => {
    if (!hasLoadedPersisted) return;
    localStorage.setItem(STORAGE_KEYS.SNIPPETS, JSON.stringify(selectedSnippetIds));
  }, [selectedSnippetIds, hasLoadedPersisted]);

  useEffect(() => {
    if (!hasLoadedPersisted) return;
    localStorage.setItem(STORAGE_KEYS.FILE_TYPE, selectedFileType);
  }, [selectedFileType, hasLoadedPersisted]);

  // Notify parent when selection changes
  useEffect(() => {
    const combinedDirectText = [
      directText,
      ...snippets
        .filter(s => selectedSnippetIds.includes(s.snippet_id))
        .map(s => s.content)
    ].filter(Boolean).join("\n\n---\n\n");

    onContextChange?.({
      knowledge_collections: selectedCollections,
      instruction_profiles: selectedProfiles,
      direct_text: combinedDirectText,
      web_search_enabled: webSearchEnabled,
    });
  }, [selectedCollections, selectedProfiles, directText, selectedSnippetIds, snippets, webSearchEnabled, onContextChange]);

  // ── Upload handler ────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext !== selectedFileType && !["txt","pdf"].includes(ext)) {
      setUploadStatus({ type: "error", msg: `Expected .${selectedFileType} file` });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("collection_name", collectionName || file.name);
      fd.append("file_type", ext);

      const res = await aceApi.secureFetchPublic("/api/knowledge/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.success) {
        setUploadStatus({ type: "success", msg: `Uploaded: ${data.chunk_count} chunks indexed` });
        setCollectionName("");
        await loadCollections();
        // Auto-select new collection
        setSelectedCollections(prev => [...prev, data.collection_id]);
      } else {
        setUploadStatus({ type: "error", msg: data.error || "Upload failed" });
      }
    } catch (err: unknown) {
      setUploadStatus({ type: "error", msg: err instanceof Error ? err.message : "Upload failed" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteCollection = async (id: string) => {
    try {
      await aceApi.secureFetchPublic(`/api/knowledge/collections?id=${id}`, { method: "DELETE" });
      setCollections(prev => prev.filter(c => c.collection_id !== id));
      setSelectedCollections(prev => prev.filter(x => x !== id));
    } catch { /* silent */ }
  };

  const toggleCollection = (id: string) => {
    setSelectedCollections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Instruction Profile handlers ───────────────────────────────────────────

  const saveProfile = async () => {
    if (!newProfileName.trim() || !newProfileText.trim()) return;
    setSavingProfile(true);
    try {
      const res = await aceApi.secureFetchPublic("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProfileName, instructions: newProfileText, tags: [] }),
      });
      const data = await res.json();
      if (data.success) {
        await loadProfiles();
        setSelectedProfiles(prev => [...prev, data.profile_id]);
        setNewProfileName("");
        setNewProfileText("");
        setShowNewProfile(false);
      }
    } catch { /* silent */ }
    setSavingProfile(false);
  };

  const deleteProfile = async (id: string) => {
    try {
      await aceApi.secureFetchPublic(`/api/instructions?id=${id}`, { method: "DELETE" });
      setProfiles(prev => prev.filter(p => p.profile_id !== id));
      setSelectedProfiles(prev => prev.filter(x => x !== id));
    } catch { /* silent */ }
  };

  const toggleProfile = (id: string) => {
    setSelectedProfiles(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeCount = selectedCollections.length + selectedProfiles.length + selectedSnippetIds.length + 1; // +1 for web search

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/80 border border-white/10 hover:border-cyan-500/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="w-4 h-4 text-cyan-400" />
            {activeCount > 1 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-cyan-500 text-[7px] font-black text-black flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-black text-white tracking-widest uppercase">
            Phase 3 · Knowledge Base &amp; Instructions
          </span>
          {/* Always-on web search badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-[8px] font-bold text-emerald-400 tracking-wider uppercase">
            <Globe className="w-2.5 h-2.5" />
            Web Search ON
          </span>
        </div>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {/* Active grounding indicator - visible in header or just below when collapsed */}
      {!isExpanded && (selectedCollections.length > 0 || selectedProfiles.length > 0 || selectedSnippetIds.length > 0 || directText.trim()) && (
        <div className="mx-4 mb-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(directText.trim() || selectedSnippetIds.length > 0) && <span className="text-[6px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 font-bold border border-purple-500/20 uppercase">Direct Knowledge Active</span>}
          {selectedCollections.length > 0 && <span className="text-[6px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 font-bold border border-cyan-500/20 uppercase">{selectedCollections.length} KB active</span>}
          {selectedProfiles.length > 0 && <span className="text-[6px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 font-bold border border-amber-500/20 uppercase">{selectedProfiles.length} Profiles active</span>}
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3">
          {/* ── Direct Text Knowledge Section ──────────────── */}
          <div className="bg-slate-900/60 border border-white/8 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setDirectTextExpanded(!directTextExpanded)}
              className="w-full flex items-center gap-2 p-3 hover:bg-white/5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-black text-purple-400 tracking-widest uppercase">Direct Knowledge (Override)</span>
                <span className="text-[7px] text-slate-500 uppercase">Paste text or select previous cards</span>
              </div>
              {(directText.trim() || selectedSnippetIds.length > 0) && (
                <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[7px] font-bold rounded flex items-center gap-1">
                  <Check className="w-2 h-2" /> {selectedSnippetIds.length + (directText.trim() ? 1 : 0)} ACTIVE
                </span>
              )}
              {directTextExpanded ? <ChevronUp className="ml-auto w-3 h-3 text-slate-500" /> : <ChevronDown className="ml-auto w-3 h-3 text-slate-500" />}
            </button>

            {directTextExpanded && (
              <div className="p-4 pt-0 space-y-3">
                <p className="text-[8px] text-slate-500 leading-relaxed">
                  The information pasted here will be prioritized by the agent. Use this for specific exam dates, instructions, or meeting notes.
                </p>
                <div className="relative">
                  <textarea
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    placeholder="Example: My exam is on 26 April. I must reach by 12:30 PM."
                    rows={6}
                    className="w-full bg-slate-950/80 border border-white/10 p-3 text-[10px] text-white placeholder:text-slate-700 focus:outline-none focus:border-purple-500/40 font-mono resize-none"
                  />
                  {directText && (
                    <button 
                      onClick={() => setDirectText("")}
                      className="absolute top-2 right-2 p-1 bg-slate-900/80 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Clear knowledge"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[7px] text-slate-600 font-mono uppercase tracking-tighter">
                    {directText.length} chars typed · {selectedSnippetIds.length} cards selected
                   </span>
                   <div className="flex gap-2">
                     {directText.trim() && (
                       <button
                         onClick={saveAsSnippet}
                         disabled={savingSnippet}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-slate-700 transition-all"
                       >
                         {savingSnippet ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                         Save as Card
                       </button>
                     )}
                     {directText.trim() && directText !== persistedDirectText && (
                       <button
                         onClick={saveDirectKnowledge}
                         disabled={savingDirectText}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-[9px] font-black uppercase hover:bg-purple-500 transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                       >
                         {savingDirectText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                         Sync to Session
                       </button>
                     )}
                     {(directText.trim() || selectedSnippetIds.length > 0) && (
                       <div className="flex items-center gap-2 text-[8px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/30 animate-in fade-in zoom-in-95 duration-500">
                         <CheckCircle2 className="w-3 h-3" /> AI Context Armed
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Snippets Cards Grid */}
                 <div className="space-y-2 pt-2 border-t border-white/5">
                   <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Previous Knowledge Cards</p>
                   {loadingSnippets ? (
                     <div className="flex items-center justify-center py-4">
                       <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
                     </div>
                   ) : snippets.length === 0 ? (
                     <p className="text-[8px] text-slate-700 italic">No saved cards yet. Type above and click "Save as Card".</p>
                   ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                       {snippets.map(s => (
                         <div
                           key={s.snippet_id}
                           onClick={() => toggleSnippet(s.snippet_id)}
                           className={cn(
                             "relative p-3 border cursor-pointer transition-all group/snip",
                             selectedSnippetIds.includes(s.snippet_id)
                               ? "bg-purple-500/10 border-purple-500/40"
                               : "bg-white/2 border-white/8 hover:border-white/20"
                           )}
                         >
                           <div className="flex items-start justify-between mb-1">
                             <div className={cn(
                               "w-3 h-3 border flex items-center justify-center shrink-0 transition-all",
                               selectedSnippetIds.includes(s.snippet_id)
                                 ? "bg-purple-500 border-purple-500"
                                 : "border-white/20"
                             )}>
                               {selectedSnippetIds.includes(s.snippet_id) && <Check className="w-2 h-2 text-black" />}
                             </div>
                             <button
                               onClick={(e) => { e.stopPropagation(); deleteSnippet(s.snippet_id); }}
                               className="opacity-0 group-hover/snip:opacity-100 p-1 text-slate-600 hover:text-rose-400 transition-all"
                             >
                               <Trash2 className="w-2.5 h-2.5" />
                             </button>
                           </div>
                           <p className="text-[9px] font-bold text-white leading-tight mb-1 line-clamp-1">{s.title}</p>
                           <p className="text-[8px] text-slate-500 line-clamp-2 font-mono">{s.content}</p>
                           <p className="text-[6px] text-slate-700 mt-2 uppercase font-black tracking-tighter">
                             {new Date(s.created_at).toLocaleDateString()}
                           </p>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ── Knowledge Base Section ───────────────────────── */}
            <div className="bg-slate-900/60 border border-white/8 overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setKbExpanded(!kbExpanded)}
                className="w-full flex items-center gap-2 p-3 hover:bg-white/5 transition-colors border-b border-white/5"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[9px] font-black text-cyan-400 tracking-widest uppercase">Knowledge Base</span>
                <span className="ml-2 text-[8px] text-slate-500 font-mono">
                  {selectedCollections.length}/{collections.length} selected
                </span>
                {kbExpanded ? <ChevronUp className="ml-auto w-3 h-3 text-slate-500" /> : <ChevronDown className="ml-auto w-3 h-3 text-slate-500" />}
              </button>

              {kbExpanded && (
                <div className="p-4 space-y-4">
                  {/* File type selector */}
                  <div className="space-y-2">
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">1. Select File Type</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {FILE_TYPES.map(ft => (
                        <button
                          key={ft.value}
                          type="button"
                          onClick={() => setSelectedFileType(ft.value)}
                          className={cn(
                            "px-3 py-1.5 text-[9px] font-black tracking-wider uppercase transition-all flex items-center gap-1.5",
                            selectedFileType === ft.value
                              ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                              : "bg-white/5 border border-white/10 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-400"
                          )}
                        >
                          <span>{ft.icon}</span>
                          {ft.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload */}
                  <div className="space-y-2">
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">2. Upload File</p>
                    <input
                      type="text"
                      placeholder="Collection name (optional)"
                      value={collectionName}
                      onChange={e => setCollectionName(e.target.value)}
                      className="w-full bg-slate-950/60 border border-white/10 px-3 py-2 text-[10px] text-cyan-400 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 font-mono"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={`.${selectedFileType}`}
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(
                        "w-full py-2.5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all",
                        uploading
                          ? "bg-slate-800 text-slate-500 cursor-wait"
                          : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/60"
                      )}
                    >
                      {uploading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Indexing…</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> Upload .{selectedFileType}</>
                      )}
                    </button>

                    {uploadStatus && (
                      <div className={cn(
                        "flex items-center gap-2 p-2 text-[9px] font-bold border",
                        uploadStatus.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      )}>
                        {uploadStatus.type === "success"
                          ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                          : <AlertCircle className="w-3 h-3 shrink-0" />
                        }
                        {uploadStatus.msg}
                      </div>
                    )}
                  </div>

                  {/* Collections list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">3. Select Collections</p>
                      {loadingCollections && <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />}
                    </div>

                    {collections.length === 0 ? (
                      <div className="py-4 text-center text-[9px] text-slate-600 font-mono border border-white/5">
                        No collections yet — upload a file above
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {collections.map((c, i) => (
                          <div
                            key={c.collection_id || i}
                            className={cn(
                              "flex items-center gap-2 p-2 border cursor-pointer transition-all group/coll",
                              selectedCollections.includes(c.collection_id)
                                ? "bg-cyan-500/10 border-cyan-500/40"
                                : "bg-white/2 border-white/8 hover:border-white/20"
                            )}
                            onClick={() => toggleCollection(c.collection_id)}
                          >
                            <div className={cn(
                              "w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-all",
                              selectedCollections.includes(c.collection_id)
                                ? "bg-cyan-500 border-cyan-500"
                                : "border-white/20"
                            )}>
                              {selectedCollections.includes(c.collection_id) && <Check className="w-2 h-2 text-black" />}
                            </div>
                            <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] font-bold text-white truncate">{c.name}</p>
                                <span className={cn(
                                  "text-[6px] font-black uppercase px-1 border",
                                  c.status === "ready" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                                  c.status === "indexing" ? "text-cyan-500 border-cyan-500/20 bg-cyan-500/5 animate-pulse" :
                                  "text-slate-500 border-white/5"
                                )}>
                                  {c.status || "PENDING"}
                                </span>
                              </div>
                              <p className="text-[8px] text-slate-500 font-mono">
                                {c.chunk_count} chunks · {c.file_type.toUpperCase()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={ev => { ev.stopPropagation(); deleteCollection(c.collection_id); }}
                              className="opacity-0 group-hover/coll:opacity-100 p-0.5 text-slate-600 hover:text-rose-400 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Instructions + Web Search Section ────────────── */}
            <div className="bg-slate-900/60 border border-white/8 overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setInstrExpanded(!instrExpanded)}
                className="w-full flex items-center gap-2 p-3 hover:bg-white/5 transition-colors border-b border-white/5"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9px] font-black text-amber-400 tracking-widest uppercase">Instruction Profiles</span>
                <span className="ml-2 text-[8px] text-slate-500 font-mono">
                  {selectedProfiles.length}/{profiles.length} active
                </span>
                {instrExpanded ? <ChevronUp className="ml-auto w-3 h-3 text-slate-500" /> : <ChevronDown className="ml-auto w-3 h-3 text-slate-500" />}
              </button>

              {instrExpanded && (
                <div className="p-4 space-y-4">
                  {/* Web Search — always on indicator */}
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/8 border border-emerald-500/25">
                    <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Web Search — Always Active</p>
                      <p className="text-[8px] text-slate-500 mt-0.5 leading-relaxed">
                        DuckDuckGo research runs for every task. Sources are cited in traces.
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  {/* Existing profiles */}
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {loadingProfiles && (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
                      </div>
                    )}
                    {!loadingProfiles && profiles.length === 0 && (
                      <div className="py-3 text-center text-[9px] text-slate-600 font-mono border border-white/5">
                        No profiles yet
                      </div>
                    )}
                    {profiles.map((p, i) => (
                      <div
                        key={p.profile_id || i}
                        className={cn(
                          "flex items-start gap-2 p-2 border cursor-pointer transition-all group/prof",
                          selectedProfiles.includes(p.profile_id)
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-white/2 border-white/8 hover:border-white/20"
                        )}
                        onClick={() => toggleProfile(p.profile_id)}
                      >
                        <div className={cn(
                          "w-3.5 h-3.5 border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          selectedProfiles.includes(p.profile_id)
                            ? "bg-amber-500 border-amber-500"
                            : "border-white/20"
                        )}>
                          {selectedProfiles.includes(p.profile_id) && <Check className="w-2 h-2 text-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold text-white truncate">{p.name}</p>
                          <p className="text-[8px] text-slate-500 truncate font-mono">{p.instructions.slice(0, 60)}…</p>
                        </div>
                        <button
                          type="button"
                          onClick={ev => { ev.stopPropagation(); deleteProfile(p.profile_id); }}
                          className="opacity-0 group-hover/prof:opacity-100 p-0.5 text-slate-600 hover:text-rose-400 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* New profile form */}
                  {showNewProfile ? (
                    <div className="space-y-2 border border-amber-500/20 p-3 bg-amber-500/5">
                      <input
                        type="text"
                        placeholder="Profile name…"
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        className="w-full bg-slate-950/60 border border-white/10 px-3 py-2 text-[10px] text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 font-mono"
                      />
                      <textarea
                        placeholder="Instructions…"
                        value={newProfileText}
                        onChange={e => setNewProfileText(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-950/60 border border-white/10 px-3 py-2 text-[10px] text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 font-mono resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveProfile}
                          disabled={savingProfile}
                          className="flex-1 py-2 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewProfile(false)}
                          className="px-3 py-2 bg-white/5 border border-white/10 text-slate-400 text-[9px] font-bold"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewProfile(true)}
                      className="w-full py-2 flex items-center justify-center gap-2 bg-white/3 border border-white/10 text-slate-400 hover:text-amber-400 text-[9px] font-bold uppercase tracking-wider transition-all"
                    >
                      <Plus className="w-3 h-3" /> New Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active summary footer */}
          {(selectedCollections.length > 0 || selectedProfiles.length > 0 || selectedSnippetIds.length > 0 || directText.trim()) && (
            <div className="border border-cyan-500/20 bg-cyan-500/5 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Active Grounding Context</span>
                  <span className="text-[6px] text-slate-500 uppercase">Information is synced for the next agent dispatch</span>
                </div>
                <div className="flex gap-2">
                  {(directText.trim() || selectedSnippetIds.length > 0) && <span className="text-[7px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 font-bold border border-purple-500/20">DIRECT KNOWLEDGE ARMED</span>}
                  {selectedCollections.length > 0 && <span className="text-[7px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 font-bold border border-cyan-500/20">{selectedCollections.length} COLLECTIONS</span>}
                  {selectedProfiles.length > 0 && <span className="text-[7px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 font-bold border border-amber-500/20">{selectedProfiles.length} PROFILES</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[7px] text-emerald-500 font-black uppercase">Ready</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
