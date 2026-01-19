import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  X,
  Save,
  FileCode,
  FolderOpen,
} from "lucide-react";

import RightPanel from "../sidebars/rightPanel";
import { SkillData, SkillPort } from "../../types/node";
import { useGraph } from "../../contexts/useGraph";
import { useNodeOperations } from "../../contexts/nodeUpdates";
import { Graph } from "../../types/graph";

/* ================= Props ================= */

interface SkillEditorProps {
  skillId: string;
  rootPath: string;
  skillRoot: string;
}

/* ================= File Tree Types ================= */

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

/* ================= Helpers ================= */

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  paths.forEach((path) => {
    const parts = path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const fullPath = parts.slice(0, index + 1).join("/");

      let node = current.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: fullPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        current.push(node);
      }
      if (node.type === "folder") current = node.children!;
    });
  });

  const sort = (nodes: FileNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === "folder"
        ? -1
        : 1
    );
    nodes.forEach((n) => n.children && sort(n.children));
  };

  sort(root);
  return root;
}

/* ================= SkillEditor ================= */

const SkillEditor: React.FC<SkillEditorProps> = ({
  skillId,
  rootPath,
  skillRoot,
}) => {
  /* ---------- graph ---------- */
  const { graph, setGraph, saveNow } = useGraph(rootPath);

  const selectedNode = useMemo<SkillData | null>(
    () => graph.nodes.find((n) => n.id === skillId) ?? null,
    [graph.nodes, skillId]
  );

  /* ---------- node operations ---------- */
  const { updateNode, removePort } = useNodeOperations(setGraph);

  /* ---------- editor state ---------- */
  const [files, setFiles] = useState<string[]>([]);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState("");
  const [code, setCode] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);

  const initialCode = useRef("");

  const handleRenamePort = async (
    rootPath: string,
    nodeId: string,
    oldPortId: string,
    newPortId: string
  ) => {
    try {
      const finalPortId = await invoke<string>("rename_port", {
        rootPath,
        nodeId,
        oldPortId,
        newPortId,
      });

      setGraph((prev) => {
        const updatedGraph = {
          ...prev,
          nodes: prev.nodes.map((node) => {
            
            if (node.id !== nodeId) return node;

            return {
              ...node,
              inputs: node.inputs.map((p) =>
                p.id === oldPortId ? { ...p, id: finalPortId } : p
              ),
              outputs: node.outputs.map((p) =>
                p.id === oldPortId ? { ...p, id: finalPortId } : p
              ),
            };
          }),
          edges: prev.edges.map((edge) => {
            if (edge.fromSkillId === nodeId && edge.fromPortId === oldPortId) {
              return { ...edge, fromPortId: finalPortId };
            }
            if (edge.toSkillId === nodeId && edge.toPortId === oldPortId) {
              return { ...edge, toPortId: finalPortId };
            }
            return edge;
          }),
        };
        saveNow(updatedGraph);
        return updatedGraph;
      });

    } catch (err) {
      console.error("Failed to rename port:", err);
    }
  };

  const handleAddPort = async (nodeId: string, io: "input" | "output") => {
    if (!graph) return;

    try {
      const finalPortId = await invoke<string>("add_port", {
        rootPath,
        nodeId,
        io,
      });

      setGraph((prev) => {
        const updatedNodes: SkillData[] = prev.nodes.map((node) => {
          if (node.id !== nodeId) return node;

          const newPort: SkillPort = {
            id: finalPortId,
            label: "",
            type: "int" as const,
            io,
          };

          return {
            ...node,               // preserves x, y, label, skillType, value
            inputs: io === "input" ? [...node.inputs, newPort] : node.inputs,
            outputs: io === "output" ? [...node.outputs, newPort] : node.outputs,
          };
        });

        const updatedGraph: Graph = {
          ...prev,
          nodes: updatedNodes,
        };

        saveNow(updatedGraph);
        return updatedGraph;
      });
    } catch (err) {
      console.error("Failed to add port:", err);
    }
  };

  const handleRemovePort = async (nodeId: string, portId: string) => {
    try {
      await invoke("remove_port", {
        rootPath,
        nodeId,
        portId,
      });
      setGraph((prev) => {
        const updatedGraph = {
          ...prev,
          nodes: prev.nodes.map((node) =>
            node.id !== nodeId
              ? node
              : {
                  ...node,
                  inputs: node.inputs.filter((p) => p.id !== portId),
                  outputs: node.outputs.filter((p) => p.id !== portId),
                }
          ),
          edges: prev.edges.filter(
            (e) =>
              e.fromPortId !== portId && e.toPortId !== portId
          ),
        };

        saveNow(updatedGraph);
        return updatedGraph;
      });
    } catch (err) {
      console.error("Failed to remove port:", err);
    }
  };


  /* ---------- lifecycle ---------- */
  useEffect(() => {
    refreshFiles();
  }, []);

  async function refreshFiles() {
    const list = await invoke<string[]>("list_skill_files", {
      botPath: rootPath,
      nodeId: skillId,
    });

    setFiles(list);
    setTree(buildFileTree(list));

    if (!currentFile && list.length > 0) {
      loadFile(list[0]);
    }
  }

  async function loadFile(file: string) {
    if (hasChanges && !confirm("Discard unsaved changes?")) return;

    const content = await invoke<string>("load_skill_code", {
      botPath: rootPath,
      nodeId: skillId,
      fileName: file,
    });

    setCurrentFile(file);
    setCode(content || "");
    initialCode.current = content || "";
    setHasChanges(false);
  }

  async function saveFile() {
    if (!currentFile) return;

    setSaving(true);

    await invoke("save_skill_code", {
      botPath: rootPath,
      nodeId: skillId,
      fileName: currentFile,
      code,
    });

    initialCode.current = code;
    setHasChanges(false);
    setSaving(false);

    saveNow();
  }

  async function copyFromFolder() {
    setCopying(true);
    const folder = await open({ directory: true });
    if (!folder) return setCopying(false);

    if (!confirm("Copy files and overwrite existing ones?")) {
      return setCopying(false);
    }

    await invoke("copy_code_from_folder", {
      botPath: rootPath,
      nodeId: skillId,
      sourceFolder: folder,
    });

    await refreshFiles();
    setCopying(false);
  }

  const monacoLang = () => {
    if (currentFile.endsWith(".cpp")) return "cpp";
    if (currentFile.endsWith(".json")) return "json";
    if (currentFile.endsWith(".yaml") || currentFile.endsWith(".yml"))
      return "yaml";
    return "python";
  };

  if (!selectedNode) {
    return <div className="text-gray-400 p-6">Skill not found</div>;
  }

  /* ================= render ================= */

  return (
    <div className="w-full h-screen flex bg-[#1e1e1e] overflow-hidden">
      {/* ================= LEFT ================= */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <h2 className="text-white font-semibold">
            {selectedNode.label ?? selectedNode.id}
          </h2>

          <div className="flex gap-2">
            <button
              onClick={copyFromFolder}
              disabled={copying}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
            >
              <FolderOpen className="w-4 h-4 inline mr-1" />
              Copy Code
            </button>

            <button
              onClick={saveFile}
              disabled={!hasChanges || saving}
              className={`
                px-3 py-1.5 rounded text-sm flex items-center
                transition-colors duration-150

                ${
                  !hasChanges || saving
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-500 active:bg-green-700"
                }
              `}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          <div className="w-52 bg-gray-900 border-r border-gray-700 overflow-y-auto">
            {tree.map((n) => (
              <button
                key={n.path}
                onClick={() => loadFile(n.path)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm
                  ${currentFile === n.path
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800"}`}
              >
                <FileCode className="w-3 h-3" />
                <span className="truncate">{n.name}</span>
              </button>
            ))}
          </div>

          {/* Editor */}
          <Editor
            theme="vs-dark"
            language={monacoLang()}
            value={code}
            onChange={(v) => {
              const val = v || "";
              setCode(val);
              setHasChanges(val !== initialCode.current);
            }}
            options={{ automaticLayout: true, fontSize: 14 }}
          />
        </div>
      </div>

      {/* ================= RIGHT ================= */}
      <RightPanel
        layoutMode="docked"
        mode="node-only"
        isOpen={rightPanelOpen}
        width={rightPanelWidth}
        onResize={setRightPanelWidth}
        onToggle={() => setRightPanelOpen((v) => !v)}
        selectedNode={selectedNode}
        onCloseNodeProperties={() => {}}
        onUpdateNode={updateNode}
        onAddPort={(io) => handleAddPort(selectedNode.id, io)}
        onRemovePort={(portId) =>
          handleRemovePort(selectedNode.id, portId)
        }
        onRenamePort={handleRenamePort}
        skillPath={skillRoot}
        botPath={rootPath}
      />
    </div>
  );
};

export default SkillEditor;
