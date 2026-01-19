import { useRef, useState, useEffect } from "react";
import { SkillData, SkillPort } from "../../types/node";
import SkillNode from "./SkillNode";
import { Graph, ActiveConnection } from "../../types/graph";
import { ConnectionsLayer } from "./ConnectionsLayer";
import { useTab } from "../../contexts/TabContext";

interface CanvasProps {
  graph: Graph;
  setGraph: React.Dispatch<React.SetStateAction<Graph>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  onPortOffsetUpdate: (nodeId: string, portId: string, offset: { x: number; y: number }) => void;
  onViewportChange?: (viewport: { 
    scale: number; 
    pos: { x: number; y: number }; 
    containerRect: DOMRect | null;
  }) => void;
  botPath?: string;
}

export function Canvas({
  graph,
  setGraph,
  selectedNodeId,
  setSelectedNodeId,
  onPortOffsetUpdate,
  onViewportChange,
  botPath,
}: CanvasProps) {
  const { openTab } = useTab();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Active connection being dragged
  const [activeConnection, setActiveConnection] = useState<ActiveConnection | null>(null);

  // Expose viewport state to parent
  useEffect(() => {
    if (onViewportChange) {
      const rect = containerRef.current?.getBoundingClientRect() || null;
      onViewportChange({ scale, pos, containerRect: rect });
    }
  }, [scale, pos, onViewportChange]);

  // Hovered port while dragging
  const hoveredPortRef = useRef<{
    skillId: string;
    portId: string;
    portType: SkillPort["type"];
    io: "input" | "output";
  } | null>(null);

  // Panning and dragging refs
  const isPanning = useRef(false);
  const isDraggingNode = useRef(false);
  const draggedNodeId = useRef<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  // ---------------- UTILITY FUNCTIONS ----------------
  const getNodeById = (id: string) => graph.nodes.find((n) => n.id === id);

  const findPort = (node: SkillData | undefined, portId: string) => {
    if (!node) return null;
    return (
      node.inputs.find((p) => p.id === portId) ||
      node.outputs.find((p) => p.id === portId) ||
      null
    );
  };

  const getPortWorldPosition = (node: SkillData, portId: string) => {
    const port =
      node.inputs.find((p) => p.id === portId) ||
      node.outputs.find((p) => p.id === portId);

    if (!port || !port.offset) return { x: node.x, y: node.y };

    return {
      x: node.x + port.offset.x,
      y: node.y + port.offset.y,
    };
  };

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

  // ---------------- NODE DOUBLE CLICK HANDLER ----------------
  const handleNodeDoubleClick = (node: SkillData) => {
    const skillType = node.skillType.toLowerCase();
    
    if (skillType === "basic" || skillType === "complex") {
      if (!botPath) {
        console.warn("Cannot open skill: botPath is not defined");
        return;
      }

      const skillPath = `${botPath}/skills/${node.id}`;
      console.log(node.id)
      openTab({
        id: `skill-${node.id}`,
        label: node.label || node.id,
        type: node.skillType as "Basic" | "Complex",
        path: skillPath,
        skillId: node.id,
        botPath: botPath,
      });
    }
  };

  // ---------------- MOUSE HANDLERS ----------------
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const clickedEmpty =
      !target.closest(".node-item") && !target.closest(".asset-item");

    // LEFT click
    if (e.button === 0 && clickedEmpty) {
      setSelectedNodeId(null);
      return;
    }

    // MIDDLE click
    if (e.button === 1 && clickedEmpty) {
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };


  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDraggingNode.current = true;
    draggedNodeId.current = id;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setSelectedNodeId(id);
  };

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

      setActiveConnection((prev) =>
        prev ? { ...prev, mouseX: mx, mouseY: my } : prev
      );
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

        if (
          fromPort &&
          toPort &&
          isValidConnection(fromNode, fromPort, toNode, toPort)
        ) {
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
            (e) =>
              !(e.toSkillId === edgeToSkillId && e.toPortId === edgeToPortId)
          );

          const exists = filteredEdges.some(
            (e) =>
              e.fromSkillId === edgeFromSkillId &&
              e.fromPortId === edgeFromPortId &&
              e.toSkillId === edgeToSkillId &&
              e.toPortId === edgeToPortId
          );

          if (!exists) {
            const edgeType =
              fromPort.type === "EXEC" ? "execution" : "attribute";
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

  // ---------------- PORT HANDLERS ----------------
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
        setActiveConnection((prev) =>
          prev ? { ...prev, isValid: valid } : prev
        );
      } else {
        setActiveConnection((prev) =>
          prev ? { ...prev, isValid: false } : prev
        );
      }
    }
  };

  const handlePortLeave = () => {
    hoveredPortRef.current = null;
    if (activeConnection) {
      setActiveConnection((prev) =>
        prev ? { ...prev, isValid: true } : prev
      );
    }
  };

  // ---------------- ZOOM HANDLER ----------------
    useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoom = 0.001;
      const newScale = Math.min(2, Math.max(0.2, scale - e.deltaY * zoom));

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldX = (mx - pos.x) / scale;
      const worldY = (my - pos.y) / scale;

      setPos({
        x: mx - worldX * newScale,
        y: my - worldY * newScale,
      });

      setScale(newScale);
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [scale, pos]);


  return (
    <div
      ref={containerRef}
      id="skill-zone-canvas"
      className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
          <ConnectionsLayer
            graph={graph}
            getPortWorldPosition={getPortWorldPosition}
            activeConnection={activeConnection}
            hoveredPort={hoveredPortRef.current}
            scale={scale}
          />
        </svg>

        {/* NODES */}
        {graph.nodes.map((node) => (
          <SkillNode
            key={node.id}
            data={node}
            selected={node.id === selectedNodeId}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onDoubleClick={handleNodeDoubleClick}
            onPortOffsetUpdate={onPortOffsetUpdate}
            onPortMouseDown={handlePortMouseDown}
            onPortHover={handlePortHover}
            onPortLeave={handlePortLeave}
          />
        ))}
      </div>
    </div>
  );
}