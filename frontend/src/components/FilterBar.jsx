import { Search, X } from 'lucide-react';

export default function FilterBar({ searchTerm, onSearchChange, statuses, activeStatus, onStatusChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4" dir="rtl">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="جستجو..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pr-9 pl-9 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onStatusChange(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeStatus === null
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          همه
        </button>
        {statuses.map(s => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value === activeStatus ? null : s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeStatus === s.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
