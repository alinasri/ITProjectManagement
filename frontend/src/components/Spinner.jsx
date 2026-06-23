export default function Spinner({ className = 'flex items-center justify-center h-64' }) {
  return (
    <div className={className}>
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
