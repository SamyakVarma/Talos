import { useState} from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';

export interface AssetItem {
  id: string;
  label: string;
  type: "skill" | "utility" | "std_skill" | "static";
  preview?: React.ReactNode;
}

interface AssetBrowserProps {
  assets: AssetItem[];
  onAssetDoubleClick?: (asset: AssetItem) => void;
}

// interface Props {
//   assets: AssetItem[];
//   isOpen: boolean;
//   width: number;
//   onResize: (newWidth: number) => void;
//   onToggle: () => void;
//   context?: {
//     type: "bot" | "skill";
//     skillId: string;
//     skillPath: string;
//     botPath: string;
//   }

//   style?: React.CSSProperties;
//   onAssetDoubleClick?: (asset: AssetItem) => void;
// }

function DraggableAsset({
  asset,
  onDoubleClick,
}: {
  asset: AssetItem;
  onDoubleClick?: (asset: AssetItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asset.id,
    data: asset,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onDoubleClick?.(asset)}
      className={`asset-item bg-neutral-800 p-3 rounded border transition-all
        border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600
        cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      {asset.preview ? (
        <div className="mb-3 flex items-center justify-center pointer-events-none">
          {asset.preview}
        </div>
      ) : (
        <div className="mb-3 text-center text-xs opacity-60">(No preview)</div>
      )}
      <div className="text-sm font-semibold">{asset.label}</div>
      <div className="text-xs opacity-50">{asset.type}</div>
    </div>
  );
}

export default function AssetBrowser({
  assets,
  onAssetDoubleClick,
}: AssetBrowserProps) {
  const [category, setCategory] = useState<'custom' | 'utility' | 'standard' | 'static'>('custom');

  // ================= Filter Assets =================
  const filteredAssets = assets.filter((a) => {
    if (category === "custom") return a.type === "skill";
    if (category === "utility") return a.type === "utility";
    if (category === "standard") return a.type === "std_skill";
    if (category === "static") return a.type === "static";
    return true;
  });

  return (
    <div className="p-3 text-neutral-300 h-full flex flex-col">
      <div className="text-lg font-semibold mb-3">Asset Browser</div>

      {/* Category Selector */}
      <select
        className="mb-4 p-2 bg-neutral-800 border border-neutral-700 rounded text-sm"
        value={category}
        onChange={(e) => setCategory(e.target.value as 'custom' | 'utility' | 'standard' | 'static')}
      >
        <option value="custom">Custom Skills</option>
        <option value="utility">Utilities</option>
        <option value="standard">Standard Skills</option>
        <option value="static">Static</option>
      </select>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {filteredAssets.map((a) => (
          <DraggableAsset
            key={a.id}
            asset={a}
            onDoubleClick={onAssetDoubleClick}
          />
        ))}
      </div>
    </div>
  );
}
