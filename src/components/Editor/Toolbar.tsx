// TopToolbar.tsx
interface TopToolbarProps {
  pythonVersion: string;
  setPythonVersion: (v: string) => void;
  onSave: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  pythonVersion,
  setPythonVersion,
  onSave,
}) => {
  return (
    <div className="flex items-center gap-4 p-2 bg-[#2d2d2d] text-white">
      <select
        value={pythonVersion}
        onChange={(e) => setPythonVersion(e.target.value)}
        className="bg-[#1e1e1e] p-1 rounded"
      >
        <option value="3.8">Python 3.8</option>
        <option value="3.9">Python 3.9</option>
        <option value="3.10">Python 3.10</option>
        <option value="3.11">Python 3.11</option>
      </select>

      <button
        onClick={onSave}
        className="px-3 py-1 bg-blue-600 rounded"
      >
        Save
      </button>
    </div>
  );
};
