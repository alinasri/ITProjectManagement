export default function StatCard({ label, value, icon, color = 'indigo' }) {
  const colors = {
    indigo:  'bg-indigo-900/30 text-indigo-400 border-indigo-800/40',
    blue:    'bg-blue-900/30 text-blue-400 border-blue-800/40',
    amber:   'bg-amber-900/30 text-amber-400 border-amber-800/40',
    emerald: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    gray:    'bg-gray-800/50 text-gray-400 border-gray-700/40',
  };
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${colors[color]}`}>
      {icon && (
        <div className="text-2xl shrink-0">{icon}</div>
      )}
      <div>
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-sm mt-0.5 opacity-80">{label}</p>
      </div>
    </div>
  );
}
