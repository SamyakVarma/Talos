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
      <SkillEditor
        skillPath={activeTab.path}
        skillId={activeTab.skillId!}
      />
    );
  }

  if (activeTab.type === "complex") {
    return (
      <SkillZoneInner
        skillPath={activeTab.path}
        skillId={activeTab.skillId!}
        botPath={activeTab.botPath}
        isSkill={true}
      />
    );
  }

  // Default to bot view (type === "bot")
  return <SkillZoneInner botPath={activeTab.path} />;
}