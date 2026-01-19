import { useState } from "react";

interface AddSkillModalProps {
  onClose: () => void;
  onCreate: (skill: {
    skillId: string;
    skillName: string;
    description: string;
    type: "Basic" | "Complex";
  }) => void;
}

export default function AddSkillModal({ onClose, onCreate }: AddSkillModalProps) {
  const [skillId, setSkillId] = useState("");
  const [skillName, setSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Basic" | "Complex">("Basic");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[420px] rounded-lg bg-neutral-900 border border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">Add Skill</div>
          <button
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Skill ID */}
          <div>
            <label className="text-xs opacity-70">Skill ID</label>
            <input
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 text-sm"
            />
          </div>

          {/* Skill Name */}
          <div>
            <label className="text-xs opacity-70">Skill Name</label>
            <input
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs opacity-70">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 text-sm resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs opacity-70">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 text-sm"
            >
              <option value="Basic">Basic</option>
              <option value="Complex">Complex</option>
              <option value="utility" disabled>
                Utility
              </option>
              <option value="static" disabled>
                Static
              </option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
          >
            Cancel
          </button>

          <button
            className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500"
            onClick={() => {
            onCreate({
            skillId,
            skillName,
            description,
            type,
            });
              onClose();
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
