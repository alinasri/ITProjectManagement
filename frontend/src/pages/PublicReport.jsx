import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { report as reportApi } from '../api';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import {
  ChevronDown, ChevronUp, Printer, Monitor,
  FolderKanban, ListChecks, ShoppingCart, Gavel, FileSignature, AlertTriangle,
} from 'lucide-react';

// ── Status helpers ─────────────────────────────────────────────────────────────

const S_LABEL = {
  not_started: 'شروع نشده', pending: 'شروع نشده', in_progress: 'در جریان',
  on_hold: 'متوقف', completed: 'تکمیل شده', approved: 'تأیید شده',
  purchased: 'خریداری شده', delivered: 'تحویل شده', open: 'در حال برگزاری',
  evaluating: 'در حال ارزیابی', awarded: 'برنده اعلام شده',
  active: 'فعال', renewed: 'تمدید شده', expired: 'خاتمه یافته', cancelled: 'لغو شده',
};

const S_COLOR = {
  not_started: 'bg-gray-700/60 text-gray-300',
  pending:     'bg-gray-700/60 text-gray-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  on_hold:     'bg-amber-900/60 text-amber-300',
  completed:   'bg-emerald-900/60 text-emerald-300',
  approved:    'bg-blue-900/60 text-blue-300',
  purchased:   'bg-indigo-900/60 text-indigo-300',
  delivered:   'bg-emerald-900/60 text-emerald-300',
  open:        'bg-blue-900/60 text-blue-300',
  evaluating:  'bg-indigo-900/60 text-indigo-300',
  awarded:     'bg-emerald-900/60 text-emerald-300',
  active:      'bg-emerald-900/60 text-emerald-300',
  renewed:     'bg-blue-900/60 text-blue-300',
  expired:     'bg-gray-700/60 text-gray-400',
  cancelled:   'bg-red-900/60 text-red-300',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${S_COLOR[status] ?? 'bg-gray-700/60 text-gray-300'}`}>
      {S_LABEL[status] ?? status}
    </span>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────

function Section({ title, icon, count, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-right print:cursor-default"
      >
        <div className="flex items-center gap-3">
          <div className="text-indigo-400">{icon}</div>
          <span className="text-base font-bold text-gray-100">{title}</span>
          {count != null && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{count} مورد</span>
          )}
          {badge}
        </div>
        <span className="text-gray-500 print:hidden">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="border-t border-gray-800">{children}</div>}
    </div>
  );
}

// ── Projects section ───────────────────────────────────────────────────────────

function ProjectsSection({ projects, sections }) {
  const [openSections, setOpenSections] = useState({});
  const toggle = id => setOpenSections(p => ({ ...p, [id]: !p[id] }));

  const completionPct = projects.length
    ? Math.round(projects.filter(p => p.status === 'completed').length / projects.length * 100) : 0;

  return (
    <Section
      title="پروژه‌ها"
      icon={<FolderKanban className="w-5 h-5" />}
      count={projects.length}
      badge={<span className="text-xs text-emerald-400 font-medium">{completionPct}٪ تکمیل شده</span>}
    >
      {/* Status summary bar */}
      <div className="grid grid-cols-4 divide-x divide-x-reverse divide-gray-800 border-b border-gray-800">
        {[
          { key: 'not_started', label: 'شروع نشده', color: 'text-gray-300' },
          { key: 'in_progress', label: 'در جریان',  color: 'text-blue-400' },
          { key: 'on_hold',     label: 'متوقف',     color: 'text-amber-400' },
          { key: 'completed',   label: 'تکمیل شده', color: 'text-emerald-400' },
        ].map(({ key, label, color }) => (
          <div key={key} className="text-center py-5">
            <p className={`text-3xl font-black ${color}`}>{projects.filter(p => p.status === key).length}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-section drill-down */}
      <div className="divide-y divide-gray-800/60">
        {sections.map(s => {
          const sp = projects.filter(p => p.section_id === s.id);
          if (sp.length === 0) return null;
          const isOpen = openSections[s.id];
          return (
            <div key={s.id}>
              <button
                onClick={() => toggle(s.id)}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-gray-800/40 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                  <span className="text-sm font-semibold text-gray-200">{s.name}</span>
                  <span className="text-xs text-gray-500">{sp.length} پروژه</span>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {['not_started','in_progress','on_hold','completed'].map(k => {
                    const c = sp.filter(p => p.status === k).length;
                    return c > 0 ? <StatusPill key={k} status={k} /> : null;
                  })}
                </div>
              </button>
              {isOpen && (
                <div className="bg-gray-950/60 border-t border-gray-800/50">
                  <table className="w-full text-right text-sm">
                    <tbody className="divide-y divide-gray-800/30">
                      {sp.map(p => (
                        <tr key={p.id} className="hover:bg-gray-800/20">
                          <td className="px-10 py-3 text-gray-300">{p.title}</td>
                          <td className="px-6 py-3 w-36"><StatusPill status={p.status} /></td>
                          <td className="px-6 py-3 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${(p.progress ?? 0) === 100 ? 'bg-emerald-500' : (p.progress ?? 0) >= 50 ? 'bg-indigo-500' : (p.progress ?? 0) > 0 ? 'bg-blue-500' : 'bg-gray-600'}`}
                                  style={{ width: `${p.progress ?? 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-7 text-left shrink-0">{p.progress ?? 0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {sections.every(s => projects.filter(p => p.section_id === s.id).length === 0) && (
          <p className="px-6 py-6 text-sm text-gray-600 text-center">پروژه‌ای ثبت نشده است</p>
        )}
      </div>
    </Section>
  );
}

// ── Tasks section ──────────────────────────────────────────────────────────────

function TasksSection({ tasks, sections }) {
  const [openSections, setOpenSections] = useState({});
  const toggle = id => setOpenSections(p => ({ ...p, [id]: !p[id] }));

  return (
    <Section
      title="وظایف جاری"
      icon={<ListChecks className="w-5 h-5" />}
      count={tasks.length}
    >
      <div className="grid grid-cols-4 divide-x divide-x-reverse divide-gray-800 border-b border-gray-800">
        {[
          { key: 'pending',     label: 'شروع نشده', color: 'text-gray-300' },
          { key: 'in_progress', label: 'در جریان',  color: 'text-blue-400' },
          { key: 'on_hold',     label: 'متوقف',     color: 'text-amber-400' },
          { key: 'completed',   label: 'تکمیل شده', color: 'text-emerald-400' },
        ].map(({ key, label, color }) => (
          <div key={key} className="text-center py-5">
            <p className={`text-3xl font-black ${color}`}>{tasks.filter(t => t.status === key).length}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-gray-800/60">
        {sections.map(s => {
          const st = tasks.filter(t => t.section_id === s.id);
          if (st.length === 0) return null;
          const isOpen = openSections[s.id];
          return (
            <div key={s.id}>
              <button
                onClick={() => toggle(s.id)}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-gray-800/40 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                  <span className="text-sm font-semibold text-gray-200">{s.name}</span>
                  <span className="text-xs text-gray-500">{st.length} وظیفه</span>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {['pending','in_progress','on_hold','completed'].map(k => {
                    const c = st.filter(t => t.status === k).length;
                    return c > 0 ? <StatusPill key={k} status={k} /> : null;
                  })}
                </div>
              </button>
              {isOpen && (
                <div className="bg-gray-950/60 border-t border-gray-800/50">
                  <table className="w-full text-right text-sm">
                    <tbody className="divide-y divide-gray-800/30">
                      {st.map(t => (
                        <tr key={t.id} className="hover:bg-gray-800/20">
                          <td className="px-10 py-3 text-gray-300">{t.title}</td>
                          <td className="px-6 py-3 text-left w-36"><StatusPill status={t.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {sections.every(s => tasks.filter(t => t.section_id === s.id).length === 0) && (
          <p className="px-6 py-6 text-sm text-gray-600 text-center">وظیفه‌ای ثبت نشده است</p>
        )}
      </div>
    </Section>
  );
}

// ── Registry card ──────────────────────────────────────────────────────────────

function RegistryCard({ icon, title, data, statuses }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700/50 flex items-center gap-3">
        <div className="text-indigo-400">{icon}</div>
        <span className="font-bold text-gray-100">{title}</span>
        <span className="text-xs bg-gray-700/60 text-gray-400 px-2 py-0.5 rounded-full mr-auto">{data.length} مورد</span>
      </div>
      <div className="p-4 space-y-2.5">
        {statuses.map(({ key, label, color }) => {
          const count = data.filter(r => r.status === key).length;
          const pct = data.length ? Math.round(count / data.length * 100) : 0;
          return (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{count}</span>
              </div>
              <div className="h-1 bg-gray-700/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }} />
              </div>
            </div>
          );
        })}
      </div>
      {data.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-5 py-2.5 border-t border-gray-700/50 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-2 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'بستن' : 'مشاهده همه'}
          </button>
          {expanded && (
            <div className="border-t border-gray-700/50 max-h-56 overflow-y-auto">
              {data.map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/30 last:border-0 hover:bg-gray-700/20">
                  <span className="text-xs text-gray-300 truncate flex-1 ml-3">{r.title}</span>
                  <StatusPill status={r.status} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function PublicReport() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    reportApi.getPublic(token)
      .then(r => setData(r.data))
      .catch(() => setError(true));
  }, [token]);

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <p className="text-6xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-gray-300 mb-2">دسترسی ممکن نیست</h2>
        <p className="text-gray-500 text-sm">لینک نامعتبر یا منقضی شده است</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { sections, projects, tasks, purchases, tenders, contracts, generated_at } = data;

  const persianDate = new DateObject({ date: new Date(generated_at), calendar: persian, locale: persian_fa });
  const persianMonth = persianDate.format('MMMM YYYY');
  const persianFull  = persianDate.format('DD MMMM YYYY');

  const completionPct = projects.length
    ? Math.round(projects.filter(p => p.status === 'completed').length / projects.length * 100) : 0;
  const blockedCount  = projects.filter(p => p.status === 'on_hold').length
                      + tasks.filter(t => t.status === 'on_hold').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" dir="rtl">

      {/* ── Gradient header ──────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 25%,#1e1b4b 60%,#0f172a 100%)' }}
      >
        {/* Soft radial glows */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 15% 50%,rgba(99,102,241,.18) 0%,transparent 55%), radial-gradient(ellipse at 85% 10%,rgba(129,140,248,.12) 0%,transparent 45%)' }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-10">
          {/* Bar: logo + print */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Monitor className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-300 leading-tight">واحد فناوری اطلاعات</p>
                <p className="text-xs text-indigo-400/60 leading-tight">مدیریت اکتشاف نفت</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="print:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white transition-colors backdrop-blur"
            >
              <Printer className="w-4 h-4" />
              چاپ گزارش
            </button>
          </div>

          {/* Title block */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
              گزارش عملکرد ماهانه
            </h1>
            <p className="text-2xl font-bold text-indigo-300">{persianMonth}</p>
            <p className="text-xs text-indigo-400/50 mt-2">تاریخ تولید: {persianFull}</p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                icon: '📋', label: 'پروژه‌ها',    value: projects.length,
                sub: `${completionPct}٪ تکمیل`, color: 'text-indigo-300',
              },
              {
                icon: '🗂️', label: 'وظایف جاری',  value: tasks.length,
                sub: `${tasks.filter(t => t.status === 'in_progress').length} در جریان`, color: 'text-blue-300',
              },
              {
                icon: '🛒', label: 'خریدها',       value: purchases.length,
                sub: `${purchases.filter(p => p.status === 'pending').length} در انتظار`, color: 'text-amber-300',
              },
              {
                icon: '⚖️', label: 'مناقصات',      value: tenders.length,
                sub: `${tenders.filter(t => t.status === 'open').length} باز`, color: 'text-purple-300',
              },
              {
                icon: '📄', label: 'قراردادها',    value: contracts.length,
                sub: `${contracts.filter(c => c.status === 'active').length} فعال`, color: 'text-emerald-300',
              },
            ].map(kpi => (
              <div key={kpi.label}
                className="rounded-2xl border border-white/10 bg-white/8 backdrop-blur text-center px-3 py-4"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div className="text-2xl mb-2">{kpi.icon}</div>
                <p className={`text-4xl font-black leading-none ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-white/70 mt-2 font-medium">{kpi.label}</p>
                <p className="text-xs text-white/35 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* Attention banner */}
        {blockedCount > 0 && (
          <div className="flex items-start gap-3 px-5 py-4 bg-amber-900/25 border border-amber-600/30 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                {blockedCount} مورد نیازمند توجه فوری
              </p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                {projects.filter(p => p.status === 'on_hold').length} پروژه و{' '}
                {tasks.filter(t => t.status === 'on_hold').length} وظیفه جاری در حالت متوقف قرار دارند
              </p>
            </div>
          </div>
        )}

        <ProjectsSection projects={projects} sections={sections} />

        <TasksSection tasks={tasks} sections={sections} />

        {/* Registries */}
        <Section
          title="خریدها، قراردادها و مناقصات"
          icon={<FileSignature className="w-5 h-5" />}
          count={purchases.length + tenders.length + contracts.length}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <RegistryCard
              icon={<ShoppingCart className="w-4 h-4" />}
              title="خریدها"
              data={purchases}
              statuses={[
                { key: 'pending',   label: 'در انتظار',       color: 'text-amber-400' },
                { key: 'approved',  label: 'تأیید شده',        color: 'text-blue-400' },
                { key: 'purchased', label: 'خریداری شده',      color: 'text-indigo-400' },
                { key: 'delivered', label: 'تحویل شده',        color: 'text-emerald-400' },
                { key: 'cancelled', label: 'لغو شده',          color: 'text-red-400' },
              ]}
            />
            <RegistryCard
              icon={<Gavel className="w-4 h-4" />}
              title="مناقصات"
              data={tenders}
              statuses={[
                { key: 'open',       label: 'در حال برگزاری',  color: 'text-blue-400' },
                { key: 'evaluating', label: 'در حال ارزیابی',  color: 'text-indigo-400' },
                { key: 'awarded',    label: 'برنده اعلام شده', color: 'text-emerald-400' },
                { key: 'completed',  label: 'تکمیل شده',       color: 'text-gray-300' },
                { key: 'cancelled',  label: 'لغو شده',         color: 'text-red-400' },
              ]}
            />
            <RegistryCard
              icon={<FileSignature className="w-4 h-4" />}
              title="قراردادها"
              data={contracts}
              statuses={[
                { key: 'active',    label: 'فعال',             color: 'text-emerald-400' },
                { key: 'renewed',   label: 'تمدید شده',        color: 'text-blue-400' },
                { key: 'expired',   label: 'خاتمه یافته',      color: 'text-gray-400' },
                { key: 'cancelled', label: 'لغو شده',          color: 'text-red-400' },
              ]}
            />
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-800 mt-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-500">واحد فناوری اطلاعات — مدیریت اکتشاف نفت</span>
          </div>
          <p className="text-xs text-gray-700">
            این گزارش به صورت خودکار تولید شده و فقط شامل موارد آرشیو‌نشده می‌باشد
          </p>
        </div>
      </div>
    </div>
  );
}
