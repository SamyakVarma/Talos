import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

interface TerminalWindowProps {
  isOpen: boolean;
  onClose: () => void;
  lines: string[];
}

export function TerminalWindow({ isOpen, onClose, lines }: TerminalWindowProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 h-64 bg-black text-green-400 font-mono text-sm rounded shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-t">
        <span>Bot Terminal</span>
        <button onClick={onClose} className="text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
