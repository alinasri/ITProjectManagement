// Canonical status configs for every domain.
// Single source of truth — import from here rather than defining locally in each page.
// Previously each page had its own copy; that caused label and colour drift between
// the dedicated page and SectionDashboard (where the same statuses appear).

export const PROJECT_STATUS_CONFIG = {
  not_started:  { label: 'شروع نشده',    cls: 'bg-gray-700/60 text-gray-300' },
  in_progress:  { label: 'در حال انجام', cls: 'bg-blue-900/60 text-blue-300' },
  on_hold:      { label: 'متوقف',         cls: 'bg-amber-900/60 text-amber-300' },
  completed:    { label: 'تکمیل شده',    cls: 'bg-emerald-900/60 text-emerald-300' },
};

export const TASK_STATUS_CONFIG = {
  pending:     { label: 'در انتظار',    cls: 'bg-gray-700/60 text-gray-300' },
  in_progress: { label: 'در حال انجام', cls: 'bg-blue-900/60 text-blue-300' },
  on_hold:     { label: 'متوقف',        cls: 'bg-amber-900/60 text-amber-300' },
  completed:   { label: 'تکمیل شده',   cls: 'bg-emerald-900/60 text-emerald-300' },
};

export const PURCHASE_STATUS_CONFIG = {
  pending:   { label: 'در انتظار',    cls: 'bg-amber-900/60 text-amber-300' },
  approved:  { label: 'تأیید شده',    cls: 'bg-blue-900/60 text-blue-300' },
  purchased: { label: 'خریداری شده',  cls: 'bg-indigo-900/60 text-indigo-300' },
  delivered: { label: 'تحویل شده',    cls: 'bg-emerald-900/60 text-emerald-300' },
  cancelled: { label: 'لغو شده',      cls: 'bg-red-900/60 text-red-300' },
};

export const TENDER_STATUS_CONFIG = {
  open:       { label: 'در حال برگزاری',  cls: 'bg-blue-900/60 text-blue-300' },
  evaluating: { label: 'در حال ارزیابی',  cls: 'bg-amber-900/60 text-amber-300' },
  awarded:    { label: 'برنده اعلام شده', cls: 'bg-emerald-900/60 text-emerald-300' },
  completed:  { label: 'تکمیل شده',       cls: 'bg-gray-700/60 text-gray-300' },
  cancelled:  { label: 'لغو شده',         cls: 'bg-red-900/60 text-red-300' },
};

export const CONTRACT_STATUS_CONFIG = {
  active:    { label: 'فعال',          cls: 'bg-emerald-900/60 text-emerald-300' },
  renewed:   { label: 'تمدید شده',     cls: 'bg-blue-900/60 text-blue-300' },
  expired:   { label: 'خاتمه یافته',   cls: 'bg-gray-700/60 text-gray-300' },
  cancelled: { label: 'لغو شده',       cls: 'bg-red-900/60 text-red-300' },
};

// Pre-built option arrays for <select> dropdowns and filter bars.
// Derived automatically so they never go out of sync with the configs above.
function toOptions(config) {
  return Object.entries(config).map(([value, { label }]) => ({ value, label }));
}

export const PROJECT_STATUS_OPTIONS  = toOptions(PROJECT_STATUS_CONFIG);
export const TASK_STATUS_OPTIONS     = toOptions(TASK_STATUS_CONFIG);
export const PURCHASE_STATUS_OPTIONS = toOptions(PURCHASE_STATUS_CONFIG);
export const TENDER_STATUS_OPTIONS   = toOptions(TENDER_STATUS_CONFIG);
export const CONTRACT_STATUS_OPTIONS = toOptions(CONTRACT_STATUS_CONFIG);
