import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ShareReportButton from '../components/ShareReportButton';
import StatCard from '../components/StatCard';
import {
  projects as projectsApi, ongoingTasks as ongoingTasksApi,
  purchases as purchasesApi, tenders as tendersApi, contracts as contractsApi,
} from '../api';
import { useSections } from '../context/SectionsContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  ChevronLeft, ShoppingCart, Gavel, FileSignature,
  LayoutDashboard, FolderKanban, ListChecks, Building2, AlertTriangle, Clock,
} from 'lucide-react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';

function toPersianDate(isoStr) {
  if (!isoStr) return null;
  return new DateObject(new Date(isoStr + 'T00:00:00')).convert(persian, persian_fa).format('D MMMM YYYY');
}

function contractExpiryTag(c) {
  if (!['active', 'renewed'].includes(c.status) || !c.end_date) return null;
  const parts = c.end_date.split('/').map(Number);
  if (parts.length !== 3) return null;
  try {
    const g = new DateObject({ year: parts[0], month: parts[1], day: parts[2], calendar: persian }).convert(gregorian);
    const end = new Date(g.year, g.month.number - 1, g.day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in60 = new Date(today); in60.setDate(in60.getDate() + 60);
    if (end < today) return 'expired';
    if (end <= in60) return 'expiring';
  } catch (_) {}
  return null;
}

const PROJECT_STATUS_COLORS = {
  not_started: '#6b7280',
  in_progress:  '#3b82f6',
  on_hold:      '#f59e0b',
  completed:    '#10b981',
};

const TASK_STATUS_COLORS = {
  pending:     '#6b7280',
  in_progress: '#3b82f6',
  on_hold:     '#f59e0b',
  completed:   '#10b981',
};

const CHART_TOOLTIP_STYLE = {
  background: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 12,
  color: '#f3f4f6',
  direction: 'rtl',
};

const TABS = [
  { id: 'overview',    label: 'نمای کلی',        icon: LayoutDashboard },
  { id: 'projects',    label: 'پروژه‌ها',          icon: FolderKanban },
  { id: 'tasks',       label: 'وظایف جاری',        icon: ListChecks },
  { id: 'registries',  label: 'خریدها، قراردادها و مناقصات',   icon: Building2 },
];

export default function ITHeadDashboard() {
  const { sections } = useSections();
  const [activeTab, setActiveTab] = useState('overview');
  const [allProjects, setAllProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allTenders, setAllTenders] = useState([]);
  const [allContracts, setAllContracts] = useState([]);
  const [deadlineChanges, setDeadlineChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      projectsApi.list(), ongoingTasksApi.list(),
      purchasesApi.list(), tendersApi.list(), contractsApi.list(),
    ])
      .then(([pRes, tRes, puRes, teRes, coRes]) => {
        setAllProjects(pRes.data);
        setAllTasks(tRes.data);
        setAllPurchases(puRes.data);
        setAllTenders(teRes.data);
        setAllContracts(coRes.data);
      })
      .finally(() => setLoading(false));

    projectsApi.deadlineChanges().then(r => setDeadlineChanges(r.data)).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const shared = { sections, allProjects, allTasks, allPurchases, allTenders, allContracts, deadlineChanges, navigate };

  return (
    <div>
      <PageHeader title="داشبورد مدیر IT" subtitle="نمای کلی تمام بخش‌ها" action={<ShareReportButton />} />

      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview'   && <OverviewTab   {...shared} />}
      {activeTab === 'projects'   && <ProjectsTab   {...shared} />}
      {activeTab === 'tasks'      && <TasksTab      {...shared} />}
      {activeTab === 'registries' && <RegistriesTab {...shared} />}
    </div>
  );
}

const PROJECT_STATUS_ROWS = [
  { key: 'not_started', label: 'شروع نشده', valueClass: 'text-gray-300' },
  { key: 'in_progress',  label: 'در جریان',  valueClass: 'text-blue-400' },
  { key: 'on_hold',      label: 'متوقف',     valueClass: 'text-amber-400' },
  { key: 'completed',    label: 'تکمیل',     valueClass: 'text-emerald-400' },
];

const TASK_STATUS_ROWS = [
  { key: 'pending',      label: 'شروع نشده', valueClass: 'text-gray-300' },
  { key: 'in_progress',  label: 'در جریان',  valueClass: 'text-blue-400' },
  { key: 'on_hold',      label: 'متوقف',     valueClass: 'text-amber-400' },
  { key: 'completed',    label: 'تکمیل',     valueClass: 'text-emerald-400' },
];

const STATUS_BADGE_STYLES = {
  // projects & tasks
  not_started: 'bg-gray-800 text-gray-300',
  pending:     'bg-gray-800 text-gray-300',
  in_progress: 'bg-blue-900/50 text-blue-300',
  on_hold:     'bg-amber-900/50 text-amber-300',
  completed:   'bg-emerald-900/50 text-emerald-300',
  // purchases
  approved:    'bg-blue-900/50 text-blue-300',
  purchased:   'bg-indigo-900/50 text-indigo-300',
  delivered:   'bg-emerald-900/50 text-emerald-300',
  // tenders
  open:        'bg-blue-900/50 text-blue-300',
  evaluating:  'bg-indigo-900/50 text-indigo-300',
  awarded:     'bg-emerald-900/50 text-emerald-300',
  // contracts
  active:      'bg-emerald-900/50 text-emerald-300',
  renewed:     'bg-blue-900/50 text-blue-300',
  expired:     'bg-gray-800 text-gray-400',
  cancelled:   'bg-red-900/50 text-red-300',
};

const STATUS_LABELS_ALL = {
  not_started: 'شروع نشده', pending: 'شروع نشده', in_progress: 'در جریان',
  on_hold: 'متوقف', completed: 'تکمیل شده', approved: 'تأیید شده',
  purchased: 'خریداری شده', delivered: 'تحویل شده', open: 'در حال برگزاری',
  evaluating: 'در حال ارزیابی', awarded: 'برنده اعلام شده',
  active: 'فعال', renewed: 'تمدید شده', expired: 'خاتمه یافته', cancelled: 'لغو شده',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_BADGE_STYLES[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {STATUS_LABELS_ALL[status] ?? status}
    </span>
  );
}

function DrilldownPanel({ type, allProjects, allTasks, allPurchases, allTenders, allContracts, sections, navigate, onClose }) {
  const sectionName = (id) => sections.find(s => s.id === id)?.name ?? '—';
  const today = new Date().toISOString().slice(0, 10);

  const configs = {
    projects: {
      title: 'پروژه‌ها',
      data: allProjects,
      columns: [
        { label: 'عنوان',   render: r => <span className="text-gray-100">{r.title}</span> },
        { label: 'بخش',     render: r => <span className="text-gray-400 text-xs">{sectionName(r.section_id)}</span> },
        { label: 'وضعیت',  render: r => <StatusPill status={r.status} /> },
        { label: 'پیشرفت', render: r => <div className="w-32"><ProgressBar value={r.progress ?? 0} /></div> },
        { label: 'مهلت',   render: r => {
          const overdue = r.due_date && r.status !== 'completed' && r.due_date < today;
          return r.due_date
            ? <span className={overdue ? 'text-red-400 text-xs font-medium' : 'text-gray-400 text-xs'}>{toPersianDate(r.due_date)}{overdue && ' ⚠'}</span>
            : <span className="text-gray-600 text-xs">—</span>;
        }},
      ],
      onRowClick: r => navigate(`/section/${r.section_id}`),
    },
    tasks: {
      title: 'وظایف جاری',
      data: allTasks,
      columns: [
        { label: 'عنوان',  render: r => <span className="text-gray-100">{r.title}</span> },
        { label: 'بخش',    render: r => <span className="text-gray-400 text-xs">{sectionName(r.section_id)}</span> },
        { label: 'وضعیت', render: r => <StatusPill status={r.status} /> },
      ],
      onRowClick: r => navigate(`/section/${r.section_id}/ongoing-tasks`),
    },
    purchases: {
      title: 'خریدها',
      data: allPurchases,
      columns: [
        { label: 'عنوان',       render: r => <span className="text-gray-100">{r.title}</span> },
        { label: 'تأمین‌کننده', render: r => <span className="text-gray-400 text-xs">{r.supplier || '—'}</span> },
        { label: 'مبلغ',        render: r => <span className="text-gray-400 text-xs">{r.amount ? r.amount.toLocaleString() : '—'}</span> },
        { label: 'وضعیت',      render: r => <StatusPill status={r.status} /> },
      ],
      onRowClick: () => navigate('/purchases'),
    },
    tenders: {
      title: 'مناقصات',
      data: allTenders,
      columns: [
        { label: 'عنوان',        render: r => <span className="text-gray-100">{r.title}</span> },
        { label: 'مبلغ تخمینی', render: r => <span className="text-gray-400 text-xs">{r.estimated_amount ? r.estimated_amount.toLocaleString() : '—'}</span> },
        { label: 'مهلت',         render: r => <span className="text-gray-400 text-xs">{r.deadline || '—'}</span> },
        { label: 'وضعیت',       render: r => <StatusPill status={r.status} /> },
      ],
      onRowClick: () => navigate('/tenders'),
    },
    contracts: {
      title: 'قراردادها',
      data: allContracts,
      columns: [
        { label: 'عنوان',       render: r => <span className="text-gray-100">{r.title}</span> },
        { label: 'طرف قرارداد', render: r => <span className="text-gray-400 text-xs">{r.counterparty || '—'}</span> },
        { label: 'تاریخ پایان', render: r => {
          const tag = contractExpiryTag(r);
          return r.end_date
            ? <span className={tag === 'expired' ? 'text-red-400 text-xs font-medium' : tag === 'expiring' ? 'text-amber-400 text-xs' : 'text-gray-400 text-xs'}>{r.end_date}{tag && ' ⚠'}</span>
            : <span className="text-gray-600 text-xs">—</span>;
        }},
        { label: 'وضعیت',      render: r => <StatusPill status={r.status} /> },
      ],
      rowClass: r => {
        const tag = contractExpiryTag(r);
        if (tag === 'expired')  return 'bg-red-950/40 hover:bg-red-950/60';
        if (tag === 'expiring') return 'bg-amber-950/30 hover:bg-amber-950/50';
        return 'hover:bg-gray-800/40';
      },
      onRowClick: () => navigate('/contracts'),
    },
  };

  const cfg = configs[type];
  if (!cfg) return null;

  return (
    <div className="mb-8 bg-gray-900 border border-indigo-700/40 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200">
          {cfg.title}
          <span className="mr-2 text-gray-500 font-normal">({cfg.data.length} مورد)</span>
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
      </div>

      {cfg.data.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-500 text-sm">موردی ثبت نشده است</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {cfg.columns.map(col => (
                  <th key={col.label} className="px-5 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfg.data.map(row => (
                <tr
                  key={row.id}
                  onClick={() => cfg.onRowClick(row)}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors ${cfg.rowClass ? cfg.rowClass(row) : 'hover:bg-gray-800/40'}`}
                >
                  {cfg.columns.map((col, i) => (
                    <td key={i} className="px-5 py-3 whitespace-nowrap">{col.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ sections, allProjects, allTasks, allPurchases, allTenders, allContracts, deadlineChanges, navigate }) {
  const [drilldown, setDrilldown] = useState(null);
  const [showDeadlineChanges, setShowDeadlineChanges] = useState(false);
  const [showContractExpiry, setShowContractExpiry] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const toggle = (type) => setDrilldown(prev => prev === type ? null : type);

  const statCards = [
    { type: 'projects',   label: 'کل پروژه‌ها', value: allProjects.length,  icon: '📋', color: 'indigo' },
    { type: 'tasks',      label: 'وظایف جاری',   value: allTasks.length,     icon: '🗂️', color: 'blue' },
    { type: 'purchases',  label: 'خریدها',        value: allPurchases.length, icon: '🛒', color: 'amber' },
    { type: 'tenders',    label: 'مناقصات',       value: allTenders.length,   icon: '⚖️', color: 'gray' },
    { type: 'contracts',  label: 'قراردادها',     value: allContracts.length, icon: '📄', color: 'emerald' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map(({ type, label, value, icon, color }) => (
          <button
            key={type}
            onClick={() => toggle(type)}
            className={`rounded-2xl transition-all text-right ${drilldown === type ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-gray-600'}`}
          >
            <StatCard label={label} value={value} icon={icon} color={color} />
          </button>
        ))}
      </div>

      {drilldown && (
        <DrilldownPanel
          type={drilldown}
          allProjects={allProjects}
          allTasks={allTasks}
          allPurchases={allPurchases}
          allTenders={allTenders}
          allContracts={allContracts}
          sections={sections}
          navigate={navigate}
          onClose={() => setDrilldown(null)}
        />
      )}

      {(() => {
        const expiredList  = allContracts.filter(c => contractExpiryTag(c) === 'expired');
        const expiringList = allContracts.filter(c => contractExpiryTag(c) === 'expiring');
        if (!expiredList.length && !expiringList.length) return null;
        const alertContracts = [...expiredList, ...expiringList];
        return (
          <div className="mb-6 bg-amber-900/20 border border-amber-600/30 rounded-2xl overflow-hidden">
            <div className="flex items-start gap-3 px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-200">هشدار انقضای قرارداد</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  {expiredList.length > 0 && <span>{expiredList.length} قرارداد منقضی شده</span>}
                  {expiredList.length > 0 && expiringList.length > 0 && ' — '}
                  {expiringList.length > 0 && <span>{expiringList.length} قرارداد در ۶۰ روز آینده منقضی می‌شود</span>}
                </p>
              </div>
              <button
                onClick={() => setShowContractExpiry(v => !v)}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors shrink-0 mt-0.5"
              >
                {showContractExpiry ? 'بستن' : 'مشاهده'}
              </button>
            </div>
            {showContractExpiry && (
              <div className="border-t border-amber-800/40 overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-amber-800/30">
                      <th className="px-5 py-2.5 text-xs font-medium text-amber-400/70">عنوان</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-amber-400/70">طرف قرارداد</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-amber-400/70">تاریخ پایان</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-amber-400/70">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertContracts.map(c => {
                      const tag = contractExpiryTag(c);
                      return (
                        <tr key={c.id} className="border-b border-amber-800/20 last:border-0">
                          <td className="px-5 py-2.5 text-gray-200">{c.title}</td>
                          <td className="px-5 py-2.5 text-gray-400 text-xs">{c.counterparty || '—'}</td>
                          <td className={`px-5 py-2.5 text-xs font-medium ${tag === 'expired' ? 'text-red-400' : 'text-amber-300'}`}>
                            {c.end_date} ⚠
                          </td>
                          <td className="px-5 py-2.5 text-xs">
                            <span className={tag === 'expired' ? 'text-red-400' : 'text-amber-300'}>
                              {tag === 'expired' ? 'منقضی شده' : 'در حال انقضا'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {deadlineChanges.length > 0 && (
        <div className="mb-6 bg-blue-900/20 border border-blue-600/30 rounded-2xl overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4">
            <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-200">تغییر مهلت پروژه‌ها</p>
              <p className="text-xs text-blue-300/70 mt-0.5">
                {deadlineChanges.length} مورد در ۳۰ روز گذشته تغییر کرده است
              </p>
            </div>
            <button
              onClick={() => setShowDeadlineChanges(v => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 mt-0.5"
            >
              {showDeadlineChanges ? 'بستن' : 'مشاهده'}
            </button>
          </div>
          {showDeadlineChanges && (
            <div className="border-t border-blue-800/40 overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-blue-800/30">
                    <th className="px-5 py-2.5 text-xs font-medium text-blue-400/70">پروژه</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-blue-400/70">مهلت قبلی</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-blue-400/70">مهلت جدید</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-blue-400/70">تغییر داده شده توسط</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlineChanges.map((row, i) => (
                    <tr key={i} className="border-b border-blue-800/20 last:border-0">
                      <td className="px-5 py-2.5 text-gray-200">{row.project_title}</td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">
                        {row.old_due_date ? toPersianDate(row.old_due_date) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-blue-300 text-xs font-medium">
                        {row.new_due_date ? toPersianDate(row.new_due_date) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 text-xs">{row.changed_by ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">بخش‌ها</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.map(s => {
          const sp = allProjects.filter(p => p.section_id === s.id);
          const st = allTasks.filter(t => t.section_id === s.id);
          const overdueCount = sp.filter(p => p.due_date && p.status !== 'completed' && p.due_date < today).length;
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/section/${s.id}`)}
              className="bg-gray-900 border border-gray-800 hover:border-indigo-700/60 rounded-2xl p-5 text-right transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-gray-100 leading-snug">{s.name}</h3>
                <ChevronLeft className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">پروژه‌ها</span>
                  <span className="text-xs text-gray-600">{sp.length} مورد</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {PROJECT_STATUS_ROWS.map(({ key, label, valueClass }) => (
                    <div key={key} className="bg-gray-800/70 rounded-lg py-2 px-1 text-center">
                      <p className={`text-base font-bold ${valueClass}`}>
                        {sp.filter(p => p.status === key).length}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
                {sp.length > 0 && (
                  <div className="mt-2">
                    <ProgressBar value={Math.round(sp.reduce((s, p) => s + (p.progress ?? 0), 0) / sp.length)} />
                  </div>
                )}
                {overdueCount > 0 && (
                  <p className="text-xs text-red-400 mt-1.5 font-medium">{overdueCount} پروژه از مهلت گذشته</p>
                )}
              </div>

              <div className="border-t border-gray-800 my-3" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">وظایف جاری</span>
                  <span className="text-xs text-gray-600">{st.length} مورد</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {TASK_STATUS_ROWS.map(({ key, label, valueClass }) => (
                    <div key={key} className="bg-gray-800/70 rounded-lg py-2 px-1 text-center">
                      <p className={`text-base font-bold ${valueClass}`}>
                        {st.filter(t => t.status === key).length}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-600';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5 min-w-12">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-7 text-left shrink-0">{pct}%</span>
    </div>
  );
}

function ProjectsTab({ sections, allProjects }) {
  const notStarted = allProjects.filter(p => p.status === 'not_started').length;
  const inProgress  = allProjects.filter(p => p.status === 'in_progress').length;
  const onHold      = allProjects.filter(p => p.status === 'on_hold').length;
  const completed   = allProjects.filter(p => p.status === 'completed').length;

  const pieData = [
    { name: 'شروع نشده',    value: notStarted, key: 'not_started' },
    { name: 'در حال انجام', value: inProgress,  key: 'in_progress' },
    { name: 'متوقف',        value: onHold,      key: 'on_hold' },
    { name: 'تکمیل شده',   value: completed,   key: 'completed' },
  ].filter(d => d.value > 0);

  const barData = sections.map(s => {
    const sp = allProjects.filter(p => p.section_id === s.id);
    return {
      name: s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name,
      'شروع نشده':    sp.filter(p => p.status === 'not_started').length,
      'در حال انجام': sp.filter(p => p.status === 'in_progress').length,
      'متوقف':         sp.filter(p => p.status === 'on_hold').length,
      'تکمیل شده':   sp.filter(p => p.status === 'completed').length,
    };
  });

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="شروع نشده"    value={notStarted} icon="⏳" color="gray" />
        <StatCard label="در حال انجام" value={inProgress}  icon="🔄" color="blue" />
        <StatCard label="متوقف"        value={onHold}      icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده"   value={completed}   icon="✅" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">توزیع وضعیت پروژه‌ها</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map(entry => (
                  <Cell key={entry.key} fill={PROJECT_STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [v + ' پروژه', n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map(d => (
              <div key={d.key} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PROJECT_STATUS_COLORS[d.key] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">پروژه‌ها به تفکیک بخش</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#9ca3af', direction: 'rtl' }} />
              <Bar dataKey="در حال انجام" stackId="a" fill="#3b82f6" />
              <Bar dataKey="متوقف"         stackId="a" fill="#f59e0b" />
              <Bar dataKey="تکمیل شده"    stackId="a" fill="#10b981" />
              <Bar dataKey="شروع نشده"    stackId="a" fill="#4b5563" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function TasksTab({ sections, allTasks }) {
  const pending    = allTasks.filter(t => t.status === 'pending').length;
  const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
  const onHold     = allTasks.filter(t => t.status === 'on_hold').length;
  const completed  = allTasks.filter(t => t.status === 'completed').length;

  const pieData = [
    { name: 'شروع نشده',    value: pending,    key: 'pending' },
    { name: 'در حال انجام', value: inProgress,  key: 'in_progress' },
    { name: 'متوقف',        value: onHold,      key: 'on_hold' },
    { name: 'تکمیل شده',   value: completed,   key: 'completed' },
  ].filter(d => d.value > 0);

  const barData = sections.map(s => {
    const st = allTasks.filter(t => t.section_id === s.id);
    return {
      name: s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name,
      'شروع نشده':    st.filter(t => t.status === 'pending').length,
      'در حال انجام': st.filter(t => t.status === 'in_progress').length,
      'متوقف':         st.filter(t => t.status === 'on_hold').length,
      'تکمیل شده':   st.filter(t => t.status === 'completed').length,
    };
  });

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="شروع نشده"    value={pending}    icon="⏳" color="gray" />
        <StatCard label="در حال انجام" value={inProgress}  icon="🔄" color="blue" />
        <StatCard label="متوقف"        value={onHold}      icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده"   value={completed}   icon="✅" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">توزیع وضعیت وظایف جاری</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map(entry => (
                  <Cell key={entry.key} fill={TASK_STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [v + ' وظیفه', n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map(d => (
              <div key={d.key} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TASK_STATUS_COLORS[d.key] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">وظایف به تفکیک بخش</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#9ca3af', direction: 'rtl' }} />
              <Bar dataKey="در حال انجام" stackId="a" fill="#3b82f6" />
              <Bar dataKey="متوقف"         stackId="a" fill="#f59e0b" />
              <Bar dataKey="تکمیل شده"    stackId="a" fill="#10b981" />
              <Bar dataKey="شروع نشده"    stackId="a" fill="#4b5563" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function RegistriesTab({ allPurchases, allTenders, allContracts, navigate }) {
  const purchaseStatuses = [
    { key: 'pending',   label: 'در انتظار',        color: 'text-amber-400' },
    { key: 'approved',  label: 'تأیید شده',         color: 'text-blue-400' },
    { key: 'purchased', label: 'خریداری شده',       color: 'text-indigo-400' },
    { key: 'delivered', label: 'تحویل شده',         color: 'text-emerald-400' },
    { key: 'cancelled', label: 'لغو شده',           color: 'text-red-400' },
  ];

  const tenderStatuses = [
    { key: 'open',       label: 'در حال برگزاری',   color: 'text-blue-400' },
    { key: 'evaluating', label: 'در حال ارزیابی',   color: 'text-indigo-400' },
    { key: 'awarded',    label: 'برنده اعلام شده',  color: 'text-emerald-400' },
    { key: 'completed',  label: 'تکمیل شده',        color: 'text-gray-300' },
    { key: 'cancelled',  label: 'لغو شده',          color: 'text-red-400' },
  ];

  const contractStatuses = [
    { key: 'active',    label: 'فعال',              color: 'text-emerald-400' },
    { key: 'renewed',   label: 'تمدید شده',         color: 'text-blue-400' },
    { key: 'expired',   label: 'خاتمه یافته',       color: 'text-gray-400' },
    { key: 'cancelled', label: 'لغو شده',           color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <RegistryCard
        icon={<ShoppingCart className="w-4 h-4 text-indigo-400" />}
        title="خریدها"
        total={allPurchases.length}
        statuses={purchaseStatuses}
        data={allPurchases}
        onNavigate={() => navigate('/purchases')}
      />
      <RegistryCard
        icon={<Gavel className="w-4 h-4 text-indigo-400" />}
        title="مناقصات"
        total={allTenders.length}
        statuses={tenderStatuses}
        data={allTenders}
        onNavigate={() => navigate('/tenders')}
      />
      <RegistryCard
        icon={<FileSignature className="w-4 h-4 text-indigo-400" />}
        title="قراردادها"
        total={allContracts.length}
        statuses={contractStatuses}
        data={allContracts}
        onNavigate={() => navigate('/contracts')}
      />
    </div>
  );
}

function RegistryCard({ icon, title, total, statuses, data, onNavigate }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-900/40 border border-indigo-800/40 rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500">{total} مورد</p>
          </div>
        </div>
        <button
          onClick={onNavigate}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          مشاهده همه
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {statuses.map(({ key, label, color }) => {
          const count = data.filter(r => r.status === key).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-400">{label}</span>
                <span className={`text-sm font-semibold ${color}`}>{count}</span>
              </div>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500/50 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
