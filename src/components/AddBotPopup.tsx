import React, { useState } from "react";
import { X, Folder } from "lucide-react";

interface AddBotPopupProps {
  onClose: () => void;
  onCreate: (bot: { botName: string; botDescription: string; customPath?: string }) => void;
}

const AddBotPopup: React.FC<AddBotPopupProps> = ({ onClose, onCreate }) => {
  const [botName, setBotName] = useState("");
  const [botDescription, setBotDescription] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    setTimeout(() => {
      onCreate({ botName, botDescription, customPath });
      setIsCreating(false);
      onClose();
    }, 1000); // simulate async creation
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-green-500/90 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Create New Bot</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Bot name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bot Name *
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g., D.U.M.M.Y"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={botDescription}
              onChange={(e) => setBotDescription(e.target.value)}
              placeholder="What does this bot do?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-none"
            />
          </div>

          {/* Custom Path */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Path (Optional)
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="Default: C:/Users/<username>/Documents/talos"
                className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Leave empty to use default location
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !botName.trim()}
              className="flex-1 px-4 py-3 bg-green-400 disabled:from-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-lg"
            >
              {isCreating ? "Creating..." : "Create Bot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBotPopup;
