import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';

export interface AssetItem {
  id: string;
  label: string;
  type: "skill" | "utility" | "std_skill" | "static";
  preview?: React.ReactNode;
}

interface Props {
  assets: AssetItem[];
  isOpen: boolean;
  width: number;
  onResize: (newWidth: number) => void;
  onToggle: () => void;
  style?: React.CSSProperties;
  onAssetDoubleClick?: (asset: AssetItem) => void;
}

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
      className={` asset-item bg-neutral-800 p-3 rounded border transition-all
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
  isOpen,
  width,
  onResize,
  onToggle,
  onAssetDoubleClick,
}: Props) {
  const [category, setCategory] = useState<'custom' | 'utility' | 'standard' | 'static'>('custom');
  const [resizing, setResizing] = useState(false);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  // ================= Resizing Logic =================
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    setResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;

    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const dx = startX.current - e.clientX;
    const newWidth = Math.max(200, startWidth.current + dx);
    onResize(newWidth);
  };

  const handleMouseUp = () => {
    if (isResizing.current) {
      isResizing.current = false;
      setResizing(false);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [width]); // Add width as a dependency if resizing needs to be dynamic

  // ================= Filter Assets =================
  const filteredAssets = assets.filter((a) => {
    if (category === "custom") return a.type === "skill";
    if (category === "utility") return a.type === "utility";
    if (category === "standard") return a.type === "std_skill";
    if (category === "static") return a.type === "static";
    return true;
  });

  return (
    <div
      className="fixed top-0 right-0 h-full bg-neutral-900 border-l border-neutral-700 shadow-xl flex flex-col z-20"
      style={{
        width: isOpen ? width : 40,
        transition: resizing ? "none" : "width 0.2s ease",
      }}
    >
      {/* ================= Resizer Handle ================= */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize z-50 hover:bg-blue-500 transition-colors"
        />
      )}

      {/* ================= Toggle Button ================= */}
      <button
        className="absolute left-[-20px] top-1/2 -translate-y-1/2
                   bg-neutral-900 border border-neutral-700 w-6 h-12
                   rounded-l-md flex items-center justify-center hover:bg-neutral-800 z-10"
        onClick={onToggle}
      >
        {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* ================= Panel Content ================= */}
      {isOpen && (
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
      )}
    </div>
  );
}
