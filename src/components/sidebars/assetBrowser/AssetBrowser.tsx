import { useState, useEffect } from "react";
import { AssetItem } from "../../../types/assets";
import { useAssets } from "./useAssets";

interface AssetBrowserProps {
  onAssetDoubleClick?: (asset: AssetItem) => void;
  onAddSkill?: () => void;
}

function Asset({
  asset,
  onDoubleClick,
}: {
  asset: AssetItem & { path?: string };
  onDoubleClick?: (asset: AssetItem) => void;
}) {
  return (
    <div
      className="asset-item bg-neutral-800 p-3 rounded border transition-all
        border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
      onDoubleClick={() => {
        if (asset.path) {
          onDoubleClick?.(asset);
        }
      }}
    >
      {asset.preview ? (
        <div className="mb-3 flex items-center justify-center pointer-events-none">
          {asset.preview}
        </div>
      ) : (
        <div className="mb-3 text-center text-xs opacity-60">
          (No preview)
        </div>
      )}
      <div className="text-sm font-semibold">{asset.label}</div>
      <div className="text-xs opacity-50">{asset.type}</div>
    </div>
  );
}

export default function AssetBrowser({
  onAssetDoubleClick,
  onAddSkill
}: AssetBrowserProps) {
  const [category, setCategory] = useState<
    "custom" | "utility" | "standard" | "static"
  >("standard");

  const { assets, loadAssets, loading } = useAssets();

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const filteredAssets = assets.filter((a) => {
    if (category === "custom") return a.type === "skill";
    if (category === "utility") return a.type === "utility";
    if (category === "standard") return a.type === "std_skill";
    if (category === "static") return a.type === "static";
    return true;
  });

  return (
    <div className="p-3 text-neutral-300 h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Asset Browser</div>

        <button
          onClick={loadAssets}
          disabled={loading}
          className="text-xs px-3 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Reload"}
        </button>
      </div>

      {/* Category + Add Button */}
      <div className="flex items-center gap-2 mb-4">
        <select
          className="flex-1 p-2 bg-neutral-800 border border-neutral-700 rounded text-sm"
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value as "custom" | "utility" | "standard" | "static"
            )
          }
        >
          <option value="standard">Standard Skills</option>
          <option value="custom">Custom Skills</option>
          <option value="utility">Utilities</option>
          <option value="static">Static</option>
        </select>

        <button
          onClick={onAddSkill}
          className="w-9 h-9 flex items-center justify-center rounded
            bg-neutral-800 border border-neutral-700
            hover:bg-neutral-700 hover:border-neutral-600 text-lg"
          title="Add Skill"
        >
          +
        </button>
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {filteredAssets.map((a) => (
          <Asset
            key={a.id}
            asset={a}
            onDoubleClick={onAssetDoubleClick}
          />
        ))}

        {!loading && filteredAssets.length === 0 && (
          <div className="text-xs opacity-50 text-center">
            No assets found
          </div>
        )}
      </div>
    </div>
  );
}
