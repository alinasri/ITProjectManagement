const config = {
  not_started:  { label: 'شروع نشده',    cls: 'bg-gray-700/60 text-gray-300' },
  in_progress:  { label: 'در حال انجام', cls: 'bg-blue-900/60 text-blue-300' },
  on_hold:      { label: 'متوقف',         cls: 'bg-amber-900/60 text-amber-300' },
  completed:    { label: 'تکمیل شده',    cls: 'bg-emerald-900/60 text-emerald-300' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = config[status] || config.not_started;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export const STATUS_OPTIONS = Object.entries(config).map(([value, { label }]) => ({ value, label }));
