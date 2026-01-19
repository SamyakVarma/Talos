import { useRef, useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { SkillData } from "../../types/node";
import RightPanel from "../sidebars/rightPanel";
import { AssetItem } from "../../types/assets";
import { useGraph } from "../../contexts/useGraph";
import { Canvas } from "./Canvas";
import { useNodeOperations } from "../../contexts/nodeUpdates";
import AddSkillModal from "../AddSkillModal";

type AssetWithTemplate = AssetItem & { skillData: SkillData };

interface SkillZoneProps {
  botPath?: string;
  skillPath?: string;
  skillId?: string;
  isSkill?: boolean;
  onSkillCreated: (
    skillID: string,
    skillRoot: string,
    type: "Basic" | "Complex"
  ) => void;

}


export default function SkillZone({
  botPath: propBotPath,
  skillPath: propSkillPath,
  skillId: propSkillId,
  isSkill = false,
  onSkillCreated
}: SkillZoneProps) {
  const location = useLocation();
  const bot = location.state;

  const currentPath = isSkill? propSkillPath : propBotPath || bot?.path;
  if (!currentPath) {
    return <div className="text-white p-10">Invalid path</div>;
  }

  const currentBotPath = propBotPath || bot?.path;

  const { graph, setGraph, saveNow } = useGraph(currentPath);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);

  const [showAddSkill, setShowAddSkill] = useState(false);

  // Node operations
  const { removePort, updateNode, updatePortOffset } = useNodeOperations(setGraph);
  
  const handleRenamePort = async (
    skillPath: string,
    nodeId: string,
    oldPortId: string,
    newPortId: string
  ) => {
    try {
      const finalPortId = await invoke<string>("rename_port", {
        skillPath,
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
            console.log(edge.fromSkillId, edge.toSkillId, edge.fromPortId, edge.toPortId);
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

  // Canvas viewport
  const canvasViewportRef = useRef<{
    scale: number;
    pos: { x: number; y: number };
    containerRect: DOMRect | null;
  }>({ scale: 1, pos: { x: 0, y: 0 }, containerRect: null });

  const handleViewportChange = (viewport: {
    scale: number;
    pos: { x: number; y: number };
    containerRect: DOMRect | null;
  }) => {
    canvasViewportRef.current = viewport;
  };

  // Selected node memoized
  const selectedNode = useMemo<SkillData | null>(
    () => graph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph?.nodes, selectedNodeId]
  );

  // Delete node with keyboard
  useEffect(() => {
    if (!graph) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!selectedNodeId) return;

      if (e.key === "Delete") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        try {
          await invoke("delete_node", {
            botPath: currentPath,
            nodeId: selectedNodeId,
          });

          setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
            edges: prev.edges.filter(
              (edge) =>
                edge.fromSkillId !== selectedNodeId &&
                edge.toSkillId !== selectedNodeId
            ),
          }));

          setSelectedNodeId(null);
        } catch (err) {
          console.error("Failed to delete node:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, currentPath, setGraph, graph]);

  const handleCloseNodeProperties = () => setSelectedNodeId(null);

  const handleCreateSkill = async (skill: {
    skillId: string;
    skillName: string;
    description: string;
    type: "Basic" | "Complex";
    }) => {
    try {
        const newNode = await invoke<SkillData>("create_skill", {
        botPath: currentPath,
        payload: {
            id: skill.skillId,
            label: skill.skillName,
            description: skill.description,
            skill_type: skill.type,
            lang: "python", //TODO
            version: "any" //TODO
        },
        });
        //TODO: wait for adding at least 1 IP or 1 OP before adding to graph
        const updatedGraph = {
          ...graph,
          nodes: [...graph.nodes, newNode],
        };
        setGraph(updatedGraph);
        await saveNow(updatedGraph);
        onSkillCreated(newNode.id, currentPath, skill.type);
    } catch (err) {
        console.error("Failed to create skill:", err);
  }};


  // Handle asset double-click to create node
  const handleAssetDoubleClick = async (asset: AssetItem) => {
    const typedAsset = asset as AssetWithTemplate;
    
    if (!("skillData" in asset)) {
      console.warn("Asset missing skillData", asset);
      return;
    }

    if (!typedAsset.skillData) return console.warn("Asset missing skillData", asset);

    const { containerRect, scale, pos } = canvasViewportRef.current;
    if (!containerRect) return console.warn("Canvas not ready");

    const x = (containerRect.width / 2 - pos.x) / scale;
    const y = (containerRect.height / 2 - pos.y) / scale;

    try {
      const newNode = await invoke<SkillData>("create_node_from_asset", {
        botPath: currentPath,
        baseId: typedAsset.id,
        skillData: typedAsset.skillData,
        x,
        y,
      });

      setGraph((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    } catch (err) {
      console.error("Failed to create node:", err);
    }
  };

  if (!graph) return <div className="text-white p-10">Loading…</div>;

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex">
      {/* Canvas */}
      <Canvas
        graph={graph}
        setGraph={setGraph}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        onPortOffsetUpdate={updatePortOffset}
        onViewportChange={handleViewportChange}
        botPath={currentPath}
      />

      {/* Right Panel */}
      <RightPanel
        onAssetDoubleClick={handleAssetDoubleClick}
        selectedNode={selectedNode}
        onCloseNodeProperties={handleCloseNodeProperties}
        onUpdateNode={updateNode}
        onAddPort={(io) => {}}
        allowAddRemove={false}
        allowRenameId={false}
        onRemovePort={(portId: string) => {}}
        onRenamePort={handleRenamePort}
        botPath={currentBotPath}
        skillPath={currentPath}
        isSkill={isSkill}
        isOpen={rightPanelOpen}
        width={rightPanelWidth}
        onResize={setRightPanelWidth}
        onToggle={() => setRightPanelOpen(!rightPanelOpen)}
        onAddSkill={() => setShowAddSkill(true)}
      />
      {/* Global modal layer */}
      {showAddSkill && (
        <AddSkillModal
            onClose={() => setShowAddSkill(false)}
            onCreate={handleCreateSkill}
        />
      )}
    </div>
  );
}
