import { ChevronLeft, ChevronRight, Package, Settings, FileText } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import AssetBrowser from "./assetBrowser/AssetBrowser";
import GlobalProperties from "./properties/globalProperties";
import NodeProperties from "./properties/nodeProperties";
import { SkillData } from "../../types/node";
import { AssetItem } from "../../types/assets";

type PanelTab = "assets" | "global" | "node";

interface RightPanelProps {
  // Asset Browser props
  onAssetDoubleClick?: (asset: AssetItem) => void;
  onAddSkill?: () => void;

  // Node Properties props
  selectedNode: SkillData | null;
  onCloseNodeProperties: () => void;
  onUpdateNode: (oldId: string, updated: Partial<SkillData>) => void;
  onAddPort: (io: "input" | "output") => void;
  onRemovePort: (portId: string) => void;
  onRenamePort: (rootPath: string, nodeId: string, oldPortId: string, newPortId: string) =>void
  allowAddRemove?: boolean;
  allowRenameId?: boolean;

  // Global Properties props
  botPath?: string;
  skillPath?: string;
  isSkill?: boolean;

  // Panel state
  isOpen: boolean;
  width: number;
  onResize: (newWidth: number) => void;
  onToggle: () => void;
  style?: React.CSSProperties;
  layoutMode?: "overlay" | "docked";
  mode?: "full" | "node-only";
}

export default function RightPanel({
  onAssetDoubleClick,
  onAddSkill,
  selectedNode,
  onCloseNodeProperties,
  onUpdateNode,
  onAddPort,
  onRemovePort,
  onRenamePort,
  allowAddRemove = true,
  allowRenameId = true,
  botPath,
  skillPath,
  isSkill = false,
  isOpen,
  width,
  onResize,
  onToggle,
  style,
  layoutMode = "overlay",
  mode = "full",
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>(mode === "node-only" ? "node" : "assets");

  const [resizing, setResizing] = useState(false);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const prevSelectedNode = useRef<SkillData | null>(null);

  const handleRenamePort = (
    nodeId: string,
    oldPortId: string,
    newPortId: string
  ) => {
    console.log('0')
    if (!botPath) return;
    console.log('1')
    onRenamePort(botPath, nodeId, oldPortId, newPortId);
  };


  // Switch to node tab when a node is selected
  useEffect(() => {
  if (mode === "node-only") return;
    if (!prevSelectedNode.current && selectedNode && activeTab !== "node") {
      setActiveTab("node");
    }
    if (prevSelectedNode.current && !selectedNode) {
      setActiveTab("assets");
    }
    prevSelectedNode.current = selectedNode;
  }, [selectedNode, mode]);

  // Switch away from node tab when node is deselected
  useEffect(() => {
  if (mode === "node-only") return;
    if (!selectedNode && activeTab === "node") {
      setActiveTab("assets");
    }
  }, [selectedNode, activeTab, mode]);

  // ================= Resizing Logic =================
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    setResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const dx = startX.current - e.clientX;
    const newWidth = Math.max(200, Math.min(800, startWidth.current + dx));
    onResize(newWidth);
  };

  const handleMouseUp = () => {
    if (isResizing.current) {
      isResizing.current = false;
      setResizing(false);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [width]);

  const tabs: Array<{ id: PanelTab; icon: any; label: string; available: boolean }> = [
    { id: "assets", icon: Package, label: "Assets", available: true },
    { id: "global", icon: Settings, label: "Global", available: true },
    { id: "node", icon: FileText, label: "Node", available: !!selectedNode },
  ];

  return (
    <div
      className={`${layoutMode === "overlay" ? "fixed top-0 right-0 z-20" : "relative"} h-full bg-neutral-900 border-l border-neutral-700 shadow-xl flex`}
      style={{
        width: isOpen ? width : 40,
        transition: resizing ? "none" : "width 0.2s ease",
        ...style,
      }}
    >
      {/* ================= Resizer Handle ================= */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize z-50 hover:bg-cyan-500 transition-colors"
        />
      )}

      {/* ================= Toggle Button ================= */}
      <button
        className={`
          absolute top-1/2 -translate-y-1/2
          ${layoutMode === "overlay" ? "left-[-20px]" : "left-[-16px]"}
          bg-neutral-900 border border-neutral-700
          w-6 h-12 rounded-l-md
          flex items-center justify-center
          hover:bg-neutral-800 z-10
        `}
        onClick={onToggle}
      >

        {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* ================= Sideways Tabs ================= */}
      {isOpen && (
        <>

          {/* ================= Panel Content ================= */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {mode === "node-only" ? (
            selectedNode ? (
              <NodeProperties
                selectedNode={selectedNode}
                skillPath={skillPath!}
                onClose={onCloseNodeProperties}
                onUpdateNode={onUpdateNode}
                onAddPort={onAddPort}
                onRemovePort={onRemovePort}
                onRenamePort={({ nodeId, oldPortId, newPortId }) =>
                  handleRenamePort(nodeId, oldPortId, newPortId)
                }
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-neutral-500">
                No node selected
              </div>
            )
          ) : (
            <>
              {activeTab === "assets" && (
                <AssetBrowser
                  onAssetDoubleClick={onAssetDoubleClick}
                  onAddSkill={onAddSkill}
                />
              )}

              {activeTab === "global" && (
                <GlobalProperties
                  botPath={botPath}
                  skillPath={skillPath}
                  isSkill={isSkill}
                />
              )}

              {activeTab === "node" && selectedNode && (
                <NodeProperties
                  selectedNode={selectedNode}
                  skillPath={skillPath!}
                  onClose={onCloseNodeProperties}
                  onUpdateNode={onUpdateNode}
                  onAddPort={onAddPort}
                  onRemovePort={onRemovePort}
                  onRenamePort={({ nodeId, oldPortId, newPortId }) =>
                    handleRenamePort(nodeId, oldPortId, newPortId)
                  }
                  allowAddRemove={allowAddRemove}
                  allowRenameId={allowRenameId}
                />
              )}
            </>
          )}
        </div>
          {isOpen && mode === "full" && (
          <div className="w-12 bg-neutral-950 border-r border-neutral-700 flex flex-col items-center py-3 gap-2">
            {tabs
              .filter((tab) => tab.available)
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-10 h-10 rounded flex items-center justify-center
                      transition-colors
                      ${
                        activeTab === tab.id
                          ? "bg-cyan-600 text-white"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                      }
                    `}
                  >
                    <Icon size={20} />
                  </button>
                );
              })}
          </div>
        )}
        </>
      )}
    </div>
  );
}