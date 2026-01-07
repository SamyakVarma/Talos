import { Graph , ActiveConnection } from "../graph/types";

interface ConnectionsLayerProps {
  graph: Graph;
  getPortWorldPosition: (node: Graph["nodes"][number], portId: string) => { x: number; y: number };
  activeConnection?: ActiveConnection | null;
  hoveredPort?: HoveredPort | null;
  scale: number
}

interface HoveredPort {
    skillId: string;
    portId: string;
    portType: string;
    io: "input" | "output"
}

export function ConnectionsLayer({ graph, getPortWorldPosition, activeConnection, hoveredPort, scale }: ConnectionsLayerProps) {
    const renderEdges = () =>
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
    })

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
            {hoveredPort && (() => {
            const node = graph.nodes.find((n) => n.id === hoveredPort.skillId);
            if (!node) return null;
            const world = getPortWorldPosition(node, hoveredPort.portId);
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
  return (
    <>
      {renderEdges()}
      {renderActiveConnectionPreview()}
    </>
  );
}
