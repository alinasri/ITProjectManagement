import { ALL_STATUS_CONFIG, PROJECT_STATUS_CONFIG, PROJECT_STATUS_OPTIONS } from '../config/statusConfigs';

export default function StatusBadge({ status }) {
  const cfg = ALL_STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-700/60 text-gray-300' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export { PROJECT_STATUS_CONFIG as STATUS_CONFIG, PROJECT_STATUS_OPTIONS as STATUS_OPTIONS };
