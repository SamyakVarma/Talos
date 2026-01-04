import React, { useLayoutEffect, useRef } from "react";

export interface SkillPort {
  id: string;
  label: string;
  type:
    | "int"
    | "float"
    | "char"
    | "string"
    | "bool"
    | "int[]"
    | "float[]"
    | "string[]"
    | "bool[]"
    | "EXEC";
  io: "input" | "output";
  offset?: { x: number; y: number }; // relative to node center
}

export interface SkillData {
  id: string;
  x: number;
  y: number;
  label: string;
  skillType: string;
  inputs: SkillPort[];
  outputs: SkillPort[];
  value?: string | number | boolean | string[] | number[] | boolean[];
}

interface SkillNodeProps {
  data: SkillData;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (e: React.MouseEvent, nodeId: string) => void;
  onPortOffsetUpdate?: (nodeId: string, portId: string, offset: { x: number; y: number }) => void;
  onPortMouseDown?: (
    nodeId: string,
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output",
    offset: { x: number; y: number }
  ) => void;

  onPortHover?: (
    nodeId: string,
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output"
  ) => void;

  onPortLeave?: () => void;
}

export default function SkillNode({
  data,
  selected,
  onMouseDown,
  onDoubleClick,
  onPortOffsetUpdate,
  onPortMouseDown,
  onPortHover,
  onPortLeave,
}: SkillNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const portRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const inputs = data.inputs ?? [];
  const outputs = data.outputs ?? [];

  // Separate execution ports from data ports
  const execInputs = inputs.filter((p) => p.type === "EXEC");
  const execOutputs = outputs.filter((p) => p.type === "EXEC");
  const attrInputs = inputs.filter((p) => p.type !== "EXEC");
  const attrOutputs = outputs.filter((p) => p.type !== "EXEC");

  const hasExec = execInputs.length > 0 || execOutputs.length > 0;
  const isStaticAttribute = data.skillType === "static_attribute";

  // --- Compute offsets on layout ---
  useLayoutEffect(() => {
    if (!nodeRef.current || !onPortOffsetUpdate) return;

    const nodeRect = nodeRef.current.getBoundingClientRect();

    Object.entries(portRefs.current).forEach(([portId, el]) => {
      if (!el) return;
      const portRect = el.getBoundingClientRect();
      const offset = {
        x: portRect.left + portRect.width / 2 - (nodeRect.left + nodeRect.width / 2),
        y: portRect.top + portRect.height / 2 - (nodeRect.top + nodeRect.height / 2),
      };
      onPortOffsetUpdate(data.id, portId, offset);
    });
  }, [data.x, data.y, inputs.length, outputs.length]);

  // Utility to assign refs to ports
  const setPortRef = (portId: string, el: HTMLDivElement | null) => {
    portRefs.current[portId] = el;
  };

  const handlePortMouseDown = (
    e: React.MouseEvent,
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output"
  ) => {
    e.stopPropagation(); // prevent node dragging / panning
    if (!onPortMouseDown || !nodeRef.current) return;

    const el = portRefs.current[portId];
    const nodeEl = nodeRef.current;
    if (!el || !nodeEl) return;

    const nodeRect = nodeEl.getBoundingClientRect();
    const portRect = el.getBoundingClientRect();

    const offset = {
      x: portRect.left + portRect.width / 2 - (nodeRect.left + nodeRect.width / 2),
      y: portRect.top + portRect.height / 2 - (nodeRect.top + nodeRect.height / 2),
    };

    onPortMouseDown(data.id, portId, portType, io, offset);
  };

  const handlePortEnter = (
    portId: string,
    portType: SkillPort["type"],
    io: "input" | "output"
  ) => {
    if (onPortHover) onPortHover(data.id, portId, portType, io);
  };

  const handlePortExit = () => {
    if (onPortLeave) onPortLeave();
  };

  const portEvents = (port: SkillPort) => ({
    onMouseDown: (e: React.MouseEvent) => handlePortMouseDown(e, port.id, port.type, port.io),
    onMouseEnter: () => handlePortEnter(port.id, port.type, port.io),
    onMouseLeave: handlePortExit,
  });

  return (
    <div
      ref={nodeRef}
      className={`node-item absolute rounded-xl shadow-lg border bg-slate-800 text-slate-100 w-64 select-none cursor-grab ${
        selected ? "border-cyan-400 ring-2 ring-cyan-400" : "border-slate-600"
      }`}
      style={{
        left: data.x,
        top: data.y,
        transform: "translate(-50%, -50%)",
      }}
      onMouseDown={(e) => onMouseDown && onMouseDown(e, data.id)}
      onDoubleClick={(e) => onDoubleClick && onDoubleClick(e, data.id)}
    >
      {/* EXEC HEADER */}
      {hasExec && (
        <div className="flex justify-between items-center px-3 py-1 bg-slate-700 rounded-t-xl">
          <div className="flex items-center gap-2">
            {execInputs.map((port) => (
              <div
                key={port.id}
                ref={(el) => setPortRef(port.id, el)}
                className="w-3 h-3 bg-green-400 rounded-full"
                data-portid={port.id}
                data-io="input"
                {...portEvents(port)}
              ></div>
            ))}
          </div>

          <span className="font-semibold text-sm">{data.label}</span>

          <div className="flex items-center gap-2">
            {execOutputs.map((port) => (
              <div
                key={port.id}
                ref={(el) => setPortRef(port.id, el)}
                className="w-3 h-3 bg-green-400 rounded-full"
                data-portid={port.id}
                data-io="output"
                {...portEvents(port)}
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* BODY */}
      {isStaticAttribute ? (
        // Static attribute node
        <div className={`flex flex-col justify-between px-3 py-2 ${hasExec ? "" : "rounded-t-xl"}`}>
          <div className="flex justify-center items-center mb-2">
            <span className="font-semibold text-sm">{data.label}</span>
            <span className="text-slate-400 text-xs ml-2">
              ({data.outputs[0]?.type || "unknown"})
            </span>
          </div>
          {data.outputs.length > 0 && (
            <div className="flex justify-end items-center gap-2">
              <span className="text-xs">{data.outputs[0].label}</span>
              <div
                ref={(el) => setPortRef(data.outputs[0].id, el)}
                className="w-2 h-2 rounded-full bg-yellow-400"
                data-portid={data.outputs[0].id}
                data-io="output"
                {...portEvents(data.outputs[0])}
              ></div>
            </div>
          )}
        </div>
      ) : (
        // Normal node
        <div className={`flex flex-row justify-between px-3 py-2 ${hasExec ? "" : "rounded-t-xl"}`}>
          {/* Inputs */}
          <div className="flex flex-col gap-2">
            {attrInputs.map((port) => (
              <div key={port.id} className="flex items-center gap-2">
                <div
                  ref={(el) => setPortRef(port.id, el)}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  data-portid={port.id}
                  data-io="input"
                  {...portEvents(port)}
                ></div>
                <span className="text-xs">{port.label}</span>
              </div>
            ))}
          </div>

          {/* Outputs */}
          <div className="flex flex-col gap-2 items-end">
            {attrOutputs.map((port) => (
              <div key={port.id} className="flex items-center gap-2">
                <span className="text-xs">{port.label}</span>
                <div
                  ref={(el) => setPortRef(port.id, el)}
                  className="w-2 h-2 rounded-full bg-yellow-400"
                  data-portid={port.id}
                  data-io="output"
                  {...portEvents(port)}
                ></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
