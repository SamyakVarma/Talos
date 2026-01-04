import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { X, Save } from "lucide-react";

interface SkillEditorProps {
  botPath: string;
  skillId: string;
  skillLabel: string;
  onClose: () => void;
  onSave?: () => void;
}

export default function SkillEditor({
  botPath,
  skillId,
  skillLabel,
  onClose,
  onSave,
}: SkillEditorProps) {
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialCodeRef = useRef<string>("");

  useEffect(() => {
    async function loadCode() {
      try {
        setLoading(true);
        const loadedCode = await invoke<string>("load_skill_code", {
          botPath,
          nodeId: skillId,
        });
        setCode(loadedCode);
        initialCodeRef.current = loadedCode;
        setHasChanges(false);
      } catch (err) {
        console.error("Failed to load skill code:", err);
        setCode(`# Error loading skill code: ${err}\n# Skill ID: ${skillId}`);
      } finally {
        setLoading(false);
      }
    }
    loadCode();
  }, [botPath, skillId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await invoke("save_skill_code", {
        botPath,
        nodeId: skillId,
        code,
      });
      initialCodeRef.current = code;
      setHasChanges(false);
      if (onSave) onSave();
    } catch (err) {
      console.error("Failed to save skill code:", err);
      alert(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setHasChanges(value !== initialCodeRef.current);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center text-white">
        <div>Loading skill code...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">{skillLabel}</h2>
          {hasChanges && (
            <span className="text-xs text-yellow-400">• Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}

