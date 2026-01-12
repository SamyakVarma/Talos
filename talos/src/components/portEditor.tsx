import { useState } from "react";
import { SkillPort } from "./SkillNode";

interface PortEditorProps {
  title: string;
  ports: SkillPort[];
  onChangePorts: (ports: SkillPort[]) => void;
  onRemovePort: (portId: string) => void;
  io: "input" | "output";
}


const TYPE_OPTIONS: SkillPort["type"][] = [
  "int",
  "float",
  "bool",
  "string",
  "char",
  "int[]",
  "float[]",
  "bool[]",
  "string[]",
];

function PortRow({
  port,
  selected,
  onClick,
}: {
  port: SkillPort;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center justify-between px-2 py-1 cursor-pointer
        ${selected ? "bg-cyan-900/40" : "hover:bg-neutral-800"}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-sm">{port.label}</span>
      </div>

      <span className="text-xs text-neutral-400">
        {port.type}
      </span>
    </div>
  );
}

function PortDetailsEditor({
  port,
  onChange,
}: {
  port: SkillPort;
  onChange: (updated: SkillPort) => void;
}) {
  return (
    <div className="space-y-2 p-2 border border-neutral-700 rounded bg-neutral-800">
      <div className="space-y-1">
        <label className="text-xs uppercase">Name</label>
        <input
          value={port.label}
          onChange={(e) =>
            onChange({ ...port, label: e.target.value })
          }
          className="w-full px-2 py-1 bg-neutral-700 rounded"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase">Type</label>
        <select
          value={port.type}
          onChange={(e) =>
            onChange({
              ...port,
              type: e.target.value as SkillPort["type"],
            })
          }
          className="w-full px-2 py-1 bg-neutral-700 rounded"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function PortEditor({
  title,
  ports,
  onChangePorts,
  onRemovePort,
  io,
}: PortEditorProps) {

    const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
    const visiblePorts = ports.filter((p) => p.type !== "EXEC");
    const selectedPort = visiblePorts.find((p) => p.id === selectedPortId);

    const handleUpdateSelected = (updatedPort: SkillPort) => {
        const updatedPorts = ports.map((p) =>
            p.id === updatedPort.id ? updatedPort : p
        );
        onChangePorts(updatedPorts);
    };

    const handleAddPort = () => {
        const newPort: SkillPort = {
            id: crypto.randomUUID(),
            label: "New Attribute",
            type: "float",
            io,
        };

        onChangePorts([...ports, newPort]);
        setSelectedPortId(newPort.id);
    };
    const handleRemoveSelected = () => {
  if (!selectedPortId) return;

  onRemovePort(selectedPortId);
  setSelectedPortId(null);
};



  return (
    <div className="space-y-2">
    <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-400">{title}</h3>

        <div className="flex gap-1">
        <button onClick={handleAddPort}>+</button>
        <button
            onClick={handleRemoveSelected}
        >
            −
        </button>
        </div>
    </div>

    {/* Ports container */}
    <div className="border border-neutral-700 rounded bg-neutral-900">
        {visiblePorts.map((port) => (
        <PortRow
            key={port.id}
            port={port}
            selected={port.id === selectedPortId}
            onClick={() => setSelectedPortId(port.id)}
        />
        ))}

        {visiblePorts.length === 0 && (
        <div className="p-2 text-xs text-neutral-500 italic">
            No attributes
        </div>
        )}
    </div>

    {/* Selected port editor */}
    {selectedPort && (
        <PortDetailsEditor
        port={selectedPort}
        onChange={handleUpdateSelected}
        />
    )}
    </div>

  );
}
