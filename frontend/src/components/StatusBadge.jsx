import { PROJECT_STATUS_CONFIG, PROJECT_STATUS_OPTIONS } from '../config/statusConfigs';

export default function StatusBadge({ status }) {
  const { label, cls } = PROJECT_STATUS_CONFIG[status] || PROJECT_STATUS_CONFIG.not_started;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// Re-exported under the old names so existing callers don't need to change.
export { PROJECT_STATUS_CONFIG as STATUS_CONFIG, PROJECT_STATUS_OPTIONS as STATUS_OPTIONS };
