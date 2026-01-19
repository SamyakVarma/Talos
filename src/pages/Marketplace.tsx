export default function Marketplace() {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-4">Marketplace</h1>
        <p className="text-gray-400 text-lg mb-8">Discover and install new bots</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Placeholder marketplace items */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer">
              <div className="h-24 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg mb-4"></div>
              <h3 className="text-lg font-semibold text-white mb-2">Bot Template {i}</h3>
              <p className="text-gray-400 text-sm mb-3">Automated trading bot</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">★ 4.8</span>
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors">
                  Install
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
