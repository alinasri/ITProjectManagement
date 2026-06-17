import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge, { STATUS_OPTIONS, STATUS_CONFIG as PROJECT_STATUS_CONFIG } from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FilterBar from '../components/FilterBar';
import MultiSelect from '../components/MultiSelect';
import StatusHistoryTimeline from '../components/StatusHistoryTimeline';
import { projects as projectsApi, personnel as personnelApi, customColumns as colsApi, ongoingTasks as ongoingTasksApi, contracts as contractsApi, purchases as purchasesApi, tenders as tendersApi } from '../api';
import { useSections } from '../context/SectionsContext';
import { Plus, Trash2, PencilLine, Users, FolderKanban, Columns, Check, X, ListChecks, Archive, History, Building2, FileSignature, ShoppingCart, Gavel, AlertTriangle } from 'lucide-react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';
import PersianDatePicker from '../components/PersianDatePicker';

function toPersianDate(isoStr) {
  if (!isoStr) return null;
  return new DateObject(new Date(isoStr + 'T00:00:00')).convert(persian, persian_fa).format('D MMMM YYYY');
}

function isoToPersianPicker(isoStr) {
  if (!isoStr) return '';
  const d = new DateObject(new Date(isoStr + 'T00:00:00')).convert(persian);
  return `${d.year}/${String(d.month.number).padStart(2,'0')}/${String(d.day).padStart(2,'0')}`;
}

function persianPickerToISO(persianStr) {
  if (!persianStr) return '';
  const [y, m, d] = persianStr.split('/').map(Number);
  return new DateObject({ year: y, month: m, day: d, calendar: persian }).convert(gregorian).format('YYYY-MM-DD');
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

const CONTRACT_STATUS = {
  active:    { label: 'فعال',          cls: 'bg-emerald-900/60 text-emerald-300' },
  renewed:   { label: 'تمدید شده',     cls: 'bg-blue-900/60 text-blue-300' },
  expired:   { label: 'خاتمه یافته',   cls: 'bg-gray-700/60 text-gray-300' },
  cancelled: { label: 'لغو شده',       cls: 'bg-red-900/60 text-red-300' },
};
const PURCHASE_STATUS = {
  pending:   { label: 'در انتظار',     cls: 'bg-amber-900/60 text-amber-300' },
  approved:  { label: 'تأیید شده',     cls: 'bg-blue-900/60 text-blue-300' },
  purchased: { label: 'خریداری شده',   cls: 'bg-indigo-900/60 text-indigo-300' },
  delivered: { label: 'تحویل شده',     cls: 'bg-emerald-900/60 text-emerald-300' },
  cancelled: { label: 'لغو شده',       cls: 'bg-red-900/60 text-red-300' },
};
const TENDER_STATUS = {
  open:       { label: 'در حال برگزاری',  cls: 'bg-blue-900/60 text-blue-300' },
  evaluating: { label: 'در حال ارزیابی',  cls: 'bg-indigo-900/60 text-indigo-300' },
  awarded:    { label: 'برنده اعلام شده', cls: 'bg-emerald-900/60 text-emerald-300' },
  completed:  { label: 'تکمیل شده',       cls: 'bg-gray-700/60 text-gray-300' },
  cancelled:  { label: 'لغو شده',         cls: 'bg-red-900/60 text-red-300' },
};

function RegPill({ status, config }) {
  const s = config[status] ?? { label: status, cls: 'bg-gray-700/60 text-gray-300' };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
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

export default function SectionDashboard() {
  const { sectionId } = useParams();
  return (
    <div>
      <SectionTabs sectionId={sectionId} />
      <Routes>
        <Route index element={<ProjectsTab />} />
        <Route path="personnel" element={<PersonnelTab />} />
        <Route path="ongoing-tasks" element={<OngoingTasksTab />} />
        <Route path="registries" element={<RegistriesTab />} />
      </Routes>
    </div>
  );
}

// ── Section Sub-Tabs ──────────────────────────────────────────────────────────

function SectionTabs({ sectionId }) {
  const base = `/section/${sectionId}`;
  const tabClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
    }`;

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-gray-800">
      <NavLink to={base} end className={tabClass}>
        <FolderKanban className="w-4 h-4" />
        پروژه‌ها
      </NavLink>
      <NavLink to={`${base}/ongoing-tasks`} className={tabClass}>
        <ListChecks className="w-4 h-4" />
        وظایف جاری
      </NavLink>
      <NavLink to={`${base}/personnel`} className={tabClass}>
        <Users className="w-4 h-4" />
        مسئولین
      </NavLink>
      <NavLink to={`${base}/registries`} className={tabClass}>
        <Building2 className="w-4 h-4" />
        قراردادها، خریدها و مناقصات واحد من
      </NavLink>
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

function ProjectsTab() {
  const { sectionId } = useParams();
  const { user } = useAuth();
  const { sections } = useSections();
  const canEdit = user?.role === 'super_admin' || user?.role === 'section_head';

  const section = sections.find(s => String(s.id) === String(sectionId)) || null;
  const [projects, setProjects] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [addColLoading, setAddColLoading] = useState(false);

  const [addRowLoading, setAddRowLoading] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      const params = { section_id: sectionId };
      if (showArchived) params.archived = 1;
      const [pRes, perRes, colRes] = await Promise.all([
        projectsApi.list(params),
        personnelApi.list(sectionId),
        colsApi.list(sectionId),
      ]);
      setProjects(pRes.data);
      setPersonnel(perRes.data);
      setColumns(colRes.data);
    } finally {
      setLoading(false);
    }
  }, [sectionId, showArchived]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!historyTarget) return;
    projectsApi.getHistory(historyTarget).then(r => setHistoryRows(r.data));
  }, [historyTarget]);

  const stats = {
    total: projects.length,
    in_progress: projects.filter(p => p.status === 'in_progress').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  const displayProjects = projects.filter(p => {
    const matchesSearch = !searchTerm || p.title.includes(searchTerm);
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const today = new Date().toISOString().slice(0, 10);

  const startEdit = (project) => {
    setEditingId(project.id);
    const cvMap = {};
    project.custom_values?.forEach(cv => { cvMap[cv.column_id] = cv.value; });
    setEditRow({
      title: project.title,
      responsible_ids: project.responsibles?.map(r => r.id) ?? [],
      status: project.status,
      progress: project.progress ?? 0,
      due_date: project.due_date || '',
      future_plan: project.future_plan,
      problems: project.problems,
      custom_values: cvMap,
    });
  };

  const saveEdit = async (projectId) => {
    const cvArray = Object.entries(editRow.custom_values || {}).map(([column_id, value]) => ({
      column_id: Number(column_id), value,
    }));
    await projectsApi.update(projectId, {
      ...editRow,
      custom_values: cvArray,
    });
    setEditingId(null);
    fetchAll();
  };

  const cancelEdit = () => setEditingId(null);

  const addRow = async () => {
    setAddRowLoading(true);
    try {
      await projectsApi.create({ title: 'پروژه جدید', section_id: sectionId });
      fetchAll();
    } finally {
      setAddRowLoading(false);
    }
  };

  const canDelete = (createdAt) => Date.now() - new Date(createdAt + 'Z').getTime() < 10 * 60 * 1000;

  const deleteProject = async () => {
    setDeleteLoading(true);
    try {
      await projectsApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      if (err.response?.status === 409) {
        setDeleteTarget(null);
        fetchAll();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchive = async (id, archive) => {
    await projectsApi.archive(id, archive);
    fetchAll();
  };

  const addColumn = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    setAddColLoading(true);
    try {
      await colsApi.create({ column_name: newColName.trim(), section_id: sectionId });
      setNewColName('');
      setAddColOpen(false);
      fetchAll();
    } finally {
      setAddColLoading(false);
    }
  };

  const deleteColumn = async (colId) => {
    await colsApi.remove(colId);
    fetchAll();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <PageHeader
        title={section?.name || 'پروژه‌ها'}
        subtitle={`${displayProjects.length} پروژه`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
                showArchived
                  ? 'bg-amber-900/40 border-amber-700 text-amber-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'نمایش فعال‌ها' : 'آرشیو'}
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setAddColOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700"
                >
                  <Columns className="w-4 h-4" />
                  افزودن ستون
                </button>
                <button
                  onClick={addRow}
                  disabled={addRowLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  پروژه جدید
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="کل پروژه‌ها" value={stats.total} icon="📋" color="indigo" />
        <StatCard label="در حال انجام" value={stats.in_progress} icon="🔄" color="blue" />
        <StatCard label="متوقف" value={stats.on_hold} icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده" value={stats.completed} icon="✅" color="emerald" />
      </div>

      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statuses={STATUS_OPTIONS}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-right text-gray-400 font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">عنوان پروژه</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">مسئول اقدام</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">آخرین وضعیت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">پیشرفت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-28">مهلت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">برنامه آتی</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">مشکلات</th>
                {columns.map(col => (
                  <th key={col.id} className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">
                    <div className="flex items-center gap-1">
                      {col.column_name}
                      {canEdit && (
                        <button onClick={() => deleteColumn(col.id)} className="text-gray-600 hover:text-red-400 transition-colors mr-1">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {canEdit && <th className="px-4 py-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {displayProjects.map((p, idx) => {
                const isOverdue = p.due_date && p.status !== 'completed' && p.due_date < today;
                return (
                <tr key={p.id} className={`border-b border-gray-800/60 transition-colors group ${isOverdue ? 'bg-red-950/40 hover:bg-red-950/60' : 'hover:bg-gray-800/30'} ${p.is_archived ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 text-center">{idx + 1}</td>

                  {editingId === p.id ? (
                    <>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-indigo-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                          value={editRow.title}
                          onChange={e => setEditRow(r => ({ ...r, title: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <MultiSelect
                          items={personnel}
                          selectedIds={editRow.responsible_ids}
                          onChange={ids => setEditRow(r => ({ ...r, responsible_ids: ids }))}
                          emptyLabel="شخصی ثبت نشده است"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.status}
                          onChange={e => setEditRow(r => ({ ...r, status: e.target.value }))}
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-32">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            className="flex-1 accent-indigo-500"
                            value={editRow.progress ?? 0}
                            onChange={e => setEditRow(r => ({ ...r, progress: Number(e.target.value) }))}
                          />
                          <span className="text-xs text-gray-300 w-8 shrink-0">{editRow.progress ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 min-w-36">
                        <PersianDatePicker
                          value={isoToPersianPicker(editRow.due_date)}
                          onChange={v => setEditRow(r => ({ ...r, due_date: persianPickerToISO(v) }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.future_plan}
                          onChange={e => setEditRow(r => ({ ...r, future_plan: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.problems}
                          onChange={e => setEditRow(r => ({ ...r, problems: e.target.value }))}
                        />
                      </td>
                      {columns.map(col => (
                        <td key={col.id} className="px-2 py-2">
                          <input
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                            value={editRow.custom_values?.[col.id] ?? ''}
                            onChange={e => setEditRow(r => ({
                              ...r,
                              custom_values: { ...r.custom_values, [col.id]: e.target.value },
                            }))}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(p.id)} className="p-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-200 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-gray-300">{p.responsibles?.length ? p.responsibles.map(r => r.name).join('، ') : <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 min-w-32"><ProgressBar value={p.progress ?? 0} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.due_date
                          ? <span className={isOverdue ? 'text-red-400 text-sm font-medium' : 'text-gray-300 text-sm'}>{toPersianDate(p.due_date)}{isOverdue && <span className="mr-1.5 text-xs">(تأخیر)</span>}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{p.future_plan || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{p.problems || <span className="text-gray-600">—</span>}</td>
                      {columns.map(col => {
                        const cv = p.custom_values?.find(v => v.column_id === col.id);
                        return (
                          <td key={col.id} className="px-4 py-3 text-gray-300">{cv?.value || <span className="text-gray-600">—</span>}</td>
                        );
                      })}
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setHistoryTarget(p.id)}
                              className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                              title="تاریخچه وضعیت"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(p.id, !p.is_archived)}
                              className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-900/30 rounded-lg transition-colors"
                              title={p.is_archived ? 'بازگردانی' : 'آرشیو'}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => startEdit(p)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            {canDelete(p.created_at) && (
                              <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={9 + columns.length} className="px-4 py-12 text-center text-gray-600">
                    {showArchived ? 'هیچ پروژه آرشیوشده‌ای وجود ندارد' : 'هیچ پروژه‌ای ثبت نشده است'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Column Modal */}
      <Modal open={addColOpen} onClose={() => setAddColOpen(false)} title="افزودن ستون جدید" width="max-w-sm">
        <form onSubmit={addColumn} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">نام ستون</label>
            <input
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              placeholder="مثال: تاریخ شروع"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setAddColOpen(false)} className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm">انصراف</button>
            <button type="submit" disabled={addColLoading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">
              {addColLoading ? 'در حال ذخیره...' : 'افزودن'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteProject}
        loading={deleteLoading}
        message="آیا از حذف این پروژه اطمینان دارید؟ حذف تنها در ۱۰ دقیقه اول پس از ایجاد امکان‌پذیر است."
      />

      <Modal
        open={!!historyTarget}
        onClose={() => { setHistoryTarget(null); setHistoryRows([]); }}
        title="تاریخچه وضعیت"
        width="max-w-md"
      >
        <StatusHistoryTimeline history={historyRows} statusConfig={PROJECT_STATUS_CONFIG} />
      </Modal>
    </div>
  );
}

// ── Personnel Tab ─────────────────────────────────────────────────────────────

function PersonnelTab() {
  const { sectionId } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin' || user?.role === 'section_head';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const r = await personnelApi.list(sectionId);
      setList(r.data);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addPerson = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await personnelApi.create({ name: newName.trim(), section_id: sectionId });
      setNewName('');
      fetchAll();
    } finally {
      setAdding(false);
    }
  };

  const deletePerson = async () => {
    setDeleteLoading(true);
    try {
      await personnelApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <PageHeader
        title="مسئولین پروژه‌ها"
        subtitle="اعضای تیم که می‌توانند مسئول پروژه‌ها باشند"
      />

      {canEdit && (
        <form onSubmit={addPerson} className="flex gap-3 mb-6">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 max-w-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="نام مسئول را وارد کنید"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            افزودن
          </button>
        </form>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-12 text-center text-gray-600 flex flex-col items-center gap-2">
            <Users className="w-8 h-8 text-gray-700" />
            <p>هیچ مسئولی تعریف نشده است</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {list.map(person => (
              <li key={person.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/40 group transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-900/50 border border-indigo-800/40 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400">
                    {person.name[0]}
                  </div>
                  <span className="text-gray-200">{person.name}</span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setDeleteTarget(person.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deletePerson}
        loading={deleteLoading}
        message="آیا از حذف این مسئول اطمینان دارید؟"
      />
    </div>
  );
}

// ── Ongoing Tasks Tab ─────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG = {
  pending:     { label: 'در انتظار',    cls: 'bg-gray-700/60 text-gray-300' },
  in_progress: { label: 'در حال انجام', cls: 'bg-blue-900/60 text-blue-300' },
  on_hold:     { label: 'متوقف',        cls: 'bg-amber-900/60 text-amber-300' },
  completed:   { label: 'تکمیل شده',   cls: 'bg-emerald-900/60 text-emerald-300' },
};
const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

function OngoingTasksTab() {
  const { sectionId } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin' || user?.role === 'section_head';

  const [tasks, setTasks] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [addRowLoading, setAddRowLoading] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      const params = { section_id: sectionId };
      if (showArchived) params.archived = 1;
      const [tRes, perRes] = await Promise.all([
        ongoingTasksApi.list(params),
        personnelApi.list(sectionId),
      ]);
      setTasks(tRes.data);
      setPersonnel(perRes.data);
    } finally {
      setLoading(false);
    }
  }, [sectionId, showArchived]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!historyTarget) return;
    ongoingTasksApi.getHistory(historyTarget).then(r => setHistoryRows(r.data));
  }, [historyTarget]);

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditRow({
      title: task.title,
      responsible_ids: task.responsibles?.map(r => r.id) ?? [],
      status: task.status || 'in_progress',
      note: task.note,
    });
  };

  const saveEdit = async (taskId) => {
    await ongoingTasksApi.update(taskId, { ...editRow });
    setEditingId(null);
    fetchAll();
  };

  const cancelEdit = () => setEditingId(null);

  const addRow = async () => {
    setAddRowLoading(true);
    try {
      await ongoingTasksApi.create({ title: 'وظیفه جدید', section_id: sectionId });
      fetchAll();
    } finally {
      setAddRowLoading(false);
    }
  };

  const canDeleteTask = (createdAt) => Date.now() - new Date(createdAt + 'Z').getTime() < 10 * 60 * 1000;

  const deleteTask = async () => {
    setDeleteLoading(true);
    try {
      await ongoingTasksApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      if (err.response?.status === 409) {
        setDeleteTarget(null);
        fetchAll();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchive = async (id, archive) => {
    await ongoingTasksApi.archive(id, archive);
    fetchAll();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="وظایف جاری"
        subtitle={`${tasks.length} وظیفه`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
                showArchived
                  ? 'bg-amber-900/40 border-amber-700 text-amber-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'نمایش فعال‌ها' : 'آرشیو'}
            </button>
            {canEdit && (
              <button
                onClick={addRow}
                disabled={addRowLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                وظیفه جدید
              </button>
            )}
          </div>
        }
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-right text-gray-400 font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">عنوان وظیفه</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">مسئول</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">وضعیت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">یادداشت</th>
                {canEdit && <th className="px-4 py-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, idx) => (
                <tr key={t.id} className={`border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group ${t.is_archived ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 text-center">{idx + 1}</td>

                  {editingId === t.id ? (
                    <>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-indigo-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                          value={editRow.title}
                          onChange={e => setEditRow(r => ({ ...r, title: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <MultiSelect
                          items={personnel}
                          selectedIds={editRow.responsible_ids}
                          onChange={ids => setEditRow(r => ({ ...r, responsible_ids: ids }))}
                          emptyLabel="شخصی ثبت نشده است"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.status}
                          onChange={e => setEditRow(r => ({ ...r, status: e.target.value }))}
                        >
                          {TASK_STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.note}
                          onChange={e => setEditRow(r => ({ ...r, note: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(t.id)} className="p-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-200 font-medium">{t.title}</td>
                      <td className="px-4 py-3 text-gray-300">{t.responsibles?.length ? t.responsibles.map(r => r.name).join('، ') : <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3">
                        {(() => { const s = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.in_progress; return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>; })()}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-md truncate">{t.note || <span className="text-gray-600">—</span>}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setHistoryTarget(t.id)}
                              className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                              title="تاریخچه وضعیت"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(t.id, !t.is_archived)}
                              className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-900/30 rounded-lg transition-colors"
                              title={t.is_archived ? 'بازگردانی' : 'آرشیو'}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => startEdit(t)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            {canDeleteTask(t.created_at) && (
                              <button onClick={() => setDeleteTarget(t.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center text-gray-600">
                    {showArchived ? 'هیچ وظیفه آرشیوشده‌ای وجود ندارد' : 'هیچ وظیفه جاری ثبت نشده است'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTask}
        loading={deleteLoading}
        message="آیا از حذف این وظیفه اطمینان دارید؟ حذف تنها در ۱۰ دقیقه اول پس از ایجاد امکان‌پذیر است."
      />

      <Modal
        open={!!historyTarget}
        onClose={() => { setHistoryTarget(null); setHistoryRows([]); }}
        title="تاریخچه وضعیت"
        width="max-w-md"
      >
        <StatusHistoryTimeline history={historyRows} statusConfig={TASK_STATUS_CONFIG} />
      </Modal>
    </div>
  );
}

// ── Registries Tab ────────────────────────────────────────────────────────────

function RegistriesTab() {
  const { sectionId } = useParams();
  const [contracts, setContracts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = Number(sectionId);
    Promise.all([contractsApi.list(), purchasesApi.list(), tendersApi.list()])
      .then(([cRes, pRes, tRes]) => {
        setContracts(cRes.data.filter(c => c.sections?.some(s => s.id === sid)));
        setPurchases(pRes.data.filter(p => p.sections?.some(s => s.id === sid)));
        setTenders(tRes.data.filter(t => t.sections?.some(s => s.id === sid)));
      })
      .finally(() => setLoading(false));
  }, [sectionId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const expiredContracts  = contracts.filter(c => contractExpiryTag(c) === 'expired');
  const expiringContracts = contracts.filter(c => contractExpiryTag(c) === 'expiring');

  const Section = ({ icon: Icon, title, count, children }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
        <Icon className="w-4 h-4 text-indigo-400" />
        <span className="font-semibold text-gray-200 text-sm">{title}</span>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{count} مورد</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="قراردادها، خریدها و مناقصات واحد من" subtitle="قراردادها، خریدها و مناقصات مرتبط با این بخش" />

      {/* Contracts */}
      <Section icon={FileSignature} title="قراردادها" count={contracts.length}>
        {(expiredContracts.length > 0 || expiringContracts.length > 0) && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-900/20 border-b border-amber-800/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">
              {expiredContracts.length > 0 && <span>{expiredContracts.length} قرارداد منقضی شده</span>}
              {expiredContracts.length > 0 && expiringContracts.length > 0 && ' — '}
              {expiringContracts.length > 0 && <span>{expiringContracts.length} قرارداد در ۶۰ روز آینده منقضی می‌شود</span>}
            </span>
          </div>
        )}
        {contracts.length === 0
          ? <p className="px-5 py-8 text-center text-sm text-gray-600">قراردادی برای این بخش ثبت نشده است</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/30">
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">موضوع قرارداد</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">وضعیت</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">طرف قرارداد</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-28">تاریخ پایان</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => {
                    const tag = contractExpiryTag(c);
                    return (
                      <tr key={c.id} className={`border-b border-gray-800/60 transition-colors ${
                        tag === 'expired'  ? 'bg-red-950/40' :
                        tag === 'expiring' ? 'bg-amber-950/30' : 'hover:bg-gray-800/20'
                      }`}>
                        <td className="px-4 py-3 text-gray-200 font-medium">{c.title}</td>
                        <td className="px-4 py-3"><RegPill status={c.status} config={CONTRACT_STATUS} /></td>
                        <td className="px-4 py-3 text-gray-300">{c.counterparty || <span className="text-gray-600">—</span>}</td>
                        <td className="px-4 py-3">
                          {c.end_date
                            ? <span className={tag === 'expired' ? 'text-red-400 font-medium' : tag === 'expiring' ? 'text-amber-400' : 'text-gray-300'}>{c.end_date}</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{c.amount || <span className="text-gray-600">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Section>

      {/* Purchases */}
      <Section icon={ShoppingCart} title="خریدها" count={purchases.length}>
        {purchases.length === 0
          ? <p className="px-5 py-8 text-center text-sm text-gray-600">خریدی برای این بخش ثبت نشده است</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/30">
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">عنوان</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">وضعیت</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">تأمین‌کننده</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">{p.title}</td>
                      <td className="px-4 py-3"><RegPill status={p.status} config={PURCHASE_STATUS} /></td>
                      <td className="px-4 py-3 text-gray-300">{p.supplier || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{p.amount || <span className="text-gray-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Section>

      {/* Tenders */}
      <Section icon={Gavel} title="مناقصات" count={tenders.length}>
        {tenders.length === 0
          ? <p className="px-5 py-8 text-center text-sm text-gray-600">مناقصه‌ای برای این بخش ثبت نشده است</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/30">
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">عنوان</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">وضعیت</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">مبلغ تخمینی</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-28">مهلت</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">{t.title}</td>
                      <td className="px-4 py-3"><RegPill status={t.status} config={TENDER_STATUS} /></td>
                      <td className="px-4 py-3 text-gray-300">{t.estimated_amount || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{t.deadline || <span className="text-gray-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Section>
    </div>
  );
}
