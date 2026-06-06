import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge, { STATUS_OPTIONS } from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { projects as projectsApi, personnel as personnelApi, customColumns as colsApi } from '../api';
import { useSections } from '../context/SectionsContext';
import { Plus, Trash2, PencilLine, Users, FolderKanban, Columns, Check, X } from 'lucide-react';

export default function SectionDashboard() {
  return (
    <Routes>
      <Route index element={<ProjectsTab />} />
      <Route path="personnel" element={<PersonnelTab />} />
    </Routes>
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

  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [addColLoading, setAddColLoading] = useState(false);

  const [addRowLoading, setAddRowLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, perRes, colRes] = await Promise.all([
        projectsApi.list(sectionId),
        personnelApi.list(sectionId),
        colsApi.list(sectionId),
      ]);
      setProjects(pRes.data);
      setPersonnel(perRes.data);
      setColumns(colRes.data);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = {
    total: projects.length,
    in_progress: projects.filter(p => p.status === 'in_progress').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    const cvMap = {};
    project.custom_values?.forEach(cv => { cvMap[cv.column_id] = cv.value; });
    setEditRow({
      title: project.title,
      responsible_id: project.responsible_id ?? '',
      status: project.status,
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
      responsible_id: editRow.responsible_id || null,
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

  const deleteProject = async () => {
    setDeleteLoading(true);
    try {
      await projectsApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleteLoading(false);
    }
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
        subtitle={`${stats.total} پروژه`}
        action={canEdit && (
          <div className="flex gap-2">
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
          </div>
        )}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="کل پروژه‌ها" value={stats.total} icon="📋" color="indigo" />
        <StatCard label="در حال انجام" value={stats.in_progress} icon="🔄" color="blue" />
        <StatCard label="متوقف" value={stats.on_hold} icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده" value={stats.completed} icon="✅" color="emerald" />
      </div>

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
                {canEdit && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, idx) => (
                <tr key={p.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group">
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
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.responsible_id}
                          onChange={e => setEditRow(r => ({ ...r, responsible_id: e.target.value }))}
                        >
                          <option value="">— انتخاب کنید —</option>
                          {personnel.map(per => (
                            <option key={per.id} value={per.id}>{per.name}</option>
                          ))}
                        </select>
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
                      <td className="px-4 py-3 text-gray-300">{p.responsible?.name || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
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
                            <button onClick={() => startEdit(p)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={7 + columns.length} className="px-4 py-12 text-center text-gray-600">
                    هیچ پروژه‌ای ثبت نشده است
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
        message="آیا از حذف این پروژه اطمینان دارید؟ این عملیات قابل بازگشت نیست."
      />
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
