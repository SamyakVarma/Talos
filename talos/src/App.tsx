import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import SkillZone from "./pages/SkillZone";
import { TabProvider } from "./contexts/TabContext";

export default function App() {
  const location = useLocation();
  const inSkillZone = location.pathname.startsWith("/skill_zone");

  return (
    <TabProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex flex-col">
        {/* Top Toolbar */}
        {!inSkillZone && (
          <nav className="bg-gray-900/80 backdrop-blur-md flex py-6 items-center border-b border-gray-800 sticky mx-10">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-8 justify-between w-full">
                <div className="flex">
                  <h1 className="text-2xl font-bold text-green-400">Talos</h1>
                </div>
                <div className="flex gap-3">
                  <Link
                    to="/"
                    className={`relative px-5 py-2 rounded-lg font-medium transition-all duration-300 backdrop-blur-md bg-gradient-to-t from-gray-800/60 to-transparent border-b border-l border-r border-white/10 ${
                      location.pathname === "/"
                        ? "from-green-800/60 to-transparent text-white shadow-lg shadow-green-300/30"
                        : "text-gray-300 hover:text-white hover:from-gray-700/60 hover:to-transparent"
                    }`}
                  >
                    Home
                  </Link>

                  <Link
                    to="/marketplace"
                    className={`relative px-5 py-2 rounded-lg font-medium transition-all duration-300 backdrop-blur-md bg-gradient-to-t from-gray-800/60 to-transparent border-b border-l border-r border-white/10 ${
                      location.pathname === "/marketplace"
                        ? "from-green-800/60 to-transparent text-white shadow-lg shadow-green-300/30"
                        : "text-gray-300 hover:text-white hover:from-gray-700/60 hover:to-transparent"
                    }`}
                  >
                    Marketplace
                  </Link>
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* Main Content */}
        <main
          className={`flex-1 flex flex-col justify-between ${
            inSkillZone ? "p-0 m-0" : "p-3"
          }`}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/skill_zone/:botName" element={<SkillZone />} />
          </Routes>
        </main>
      </div>
    </TabProvider>
  );
}