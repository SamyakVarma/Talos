// FileExplorer.tsx
import { Tree } from "react-arborist";

export const FileExplorer = ({ files, onSelect }: any) => {
  return (
    <Tree
      data={files}
      width={250}
      height={600}
      indent={16}
      rowHeight={28}
      onSelect={(node) => onSelect(node.data)}
    >
      {({ node, style }) => (
        <div style={style} className="text-gray-200">
          {node.isLeaf ? "📄" : "📁"} {node.data.name}
        </div>
      )}
    </Tree>
  );
};
