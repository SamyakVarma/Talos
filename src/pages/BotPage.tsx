import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTab } from "../contexts/TabContext";
import { LeftSidebar } from "../components/sidebars/leftSidebar";
import SkillZone from "../components/canvas/SkillZone";
import SkillEditor from "../components/Editor/SkillEditor";

export default function BotPage() {
  const location = useLocation();
  const bot = location.state;
  const { tabs, activeTabId, openTab, closeTab } = useTab();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newlyCreatedSkill, setNewlyCreatedSkill] = useState<{
    id: string;
    root: string;
    type: "Basic" | "Complex";
  } | null>(null);


  useEffect(() => {
    if (!bot) return;
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

  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) {
    return (
      <div className="w-full h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const handleSkillCreated = (
    skillId: string,
    skillRootPath: string,
    type: "Basic" | "Complex"
  ) => {
    if (type === "Basic") {
      setNewlyCreatedSkill({
        id: skillId,
        root: skillRootPath,
        type,
      });
    }
  };


  return (
    <div className="w-full h-screen flex bg-[#1a1a1a] text-white overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        mode={activeTab.type === "Basic" ? "inline" : "overlay"}
      />
    
      {/* MAIN CONTENT */}
      <div className="flex-1 h-full overflow-hidden">
        {activeTab.type === "Basic" ? (
          <SkillEditor
            skillId={newlyCreatedSkill?.id ?? activeTab.skillId}
            rootPath={activeTab.botPath}
            skillRoot={newlyCreatedSkill?.root ?? activeTab.path}
          />
        ) : activeTab.type === "Complex" ? (
          <SkillZone
            skillPath={activeTab.path}
            skillId={activeTab.skillId}
            botPath={activeTab.botPath}
            isSkill
            onSkillCreated={handleSkillCreated}
          />
        ) : (
          // Bot root
          <SkillZone
            botPath={activeTab.path}
            onSkillCreated={handleSkillCreated}
          />
        )}
      </div>
    </div>
  );
}
