export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-sentinel-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sentinel-accent text-2xl font-bold">⬡</span>
          <h1 className="text-xl font-bold">Sentinel</h1>
          <span className="text-xs text-gray-500 ml-2">v0.1.0</span>
        </div>
        <p className="text-sm text-gray-400">Don't trade blind.</p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">⬡</div>
          <h2 className="text-3xl font-bold text-sentinel-accent">Sentinel</h2>
          <p className="text-gray-400 text-lg">AI Risk Intelligence for Bags</p>
          <div className="flex gap-4 justify-center mt-8">
            <div className="bg-sentinel-surface border border-sentinel-border rounded-lg p-4 w-40">
              <p className="text-sentinel-safe text-2xl font-bold">0-100</p>
              <p className="text-xs text-gray-400 mt-1">Risk Score</p>
            </div>
            <div className="bg-sentinel-surface border border-sentinel-border rounded-lg p-4 w-40">
              <p className="text-sentinel-accent text-2xl font-bold">Auto</p>
              <p className="text-xs text-gray-400 mt-1">Fee Optimizer</p>
            </div>
            <div className="bg-sentinel-surface border border-sentinel-border rounded-lg p-4 w-40">
              <p className="text-sentinel-caution text-2xl font-bold">Live</p>
              <p className="text-xs text-gray-400 mt-1">Alerts</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-8">W1 — Foundation in progress</p>
        </div>
      </main>
    </div>
  );
}
