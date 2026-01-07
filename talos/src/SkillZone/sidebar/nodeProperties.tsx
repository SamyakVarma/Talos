import { useState, useEffect } from "react";
import { SkillData } from "../../components/SkillNode";

interface NodePropertiesProps {
  selectedNode: SkillData | null;
  onClose: () => void;
  onUpdateNode: (oldId: string, updated: Partial<SkillData>) => void;
}

export default function NodeProperties({
  selectedNode,
  onClose,
  onUpdateNode,
}: NodePropertiesProps) {
  const [localData, setLocalData] = useState<SkillData | null>(null);

  useEffect(() => {
    setLocalData(selectedNode);
  }, [selectedNode?.id]);

  if (!selectedNode || !localData) return null;

  const isStaticAttribute = localData.skillType === "static_attribute";

  const handleChange = (field: keyof SkillData, value: any) => {
    setLocalData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleApply = () => {
    if (!localData) return;
    onUpdateNode(selectedNode.id, localData);
  };

  const handleValueTypeChange = (newType: string) => {
    if (!localData || !isStaticAttribute) return;

    const updatedOutputs = localData.outputs.map((port) => ({
      ...port,
      type: newType as any,
    }));

    let newValue: any = "";
    if (newType === "int" || newType === "float") newValue = 0;
    else if (newType === "bool") newValue = false;
    else if (newType.includes("[]")) newValue = [];

    setLocalData({
      ...localData,
      outputs: updatedOutputs,
      value: newValue,
    });
  };

  const handleValueChange = (newValue: any) => {
    handleChange("value", newValue);
  };

  const renderValueInput = () => {
    if (!isStaticAttribute || !localData.outputs[0]) return null;

    const valueType = localData.outputs[0].type;
    const currentValue = localData.value ?? "";

    switch (valueType) {
      case "int":
        return (
          <input
            type="number"
            step="1"
            value={currentValue as number}
            onChange={(e) => handleValueChange(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        );
      case "float":
        return (
          <input
            type="number"
            step="0.1"
            value={currentValue as number}
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        );
      case "bool":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={currentValue as boolean}
              onChange={(e) => handleValueChange(e.target.checked)}
              className="w-4 h-4 accent-cyan-500"
            />
            <span className="text-sm">{currentValue ? "True" : "False"}</span>
          </label>
        );
      case "string":
        return (
          <input
            type="text"
            value={currentValue as string}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        );
      case "char":
        return (
          <input
            type="text"
            maxLength={1}
            value={currentValue as string}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        );
      case "int[]":
      case "float[]":
      case "string[]":
      case "bool[]":
        return (
          <textarea
            value={Array.isArray(currentValue) ? currentValue.join(", ") : ""}
            onChange={(e) => {
              const arr = e.target.value.split(",").map((v) => v.trim());
              if (valueType === "int[]") {
                handleValueChange(arr.map((v) => parseInt(v) || 0));
              } else if (valueType === "float[]") {
                handleValueChange(arr.map((v) => parseFloat(v) || 0));
              } else if (valueType === "bool[]") {
                handleValueChange(arr.map((v) => v === "true"));
              } else {
                handleValueChange(arr);
              }
            }}
            placeholder="Enter values separated by commas"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 min-h-[80px]"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-300">Node Properties</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-neutral-300">
        {/* Node ID */}
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide">
            ID
          </label>
          <input
            type="text"
            value={localData.id}
            disabled
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-500"
            // onChange={(e) => handleChange("id", e.target.value)}
            // className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <p className="text-xs text-neutral-500">Read-only identifier</p>
        </div>

        {/* Label */}
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide">
            Label
          </label>
          <input
            type="text"
            value={localData.label}
            onChange={(e) => handleChange("label", e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Skill Type */}
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide">
            Type
          </label>
          <input
            type="text"
            value={localData.skillType}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-500"
            disabled
          />
        </div>

        {/* Static Attribute Specific Fields */}
        {isStaticAttribute && (
          <>
            {/* Value Type */}
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide">
                Value Type
              </label>
              <select
                value={localData.outputs[0]?.type || "string"}
                onChange={(e) => handleValueTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="int">Integer</option>
                <option value="float">Float</option>
                <option value="char">Character</option>
                <option value="string">String</option>
                <option value="bool">Boolean</option>
                <option value="int[]">Integer Array</option>
                <option value="float[]">Float Array</option>
                <option value="string[]">String Array</option>
                <option value="bool[]">Boolean Array</option>
              </select>
            </div>

            {/* Value Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide">
                Value
              </label>
              {renderValueInput()}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-neutral-700 flex gap-2">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm font-medium transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}