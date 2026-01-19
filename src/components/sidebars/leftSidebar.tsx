import { Home, ChevronLeft, ChevronRight, X, FileCode, Network } from "lucide-react";
import { useTab } from "../../contexts/TabContext";

type sidebarMode = "overlay" | "inline";

export function LeftSidebar({
  open,
  onToggle,
  mode = "overlay",
}: {
  open: boolean;
  onToggle: () => void;
  mode?: sidebarMode;
}) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTab();

  return (
    <div
      className={`absolute left-0 top-1/2 -translate-y-1/2 bg-gray-900 border-r border-gray-700 z-30 transition-all duration-300 ${mode === "overlay" ? "absolute" : "relative flex-shrink-0"}`}
      style={{
        width: open ? "250px" : "60px",
        height: mode === "overlay" ? "97vh" : "100%",
        left: mode === "overlay" ? 0 : undefined,
        top: mode === "overlay" ? "50%" : undefined,
        transform: mode === "overlay" ? "translateY(-50%)" : undefined,
        borderTopRightRadius: mode === "overlay" ? "20px" : "0px",
        borderBottomRightRadius: mode === "overlay" ? "20px" : "0px",
      }}
    >
      <div className="p-4 space-y-4 flex flex-col h-full">
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="p-2 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center hover:bg-gray-700 transition-colors"
          style={{
            width: open ? "40px" : "30px",
            height: open ? "40px" : "30px",
          }}
        >
          {open ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        <div className="mt-6 space-y-3 flex-1 flex flex-col overflow-hidden">
          {/* Home Button */}
          <button
            onClick={() => window.history.back()}
            className="w-full flex items-center gap-3 px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg justify-start transition-colors"
          >
            <Home className="w-6 h-6" />
            {open && <span className="text-sm whitespace-nowrap">Home</span>}
          </button>

          {/* Divider */}
          {tabs.length > 0 && (
            <div className="border-t border-gray-700 my-2"></div>
          )}

          {/* Tabs Section */}
          {tabs.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-1">
              {open && (
                <div className="text-xs text-gray-400 px-2 py-1 uppercase tracking-wide">
                  Open Files
                </div>
              )}
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const isActive = activeTabId === tab.id;
                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer group transition-colors ${
                        isActive
                          ? "bg-cyan-800/60 hover:bg-cyan-700/60"
                          : "bg-gray-800/60 hover:bg-gray-700/60"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {/* Icon */}
                      {tab.type === "bot" ? (
                        <Network className="w-5 h-5 flex-shrink-0 text-green-400" />
                      ) : tab.type === "complex" ? (
                        <Network className="w-5 h-5 flex-shrink-0 text-purple-400" />
                      ) : (
                        <FileCode className="w-5 h-5 flex-shrink-0 text-blue-400" />
                      )}
                      
                      {open && (
                        <>
                          {/* Tab Label */}
                          <span className="text-sm flex-1 truncate" title={tab.label}>
                            {tab.label}
                          </span>
                          
                          {/* Close Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded p-0.5 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}