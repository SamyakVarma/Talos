import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { SkillData } from "../components/SkillNode";
import RightPanel from "./sidebar/rightPanel";
import { AssetItem } from "../components/AssetBrowser";
import { useGraph } from "./graph/useGraph";
import { useAssets } from "./assets/useAssets";
import { LeftSidebar } from "./sidebar/leftSidebar";
import { Canvas } from "./canvas/Canvas";

type AssetWithTemplate = AssetItem & { skillData: SkillData };

interface SkillZoneInnerProps {
  botPath?: string;
  skillPath?: string;
  skillId?: string;
  isSkill?: boolean;
}

export default function SkillZoneInner({
  botPath: propBotPath,
  skillPath: propSkillPath,
  skillId: propSkillId,
  isSkill = false,
}: SkillZoneInnerProps) {
  const location = useLocation();
  const bot = location.state;
  
  const currentPath = isSkill ? propSkillPath! : (propBotPath || bot?.path);
  const currentBotPath = propBotPath || bot?.path;

  const { graph, setGraph } = useGraph(currentPath);
  const assets = useAssets(currentBotPath);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);

  // Canvas viewport state
  const canvasViewportRef = useRef<{
    scale: number;
    pos: { x: number; y: number };
    containerRect: DOMRect | null;
  }>({
    scale: 1,
    pos: { x: 0, y: 0 },
    containerRect: null,
  });

  const handleViewportChange = (viewport: {
    scale: number;
    pos: { x: number; y: number };
    containerRect: DOMRect | null;
  }) => {
    canvasViewportRef.current = viewport;
  };

  const handleRemovePort = useCallback(
    (nodeId: string, portId: string) => {
      setGraph((prev) => ({
        ...prev,
        // Remove edges connected to this port
        edges: prev.edges.filter(
          (e) =>
            e.fromPortId !== portId &&
            e.toPortId !== portId
        ),

        // Remove the port from the node
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                inputs: n.inputs.filter((p) => p.id !== portId),
                outputs: n.outputs.filter((p) => p.id !== portId),
              }
            : n
        ),
      }));
    },
    [setGraph]
  );


  // ---------------- DELETE NODE ----------------
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!selectedNodeId) return;

      if (e.key === "Delete") {
        try {
          await invoke("delete_node", {
            botPath: currentPath,
            nodeId: selectedNodeId,
          });

          setGraph((prevGraph) => ({
            ...prevGraph,
            nodes: prevGraph.nodes.filter((n) => n.id !== selectedNodeId),
            edges: prevGraph.edges.filter(
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
  }, [selectedNodeId, currentPath, setGraph]);

  // ---------------- PORT OFFSET UPDATE ----------------
  const handlePortOffsetUpdate = useCallback(
    (nodeId: string, portId: string, offset: { x: number; y: number }) => {
      setGraph((prev) => {
        const node = prev.nodes.find((n) => n.id === nodeId);
        if (!node) return prev;

        // Find the current port
        const currentPort =
          node.inputs.find((p) => p.id === portId) ||
          node.outputs.find((p) => p.id === portId);

        // Check if offset actually changed (avoid unnecessary updates)
        if (
          currentPort?.offset &&
          Math.abs(currentPort.offset.x - offset.x) < 0.01 &&
          Math.abs(currentPort.offset.y - offset.y) < 0.01
        ) {
          return prev; // No change needed
        }

        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  inputs: n.inputs.map((p) =>
                    p.id === portId ? { ...p, offset } : p
                  ),
                  outputs: n.outputs.map((p) =>
                    p.id === portId ? { ...p, offset } : p
                  ),
                }
              : n
          ),
        };
      });
    },
    [setGraph]
  );

  // ---------------- NODE PROPERTIES HANDLERS ----------------
  const handleUpdateNode = (oldId: string, updates: Partial<SkillData>) => {
    setGraph((prev) => {
      const oldNode = prev.nodes.find((n) => n.id === oldId);
      if (!oldNode) return prev;

      const newId = updates.id ?? oldId;

      const updatedNodes = prev.nodes.map((n) =>
        n.id === oldId ? { ...n, ...updates, id: newId } : n
      );

      const updatedEdges =
        newId !== oldId
          ? prev.edges.map((e) => ({
              ...e,
              fromSkillId: e.fromSkillId === oldId ? newId : e.fromSkillId,
              toSkillId: e.toSkillId === oldId ? newId : e.toSkillId,
            }))
          : prev.edges;

      return {
        ...prev,
        nodes: updatedNodes,
        edges: updatedEdges,
      };
    });
  };

  const handleCloseNodeProperties = () => {
    setSelectedNodeId(null);
  };

  // ---------------- ASSET DOUBLE CLICK ----------------
  const handleAssetDoubleClick = async (asset: AssetItem) => {
    const typedAsset = asset as AssetWithTemplate;

    if (!typedAsset.skillData) {
      console.warn("Asset missing skillData:", typedAsset);
      return;
    }

    const viewport = canvasViewportRef.current;
    const containerRect = viewport.containerRect;

    if (!containerRect) {
      console.warn("Canvas not ready");
      return;
    }

    // Calculate center of visible viewport in world coordinates
    const centerScreenX = containerRect.width / 2;
    const centerScreenY = containerRect.height / 2;

    const x = (centerScreenX - viewport.pos.x) / viewport.scale;
    const y = (centerScreenY - viewport.pos.y) / viewport.scale;

    try {
      const newNode = await invoke<SkillData>("create_node_from_asset", {
        botPath: currentPath,
        baseId: typedAsset.id,
        skillData: typedAsset.skillData,
        x,
        y,
      });

      setGraph((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
    } catch (err) {
      console.error("Failed to create node:", err);
    }
  };

  // ---------------- RENDER ----------------
  if (!graph) return <div className="text-white p-10">Loading…</div>;

  const selectedNode = selectedNodeId
    ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex">
      {/* Left Sidebar */}
      <LeftSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* CANVAS */}
      <Canvas
        graph={graph}
        setGraph={setGraph}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        onPortOffsetUpdate={handlePortOffsetUpdate}
        assetBrowserWidth={rightPanelWidth}
        assetBrowserOpen={rightPanelOpen}
        onViewportChange={handleViewportChange}
        isSkill={isSkill}
        botPath={currentBotPath}
      />

      {/* Right Panel */}
      <RightPanel
        assets={assets}
        onAssetDoubleClick={handleAssetDoubleClick}
        selectedNode={selectedNode}
        onCloseNodeProperties={handleCloseNodeProperties}
        onUpdateNode={handleUpdateNode}
        onRemovePort={handleRemovePort}
        botPath={currentBotPath}
        skillPath={currentPath}
        isSkill={isSkill}
        isOpen={rightPanelOpen}
        width={rightPanelWidth}
        onResize={setRightPanelWidth}
        onToggle={() => setRightPanelOpen(!rightPanelOpen)}
      />
    </div>
  );
}