import { useState } from 'react';

export function SearchBar({ onSearch }: { onSearch: (mint: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste token mint address..."
          className="w-full bg-sentinel-surface border border-sentinel-border rounded-lg px-4 py-3 pr-24 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sentinel-accent transition-colors"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-sentinel-accent hover:bg-sentinel-accent-dim text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
        >
          Scan
        </button>
      </div>
    </form>
  );
}
