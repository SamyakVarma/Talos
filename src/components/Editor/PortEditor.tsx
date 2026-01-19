import { useState, useEffect } from "react";
import { SkillPort } from "../../types/node";

export interface PortEditorProps {
  inputs: SkillPort[];
  outputs: SkillPort[];
  onChange: (newInputs: SkillPort[], newOutputs: SkillPort[]) => void;
  onRenamePort: (payload: {
    oldPortId: string;
    newPortId: string;
  }) => void;
  onAddPort?: (io: "input" | "output") => void;
  onRemovePort?: (portId: string) => void;
  allowAddRemove?: boolean;
  allowRenameId?: boolean;
}

const portTypeColors: Record<SkillPort["type"], string> = {
  int: "bg-red-500",
  float: "bg-orange-500",
  char: "bg-pink-500",
  string: "bg-green-500",
  bool: "bg-cyan-500",
  "int[]": "bg-red-700",
  "float[]": "bg-orange-700",
  "string[]": "bg-green-700",
  "bool[]": "bg-cyan-700",
  EXEC: "bg-gray-500",
};

export default function PortEditor({ inputs, outputs, onChange, onRenamePort, onAddPort, onRemovePort, allowAddRemove = true, allowRenameId = true, }: PortEditorProps) {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [editingPortId, setEditingPortId] = useState("");

  const allPorts = [
    ...inputs.filter((p) => p.type !== "EXEC"),
    ...outputs.filter((p) => p.type !== "EXEC"),
  ];

  const selectedPort =
    allPorts.find((p) => p.id === selectedPortId) || null;

  const handleLabelChange = (newLabel: string) => {
    if (!selectedPort) return;
    const updated = { ...selectedPort, label: newLabel };
    if (selectedPort.io === "input") {
      const newInputs = inputs.map((p) => (p.id === selectedPort.id ? updated : p));
      onChange(newInputs, outputs);
    } else {
      const newOutputs = outputs.map((p) => (p.id === selectedPort.id ? updated : p));
      onChange(inputs, newOutputs);
    }
  };

  const handleTypeChange = (newType: SkillPort["type"]) => {
    if (!selectedPort) return;
    const updated = { ...selectedPort, type: newType };
    if (selectedPort.io === "input") {
      const newInputs = inputs.map((p) => (p.id === selectedPort.id ? updated : p));
      onChange(newInputs, outputs);
    } else {
      const newOutputs = outputs.map((p) => (p.id === selectedPort.id ? updated : p));
      onChange(inputs, newOutputs);
    }
  };

  useEffect(() => {
  if (selectedPort) {
    setEditingPortId(selectedPort.id);
  }
}, [selectedPort?.id]);


  return (
    <div className="border border-neutral-700 rounded bg-neutral-800 p-2">
        {/* Add buttons */}
        {allowAddRemove && (
        <div className="flex gap-2 mb-2">
            <button
            onClick={() => onAddPort?.("input")}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
            >
            + Input
            </button>
            <button
            onClick={() => onAddPort?.("output")}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
            >
            + Output
            </button>
        </div>
        )}
       <div className="flex flex-col gap-1">
        {/* Inputs */}
        {inputs
          .filter((p) => p.type !== "EXEC")
          .map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPortId(p.id)}
              className={`flex items-center gap-2 px-2 py-1 w-full text-sm rounded transition-colors ${
                selectedPortId === p.id
                  ? "bg-neutral-700"
                  : "hover:bg-neutral-700/50"
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${portTypeColors[p.type]}`} />
              <span className="flex-1 text-left">{p.label || p.id}</span>
            </button>
          ))}

        {/* Outputs */}
        {outputs
          .filter((p) => p.type !== "EXEC")
          .map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPortId(p.id)}
              className={`flex items-center gap-2 px-2 py-1 w-full text-sm rounded transition-colors justify-end ${
                selectedPortId === p.id
                  ? "bg-neutral-700"
                  : "hover:bg-neutral-700/50"
              }`}
            >
              <span className="flex-1 text-right">{p.label || p.id}</span>
              <div className={`w-3 h-3 rounded-full ${portTypeColors[p.type]}`} />
            </button>
          ))}
      </div>

      {/* Selected Port Editor */}
      {selectedPort && (
        <div className="mt-2 p-2 border-t border-neutral-700 space-y-2">
            {/* Port ID */}
            {allowRenameId ? (
            <div className="flex items-center gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-400 w-12">
                ID
                </label>
                <input
                type="text"
                value={editingPortId}
                onChange={(e) => setEditingPortId(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-neutral-700 border border-neutral-600 rounded font-mono"
                />
                <button
                disabled={
                    editingPortId === selectedPort.id || editingPortId.trim() === ""
                }
                onClick={() =>
                    onRenamePort?.({
                    oldPortId: selectedPort.id,
                    newPortId: editingPortId.trim(),
                    })
                }
                className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:bg-neutral-600 rounded"
                >
                Apply
                </button>
            </div>
            ) : (
            <div className="flex items-center gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-400 w-12">
                ID
                </label>
                <span className="font-mono text-sm text-neutral-300">
                {selectedPort.id}
                </span>
            </div>
            )}


            {/* Label */}
            <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-400 w-12">
                Label
            </label>
            <input
                type="text"
                value={selectedPort.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-neutral-700 border border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            </div>

            {/* Type */}
            <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-400 w-12">
                Type
            </label>
            <select
                value={selectedPort.type}
                onChange={(e) =>
                handleTypeChange(e.target.value as SkillPort["type"])
                }
                className="flex-1 px-2 py-1 text-sm bg-neutral-700 border border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
                <option value="int">int</option>
                <option value="float">float</option>
                <option value="char">char</option>
                <option value="string">string</option>
                <option value="bool">bool</option>
                <option value="int[]">int[]</option>
                <option value="float[]">float[]</option>
                <option value="string[]">string[]</option>
                <option value="bool[]">bool[]</option>
            </select>
            </div>
            {allowAddRemove && (
            <button
                onClick={() => {
                onRemovePort?.(selectedPort.id);
                setSelectedPortId(null);
                }}
                className="w-full px-2 py-1 text-xs bg-red-900 hover:bg-red-700 rounded"
            >
                REMOVE PORT
            </button>
            )}
        </div>
        )}
    </div>
  );
}
