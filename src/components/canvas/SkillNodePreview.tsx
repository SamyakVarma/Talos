import SkillNode from "./SkillNode";
import { SkillData, SkillPort } from "../../types/node";

interface SkillNodePreviewProps {
  data: SkillData;
  scale?: number; // default: 0.8
}

export default function SkillNodePreview({ data, scale = 0.8 }: SkillNodePreviewProps) {
  const noop = () => {};

  // Copy node data
  const previewData: SkillData = { ...data };

  // Ensure EXEC ports exist
  if (
    (previewData.skillType === "Basic")
  ) {
    // Add output EXEC if missing
    if (!previewData.outputs.some((p) => p.type === "EXEC")) {
      const execOutPort: SkillPort = {
        id: "exec_out",
        label: "Exec Out",
        type: "EXEC",
        io: "output",
        offset: { x: 0, y: 0 },
      };
      previewData.outputs = [...previewData.outputs, execOutPort];
    }

    // Add input EXEC if missing
    if (!previewData.inputs.some((p) => p.type === "EXEC")) {
      const execInPort: SkillPort = {
        id: "exec_in",
        label: "Exec In",
        type: "EXEC",
        io: "input",
        offset: { x: 0, y: 0 },
      };
      previewData.inputs = [...previewData.inputs, execInPort];
    }
  }

  return (
    <div
      className="relative p-2 overflow-hidden flex items-center justify-center"
      style={{ width: 220, height: 160 }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SkillNode
          data={{ ...previewData, x: 0, y: 0 }}
          selected={false}
          onMouseDown={noop}
          onPortOffsetUpdate={noop}
          onPortMouseDown={noop}
          onPortHover={noop}
          onPortLeave={noop}
        />
      </div>
    </div>
  );
}
