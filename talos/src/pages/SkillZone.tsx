import { useRef, useState, useEffect } from "react";
import {
  Home,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import SkillNode, { SkillData, SkillPort } from "../components/SkillNode";
import PropertiesPanel from "../components/Properties"
import AssetBrowser, { AssetItem } from "../components/AssetBrowser";
import SkillNodePreview from "../components/SkillNodePreview";
import { DndContext, DragEndEvent, useDroppable} from "@dnd-kit/core";

interface Connection {
  fromSkillId: string;
  fromPortId: string;
  toSkillId: string;
  toPortId: string;
  type: "execution" | "attribute";
}

interface Graph {
  nodes: SkillData[];
  edges: Connection[];
}


export default function SkillZone() {
  const location = useLocation();
  const bot = location.state;
  const bot_path = bot.path;

  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [graph, setGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  });

  type AssetWithTemplate = AssetItem & { skillData: SkillData };

  const [assets, setAssets] = useState<AssetWithTemplate[]>([]);

  const [assetBrowserOpen, setAssetBrowserOpen] = useState(true);
  const [assetBrowserWidth, setAssetBrowserWidth] = useState(320);

  // Droppable zone for the canvas
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: 'skill-zone-canvas',
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log(active, over)
    // Check if dropped over the canvas
    if (over && over.id === 'skill-zone-canvas') {
      console.log("Dropped asset skill ID:", active.id);
      
      // Get the asset data
      const assetData = active.data.current;
      
      if (assetData) {
        // Calculate drop position in world coordinates
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && event.activatorEvent instanceof MouseEvent) {
          const dropX = (event.activatorEvent.clientX - rect.left - pos.x) / scale;
          const dropY = (event.activatorEvent.clientY - rect.top - pos.y) / scale;
          
          console.log("Asset Data:", assetData);
          console.log("Drop Position:", { x: dropX, y: dropY });
          
          // TODO: Create a new node from the asset at the drop position
          // Example:
          // const newNode: SkillData = {
          //   ...assetData.skillData,
          //   id: `${assetData.id}_${Date.now()}`,
          //   x: dropX,
          //   y: dropY,
          // };
          // setGraph(prev => ({
          //   ...prev,
          //   nodes: [...prev.nodes, newNode]
          // }));
        }
      }
    }
  };


  // Active connection being dragged
  const [activeConnection, setActiveConnection] = useState<null | {
    fromSkillId: string;
    fromPortId: string;
    type: "execution" | "attribute";
    startX: number;
    startY: number;
    mouseX: number;
    mouseY: number;
    fromIo: "input" | "output";
    isValid: boolean;
  }>(null);

  // hovered port while dragging
  const hoveredPortRef = useRef<null | {
    skillId: string;
    portId: string;
    portType: SkillPort["type"];
    io: "input" | "output";
  }>(null);

  // -------- LOAD GRAPH ON STARTUP ----------
  useEffect(() => {
    async function load() {
      try {
        const json = await invoke("load_skill_graph", { botPath: bot.path });
        const parsed: Graph = JSON.parse(json as string);
        setGraph(parsed);
      } catch {
        // fallback default graph
        setGraph({
          nodes: [
            {
              id: "start",
              x: 200,
              y: 300,
              label: "Start",
              skillType: "start",
              inputs: [],
              outputs: [
                { id: "exec_out", label: "Exec", type: "EXEC", io: "output" },
              ],
            },
            {
              id: "end",
              x: 1000,
              y: 300,
              label: "End",
              skillType: "end",
              inputs: [
                { id: "exec_in", label: "Exec", type: "EXEC", io: "input" },
              ],
              outputs: [],
            },
          ],
          edges: [
            {
              fromSkillId: "start",
              fromPortId: "exec_out",
              toSkillId: "end",
              toPortId: "exec_in",
              type: "execution",
            },
          ],
        });
      }
    }
    load();
  }, [bot.path]);

  // -------- LOAD ASSETS ON STARTUP ----------
  useEffect(() => {
    async function loadAssets() {
      try {
        // Parse YAML
        const registryJson = await invoke("load_asset_registry_json");

        const registry = JSON.parse(registryJson as string);

        const allAssets: AssetWithTemplate[] = [];

        function mapYamlTypeToPortType(t: string) {
          if (!t) return "string";

          if (t === "EXEC") return "EXEC";

          if (t.startsWith("list<")) {
            return "string[]";   // or dynamic[] if you want
          }

          if (t === "dynamic") return "string";

          return t as any;
        }


        // Helper to load config.yaml
        async function loadConfig(skill: any, type: "skill" | "std_skill" | "utility" | "static" ): Promise<AssetWithTemplate> {
          try {
            if (type === "static") {
              const skillData: SkillData = {
                id: skill.id,
                label: skill.name,
                skillType: "static_attribute",
                x: 0,
                y: 0,
                inputs: [],
                outputs: [
                  {
                    id: "v_out",
                    label: skill.name,
                    type: "string",        // or infer later
                    io: "output",
                  },
                ],
              };

              return {
                id: skill.id,
                label: skill.name,
                type: "static",
                preview: <SkillNodePreview data={skillData} />,
                skillData,
              };
            }
            const cfgJson = await invoke("load_skill_config_json", {
              skillPath: skill.path
            });

            const cfg = JSON.parse(cfgJson as string);

            const inputs = (cfg.INPUT || []).map((p: any) => ({
              id: p.id,
              label: p.label ?? p.id,
              type: mapYamlTypeToPortType(p.type),
              io: "input",
            }));

            const outputs = (cfg.OUTPUT || []).map((p: any) => ({
              id: p.id,
              label: p.label ?? p.id,
              type: mapYamlTypeToPortType(p.type),
              io: "output",
            }));
            // ------------------------------------------------

            const skillData: SkillData = {
              id: cfg.name,
              label: cfg.name,
              skillType: type,
              x: 0,
              y: 0,
              inputs,
              outputs,
            };

            const asset: AssetWithTemplate = {
              id: cfg.name,
              label: cfg.name,
              type,
              preview: <SkillNodePreview data={skillData} />,
              skillData,
            };

            return asset;

          } catch (err) {
            console.error("Error loading skill config:", err);

            const fallbackSkillData: SkillData = {
              id: skill.id,
              label: skill.name,
              skillType: type,
              x: 0,
              y: 0,
              inputs: [],
              outputs: [],
            };

            return {
              id: skill.id,
              label: skill.name,
              type,
              preview: (
                <div className="text-xs opacity-50">
                  (config.yaml invalid)
                </div>
              ),
              skillData: fallbackSkillData,
            };
          }
        }

        // CUSTOM_SKILLS
        if (registry.custom_skills) {
          for (const s of registry.custom_skills) {
            allAssets.push(await loadConfig(s, "skill"));
          }
        }

        // STANDARD_SKILLS
        if (registry.standard_skills) {
          for (const s of registry.standard_skills) {
            allAssets.push(await loadConfig(s, "std_skill"));
          }
        }

        // UTILITY_FUNCTIONS
        if (registry.utility_functions) {
          for (const s of registry.utility_functions) {
            allAssets.push(await loadConfig(s, "utility"));
          }
        }
        // STATIC
        if (registry.static_attributes) {
          for (const s of registry.static_attributes) {
            console.log(s)
            allAssets.push(await loadConfig(s, "static"));
          }
        }

        setAssets(allAssets);

      } catch (e) {
        console.error("Failed to load assets:", e);
      }
    }

    loadAssets();
    console.log("Loading Assets")
  }, [bot.path]);

  // ------------ DELETE NODE ---------------
  // TODO: Consider a pop up beofre deleting the node.
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!selectedNodeId) return;

      // Delete key
      if (e.key === "Delete" || e.key === "Backspace") {
        try {
          await invoke("delete_node", {
            botPath: bot_path, // pass your bot path
            nodeId: selectedNodeId,
          });

          // Update frontend state
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
  }, [selectedNodeId]);

  // -------- SAVE GRAPH ON CHANGE ----------
  useEffect(() => {
    if (graph.nodes.length === 0) return;
    invoke("save_skill_graph", {
      botPath: bot.path,
      graphJson: JSON.stringify(graph, null, 2),
    });
  }, [graph, bot.path]);

  const isPanning = useRef(false);
  const isDraggingNode = useRef(false);
  const draggedNodeId = useRef<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  // ---------------- CANVAS MOUSE DOWN ----------------
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".node-item") && !target.closest(".asset-item")) { 
      // only pan if click is outside nodes/assets
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeId(null);
    }
  };

  // ---------------- NODE MOUSE DOWN ----------------
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    isDraggingNode.current = true;
    draggedNodeId.current = id;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setSelectedNodeId(id); // Select node when clicking it
  };

  // ---------------- VALIDATION HELPER ----------------
  const isValidConnection = (
    fromNode: SkillData,
    fromPort: SkillPort,
    toNode: SkillData,
    toPort: SkillPort
  ): boolean => {
    const fromIsExec = fromPort.type === "EXEC";
    const toIsExec = toPort.type === "EXEC";
    if (fromIsExec !== toIsExec) return false;

    if (fromPort.io === toPort.io) return false;

    if (fromNode.id === toNode.id) return false;

    return true;
  };

  // ---------------- PORT EVENTS ----------------
  const handlePortMouseDown = (
    nodeId: string,
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output",
    offsetScreenPx: { x: number; y: number }
  ) => {
    const node = getNodeById(nodeId)!;
    const startX = node.x + offsetScreenPx.x / scale;
    const startY = node.y + offsetScreenPx.y / scale;

    const connType = portType === "EXEC" ? "execution" : "attribute";

    if (io === "input") {
      const existingEdge = graph.edges.find(
        (e) => e.toSkillId === nodeId && e.toPortId === portId
      );

      if (existingEdge) {
        setGraph((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => e !== existingEdge),
        }));

        const fromNode = getNodeById(existingEdge.fromSkillId)!;
        const fromWorld = getPortWorldPosition(fromNode, existingEdge.fromPortId);

        setActiveConnection({
          fromSkillId: existingEdge.fromSkillId,
          fromPortId: existingEdge.fromPortId,
          type: connType,
          startX: fromWorld.x,
          startY: fromWorld.y,
          mouseX: startX,
          mouseY: startY,
          fromIo: "output",
          isValid: true,
        });
        return;
      }
    }

    setActiveConnection({
      fromSkillId: nodeId,
      fromPortId: portId,
      type: connType,
      startX,
      startY,
      mouseX: startX,
      mouseY: startY,
      fromIo: io,
      isValid: true,
    });
  };

  const handlePortHover = (
    nodeId: string,
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output"
  ) => {
    hoveredPortRef.current = { skillId: nodeId, portId, portType, io };

    if (activeConnection) {
      const fromNode = getNodeById(activeConnection.fromSkillId)!;
      const toNode = getNodeById(nodeId)!;
      const fromPort = findPort(fromNode, activeConnection.fromPortId);
      const toPort = findPort(toNode, portId);

      if (fromPort && toPort) {
        const valid = isValidConnection(fromNode, fromPort, toNode, toPort);
        setActiveConnection((prev) => (prev ? { ...prev, isValid: valid } : prev));
      } else {
        setActiveConnection((prev) => (prev ? { ...prev, isValid: false } : prev));
      }
    }
  };

  const handlePortLeave = () => {
    hoveredPortRef.current = null;
    if (activeConnection) {
      setActiveConnection((prev) => (prev ? { ...prev, isValid: true } : prev));
    }
  };

  // ---------------- MOVE HANDLER ----------------
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;

      setPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }

    if (isDraggingNode.current && draggedNodeId.current) {
      const dx = (e.clientX - lastPos.current.x) / scale;
      const dy = (e.clientY - lastPos.current.y) / scale;

      lastPos.current = { x: e.clientX, y: e.clientY };

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggedNodeId.current
            ? { ...n, x: n.x + dx, y: n.y + dy }
            : n
        ),
      }));
    }

    if (activeConnection) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = (e.clientX - rect.left - pos.x) / scale;
      const my = (e.clientY - rect.top - pos.y) / scale;

      setActiveConnection((prev) => (prev ? { ...prev, mouseX: mx, mouseY: my } : prev));
    }
  };

  const handleMouseUp = () => {
    if (activeConnection) {
      const hovered = hoveredPortRef.current;

      if (hovered && activeConnection.isValid) {
        const fromNode = getNodeById(activeConnection.fromSkillId)!;
        const toNode = getNodeById(hovered.skillId)!;

        const fromPort = findPort(fromNode, activeConnection.fromPortId);
        const toPort = findPort(toNode, hovered.portId);

        if (fromPort && toPort && isValidConnection(fromNode, fromPort, toNode, toPort)) {
          let edgeFromSkillId = activeConnection.fromSkillId;
          let edgeFromPortId = activeConnection.fromPortId;
          let edgeToSkillId = hovered.skillId;
          let edgeToPortId = hovered.portId;

          if (activeConnection.fromIo === "input" && hovered.io === "output") {
            edgeFromSkillId = hovered.skillId;
            edgeFromPortId = hovered.portId;
            edgeToSkillId = activeConnection.fromSkillId;
            edgeToPortId = activeConnection.fromPortId;
          }

          const filteredEdges = graph.edges.filter(
            (e) => !(e.toSkillId === edgeToSkillId && e.toPortId === edgeToPortId)
          );

          const exists = filteredEdges.some(
            (e) =>
              e.fromSkillId === edgeFromSkillId &&
              e.fromPortId === edgeFromPortId &&
              e.toSkillId === edgeToSkillId &&
              e.toPortId === edgeToPortId
          );

          if (!exists) {
            const edgeType = fromPort.type === "EXEC" ? "execution" : "attribute";
            setGraph((prev) => ({
              ...prev,
              edges: [
                ...filteredEdges,
                {
                  fromSkillId: edgeFromSkillId,
                  fromPortId: edgeFromPortId,
                  toSkillId: edgeToSkillId,
                  toPortId: edgeToPortId,
                  type: edgeType,
                },
              ],
            }));
          }
        }
      }

      setActiveConnection(null);
      hoveredPortRef.current = null;
    }
    isPanning.current = false;
    isDraggingNode.current = false;
    draggedNodeId.current = null;
  };

  const handleAssetDoubleClick = async (asset: AssetItem) => {
    const typedAsset = asset as AssetWithTemplate;

    if (!typedAsset.skillData) {
      console.warn("Asset missing skillData:", typedAsset);
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // 1. Calculate world-space drop position
    const centerScreenX = containerRect.left + containerRect.width / 2;
    const centerScreenY = containerRect.top + containerRect.height / 2;

    const x = (centerScreenX - containerRect.left - pos.x) / scale;
    const y = (centerScreenY - containerRect.top - pos.y) / scale;

    try {

      const newNode = await invoke<SkillData>("create_node_from_asset", {
        botPath: bot.path,          // <-- must exist in your app state
        baseId: typedAsset.id,
        skillData: typedAsset.skillData,  // backend injects EXEC ports etc
        x,
        y
      });

      setGraph((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));

    } catch (err) {
      console.error("Failed to create node:", err);
    }
  };


  // ---------------- ZOOM ----------------
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoom = 0.001;
    const newScale = Math.min(2, Math.max(0.2, scale - e.deltaY * zoom));

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldX = (mx - pos.x) / scale;
      const worldY = (my - pos.y) / scale;

      setPos({
        x: mx - worldX * newScale,
        y: my - worldY * newScale,
      });
    }

    setScale(newScale);
  };

  const handlePortOffsetUpdate = (
    nodeId: string,
    portId: string,
    offset: { x: number; y: number }
  ) => {
    setGraph((prev) => ({
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
    }));
  };

  // ---------------- PROPERTIES PANEL ----------------
  const handleUpdateNode = (oldId: string, updates: Partial<SkillData>) => {
    setGraph((prev) => {
      const oldNode = prev.nodes.find((n) => n.id === oldId);
      if (!oldNode) return prev;

      const newId = updates.id ?? oldId;

      // 1. Update the node
      const updatedNodes = prev.nodes.map((n) =>
        n.id === oldId ? { ...n, ...updates, id: newId } : n
      );

      // 2. If ID changed, update all edges
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

  const handleCloseProperties = () => {
    setSelectedNodeId(null);
  };

  // ---------------- PORT POSITION ----------------
  function getPortWorldPosition(node: SkillData, portId: string) {
    const port =
      node.inputs.find((p) => p.id === portId) ||
      node.outputs.find((p) => p.id === portId);

    if (!port || !port.offset) return { x: node.x, y: node.y };

    return {
      x: node.x + port.offset.x,
      y: node.y + port.offset.y,
    };
  }

  // ---------------- UTIL ----------------
  const getNodeById = (id: string) => graph.nodes.find((n) => n.id === id);
  const findPort = (node: SkillData | undefined, portId: string) => {
    if (!node) return null;
    return node.inputs.find((p) => p.id === portId) || node.outputs.find((p) => p.id === portId) || null;
  };

  // ---------------- DRAW CONNECTIONS ----------------
  const renderConnections = () =>
    graph.edges.map((edge, i) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.fromSkillId);
      const toNode = graph.nodes.find((n) => n.id === edge.toSkillId);
      if (!fromNode || !toNode) return null;

      const from = getPortWorldPosition(fromNode, edge.fromPortId);
      const to = getPortWorldPosition(toNode, edge.toPortId);

      const color = edge.type === "execution" ? "#22c55e" : "#3b82f6";

      const dx = to.x - from.x;
      const cx1 = from.x + dx / 2;
      const cy1 = from.y;
      const cx2 = to.x - dx / 2;
      const cy2 = to.y;

      return (
        <g key={i}>
          <path
            d={`M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`}
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
        </g>
      );
    });

  // ---------------- RENDER ----------------
  if (!graph) return <div className="text-white p-10">Loading…</div>;

  const renderActiveConnectionPreview = () => {
    if (!activeConnection) return null;

    const color = activeConnection.isValid
      ? activeConnection.type === "execution"
        ? "#22c55e"
        : "#3b82f6"
      : "#ef4444";

    const sx = activeConnection.startX;
    const sy = activeConnection.startY;
    const tx = activeConnection.mouseX;
    const ty = activeConnection.mouseY;
    const cx1 = sx + (tx - sx) / 2;
    const cy1 = sy;
    const cx2 = tx - (tx - sx) / 2;
    const cy2 = ty;

    return (
      <>
        <path
          d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        {hoveredPortRef.current && (() => {
          const node = getNodeById(hoveredPortRef.current!.skillId);
          if (!node) return null;
          const world = getPortWorldPosition(node!, hoveredPortRef.current!.portId);
          const highlightColor = activeConnection.isValid ? "#fff" : "#ef4444";
          return (
            <circle
              cx={world.x}
              cy={world.y}
              r={8 / Math.max(0.7, scale)}
              fill="none"
              stroke={highlightColor}
              strokeWidth={2 / Math.max(0.7, scale)}
            />
          );
        })()}
      </>
    );
  };

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;
  return (
    <DndContext onDragEnd={handleDragEnd}>
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex">
      {/* Left Sidebar */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 bg-gray-900 border-r border-gray-700 z-30 transition-all duration-300`}
        style={{
          width: sidebarOpen ? "250px" : "60px",
          height: "97vh",
          borderTopRightRadius: "20px",
          borderBottomRightRadius: "20px",
        }}
      >
        <div className="p-4 space-y-4 flex flex-col">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center"
            style={{
              width: sidebarOpen ? "40px" : "30px",
              height: sidebarOpen ? "40px" : "30px",
            }}
          >
            {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          <div className="mt-6 space-y-3 flex-1 flex flex-col">
            <button
              onClick={() => window.history.back()}
              className="w-full flex items-center gap-3 px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg justify-start"
            >
              <Home className="w-6 h-6" />
              {sidebarOpen && (
                <span className="text-sm whitespace-nowrap">Home</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div
          className="absolute top-0 h-full transition-all duration-300 z-40"
          style={{
            width: "300px", // Properties panel width
            right: assetBrowserOpen ? `${assetBrowserWidth}px` : "0px", // shift left if asset browser is open
          }}
        >
          <PropertiesPanel
            selectedNode={selectedNode}
            onClose={handleCloseProperties}
            onUpdateNode={handleUpdateNode}
          />
        </div>
      )}
        {/* CANVAS */}
      <div
        ref={(node) => {
            containerRef.current = node;
            setDroppableRef(node);
          }}
        id="skill-zone-canvas"
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #444 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: `${pos.x % 40}px ${pos.y % 40}px`,
          }}
        />

        {/* WORLD */}
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            width={50000}
            height={50000}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ overflow: "visible" }}
          >
            {renderConnections()}
            {activeConnection && renderActiveConnectionPreview()}
          </svg>

          {/* NODES */}
          {graph.nodes.map((node) => (
            <SkillNode
              key={node.id}
              data={node}
              selected={node.id === selectedNodeId}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onPortOffsetUpdate={handlePortOffsetUpdate}
              onPortMouseDown={handlePortMouseDown}
              onPortHover={handlePortHover}
              onPortLeave={handlePortLeave}
            />
          ))}
        </div>
      </div>
      
      {/* Right-side Asset Browser */}
      <AssetBrowser
        assets={assets}
        isOpen={assetBrowserOpen}
        width={assetBrowserWidth}
        onResize={setAssetBrowserWidth}
        onToggle={() => setAssetBrowserOpen(!assetBrowserOpen)}
        style={{ zIndex: 5 }}
        onAssetDoubleClick={handleAssetDoubleClick}
      />
    </div>
  </DndContext>
  );
}