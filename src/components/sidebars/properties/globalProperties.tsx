interface GlobalPropertiesProps {
  botPath?: string;
  skillPath?: string;
  isSkill?: boolean;
}

export default function GlobalProperties({
  botPath,
  skillPath,
  isSkill = false,
}: GlobalPropertiesProps) {
  const currentPath = isSkill ? skillPath : botPath;
  const pathType = isSkill ? "Skill" : "Bot";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-300">Global Properties</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-neutral-300">
        {/* Path Information */}
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {pathType} Path
          </label>
          <div className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-400 break-all">
            {currentPath || "Not available"}
          </div>
        </div>

        {/* Context Type */}
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Context Type
          </label>
          <div className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm">
            {isSkill ? "Skill Graph" : "Bot Graph"}
          </div>
        </div>

      </div>
    </div>
  );
}