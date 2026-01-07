import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import SkillZoneInner from "../SkillZone/SkillZoneInner";
import SkillEditor from "./SkillEditor";
import { useTab } from "../contexts/TabContext";

export default function SkillZone() {
  const location = useLocation();
  const bot = location.state;
  const { tabs, activeTabId, openTab } = useTab();

  // Open the initial bot tab when entering SkillZone
  useEffect(() => {
    if (bot && tabs.length === 0) {
      openTab({
        id: `bot-${bot.name}`,
        label: bot.name,
        type: "bot",
        path: bot.path,
        botPath: bot.path,
      });
    }
  }, [bot, tabs.length, openTab]);

  // Find the active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // If no active tab, show a loading or empty state
  if (!activeTab) {
    return (
      <div className="w-full h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Render based on active tab type
  if (activeTab.type === "basic") {
    return (
      <>
        <path
          d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        {hoveredPortRef.current && (() => {
          const node = getNodeById(hoveredPortRef.current!.skillId);
          if (!node) return null;
          const world = getPortWorldPosition(node!, hoveredPortRef.current!.portId);
          const highlightColor = activeConnection.isValid ? "#fff" : "#ef4444";
          return (
            <circle
              cx={world.x}
              cy={world.y}
              r={8 / Math.max(0.7, scale)}
              fill="none"
              stroke={highlightColor}
              strokeWidth={2 / Math.max(0.7, scale)}
            />
          );
        })()}
      </>
    );
  };

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;
  return (
    <DndContext onDragEnd={handleDragEnd}>
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex">
      {/* Left Sidebar */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 bg-gray-900 border-r border-gray-700 z-30 transition-all duration-300`}
        style={{
          width: sidebarOpen ? "250px" : "60px",
          height: "97vh",
          borderTopRightRadius: "20px",
          borderBottomRightRadius: "20px",
        }}
      >
        <div className="p-4 space-y-4 flex flex-col">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center"
            style={{
              width: sidebarOpen ? "40px" : "30px",
              height: sidebarOpen ? "40px" : "30px",
            }}
          >
            {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          <div className="mt-6 space-y-3 flex-1 flex flex-col">
            <button
              onClick={() => window.history.back()}
              className="w-full flex items-center gap-3 px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg justify-start"
            >
              <Home className="w-6 h-6" />
              {sidebarOpen && (
                <span className="text-sm whitespace-nowrap">Home</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div
          className="absolute top-0 h-full transition-all duration-300 z-40"
          style={{
            width: "300px", // Properties panel width
            right: assetBrowserOpen ? `${assetBrowserWidth}px` : "0px", // shift left if asset browser is open
          }}
        >
          <PropertiesPanel
            selectedNode={selectedNode}
            onClose={handleCloseProperties}
            onUpdateNode={handleUpdateNode}
          />
        </div>
      )}
        {/* CANVAS */}
      <div
        ref={(node) => {
            containerRef.current = node;
            setDroppableRef(node);
          }}
        id="skill-zone-canvas"
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #444 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: `${pos.x % 40}px ${pos.y % 40}px`,
          }}
        />

        {/* WORLD */}
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            width={50000}
            height={50000}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ overflow: "visible" }}
          >
            {renderConnections()}
            {activeConnection && renderActiveConnectionPreview()}
          </svg>

          {/* NODES */}
          {graph.nodes.map((node) => (
            <SkillNode
              key={node.id}
              data={node}
              selected={node.id === selectedNodeId}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onPortOffsetUpdate={handlePortOffsetUpdate}
              onPortMouseDown={handlePortMouseDown}
              onPortHover={handlePortHover}
              onPortLeave={handlePortLeave}
            />
          ))}
        </div>
      </div>
      
      {/* Right-side Asset Browser */}
      <AssetBrowser
        assets={assets}
        isOpen={assetBrowserOpen}
        width={assetBrowserWidth}
        onResize={setAssetBrowserWidth}
        onToggle={() => setAssetBrowserOpen(!assetBrowserOpen)}
        style={{ zIndex: 5 }}
        onAssetDoubleClick={handleAssetDoubleClick}
      />
    </div>
  </DndContext>
  );
}