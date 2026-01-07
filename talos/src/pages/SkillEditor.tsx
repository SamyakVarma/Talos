import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, Play, AlertCircle, CheckCircle, Code } from "lucide-react";

interface SkillEditorProps {
  skillPath: string;
  skillId: string;
}

export default function SkillEditor({ skillPath, skillId }: SkillEditorProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load skill code on mount
  useEffect(() => {
    const loadSkillCode = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const skillCode = await invoke<string>("load_skill_code", {
          skillPath,
          skillId,
        });
        setCode(skillCode);
      } catch (err) {
        console.error("Failed to load skill code:", err);
        setError(err instanceof Error ? err.message : "Failed to load skill code");
        setCode("// Error loading skill code\n// " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadSkillCode();
  }, [skillPath, skillId]);

  // Auto-save status reset
  useEffect(() => {
    if (saveStatus === "saved" || saveStatus === "error") {
      const timer = setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setError(null);

    try {
      await invoke("save_skill_code", {
        skillPath,
        skillId,
        code,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save skill:", err);
      setError(err instanceof Error ? err.message : "Failed to save skill");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [code]);

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = code.substring(0, start) + "    " + code.substring(end);
      setCode(newCode);
      
      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          <p className="text-gray-400">Loading skill code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-semibold">{skillId}</h2>
            <p className="text-xs text-gray-400">Basic Skill Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status */}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
          {saveStatus === "saving" && (
            <div className="flex items-center gap-2 text-cyan-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-400"></div>
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Save failed</span>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/30 border-b border-red-700 px-4 py-3 flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Line numbers and editor container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Line Numbers */}
          <div className="bg-[#1e1e1e] border-r border-gray-700 px-3 py-4 text-right text-gray-500 text-sm font-mono select-none overflow-hidden">
            {code.split("\n").map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code Editor */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#1e1e1e] text-gray-100 px-4 py-4 font-mono text-sm resize-none focus:outline-none leading-6 overflow-auto"
            style={{
              tabSize: 4,
            }}
            spellCheck={false}
            placeholder="// Write your skill code here..."
          />
        </div>

        {/* Footer Info */}
        <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>Lines: {code.split("\n").length}</span>
            <span>Characters: {code.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Path: {skillPath}</span>
            <span className="text-gray-500">Press Ctrl+S to save</span>
          </div>
        </div>
      </div>
    </div>
  );
}