import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { core } from "@tauri-apps/api";
import { Plus } from "lucide-react";
import BotCard from "../components/BotCard";
import AddBotPopup from "../components/AddBotPopup";


interface Bot {
  name: string;
  description: string;
  path: string;
}

export default function Home() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();
  function openBot(bot: Bot) {
    navigate(`/skill_zone/${bot.name}`, { state: bot });
  }
  // Fetch bots on startup
  useEffect(() => {
    async function fetchBots() {
      try {
        const result = await core.invoke("get_bots_list");
        if (Array.isArray(result)) setBots(result as Bot[]);
      } catch (err) {
        console.error("Error loading bots:", err);
      }
    }
    fetchBots();
  }, []);

  async function handleCreateBot(botData: {
    botName: string;
    botDescription: string;
    customPath?: string;
  }) {
    try {
      const response = await core.invoke("create_bot", {
        botName: botData.botName,
        botDescription: botData.botDescription,
        customPath: botData.customPath || null,
      });
      console.log("Tauri response:", response);

      const newBot: Bot = {
        name: botData.botName,
        description: botData.botDescription,
        path: botData.customPath || "Documents/talos",
      };

      setBots((prev) => [...prev, newBot]);
      setShowPopup(false);
    } catch (err) {
      console.error("Error creating bot:", err);
      alert(`Error: ${err}`);
    }
  }

  return (
    <div className="flex-1 p-3">
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-4xl font-bold text-white mb-4">Welcome to Talos</h1>
            <p className="text-gray-400 text-lg">Manage your bots and explore the marketplace</p>
        </div>
        <button  onClick={() => setShowPopup(true)} className="relative flex items-center gap-2 px-6 h-12 rounded-lg font-semibold text-gray-300 
             transition-all duration-300 backdrop-blur-md 
             bg-gradient-to-t from-green-800/60 to-transparent 
             border-b border-l border-r border-white/10 
             hover:text-white hover:from-green-600/60 hover:to-transparent 
             hover:shadow-lg hover:shadow-green-500/10">
          <Plus className="w-5 h-5" />
          <span>Add Bot</span>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
        </button>
      </div>
      
      <div className="max-w-7xl mx-auto">
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot, index) => (
            <BotCard
                key={index}
                name={bot.name}
                description={bot.description}
                onClick={() => openBot(bot)}
            />
            ))}
        </div>
      </div>
      {showPopup && (
        <AddBotPopup
          onClose={() => setShowPopup(false)}
          onCreate={handleCreateBot}
        />
      )}
    </div>
  );
}
