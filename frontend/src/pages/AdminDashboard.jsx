import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { sections as sectionsApi, users as usersApi, projects as projectsApi } from '../api';
import { useSections } from '../context/SectionsContext';
import PasswordInput from '../components/PasswordInput';
import { Plus, Trash2, PencilLine, Check, X, ChevronLeft } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <Routes>
        <Route index element={<OverviewTab />} />
        <Route path="sections" element={<SectionsTab />} />
        <Route path="users" element={<UsersTab />} />
      </Routes>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { sections } = useSections();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    projectsApi.list()
      .then(r => setProjects(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const total = projects.length;
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const onHold = projects.filter(p => p.status === 'on_hold').length;
  const completed = projects.filter(p => p.status === 'completed').length;

  return (
    <div>
      <PageHeader title="داشبورد مدیر سیستم" subtitle="نمای کلی تمام بخش‌ها و پروژه‌ها" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="کل پروژه‌ها" value={total} icon="📋" color="indigo" />
        <StatCard label="در حال انجام" value={inProgress} icon="🔄" color="blue" />
        <StatCard label="متوقف" value={onHold} icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده" value={completed} icon="✅" color="emerald" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="تعداد بخش‌ها" value={sections.length} icon="🏢" color="gray" />
      </div>

      <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">وضعیت بخش‌ها</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.map(s => {
          const sp = projects.filter(p => p.section_id === s.id);
          const pct = sp.length ? Math.round((sp.filter(p => p.status === 'completed').length / sp.length) * 100) : 0;
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/section/${s.id}`)}
              className="bg-gray-900 border border-gray-800 hover:border-indigo-700/60 rounded-2xl p-5 text-right transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-100 leading-snug">{s.name}</h3>
                <ChevronLeft className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-gray-500 mb-3">{sp.length} پروژه</p>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-600 mt-1.5">{pct}% تکمیل شده</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sections Tab ──────────────────────────────────────────────────────────────

function SectionsTab() {
  const { refresh: refreshSections } = useSections();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetch = useCallback(async () => {
    try { const r = await sectionsApi.list(); setList(r.data); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    await sectionsApi.update(id, { name: editName.trim() });
    setEditingId(null);
    fetch(); refreshSections();
  };

  const addSection = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddLoading(true);
    try { await sectionsApi.create({ name: newName.trim() }); setNewName(''); setAddOpen(false); fetch(); refreshSections(); }
    finally { setAddLoading(false); }
  };

  const deleteSection = async () => {
    setDeleteLoading(true);
    try { await sectionsApi.remove(deleteTarget); setDeleteTarget(null); fetch(); refreshSections(); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="مدیریت بخش‌ها"
        subtitle={`${list.length} بخش`}
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> بخش جدید
          </button>
        }
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <p className="py-12 text-center text-gray-600">هیچ بخشی تعریف نشده است</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {list.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-800/30 group transition-colors">
                <div className="w-8 h-8 bg-indigo-900/40 border border-indigo-800/30 rounded-lg flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                  {s.id}
                </div>
                {editingId === s.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <button onClick={() => saveEdit(s.id)} className="p-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="flex-1 text-gray-200">{s.name}</span>
                )}
                {editingId !== s.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <PencilLine className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(s.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="افزودن بخش جدید" width="max-w-sm">
        <form onSubmit={addSection} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">نام بخش</label>
            <input
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="مثال: امنیت شبکه"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm">انصراف</button>
            <button type="submit" disabled={addLoading || !newName.trim()} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
              {addLoading ? 'در حال ذخیره...' : 'افزودن'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteSection}
        loading={deleteLoading}
        message="با حذف بخش، تمام پروژه‌ها و کاربران مرتبط نیز حذف خواهند شد. آیا مطمئنید؟"
      />
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { sections } = useSections();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const uRes = await usersApi.list();
      setList(uRes.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const deleteUser = async () => {
    setDeleteLoading(true);
    try { await usersApi.remove(deleteTarget); setDeleteTarget(null); fetch(); }
    finally { setDeleteLoading(false); }
  };

  const roleLabel = {
    super_admin: 'مدیر سیستم', it_head: 'مدیر IT', section_head: 'مسئول بخش',
    purchase_admin: 'مدیر خرید', tender_admin: 'مدیر مناقصات', contract_admin: 'مدیر قراردادها',
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="مدیریت کاربران"
        subtitle={`${list.length} کاربر`}
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> کاربر جدید
          </button>
        }
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="px-5 py-3 text-right text-gray-400 font-medium">نام کاربری</th>
              <th className="px-5 py-3 text-right text-gray-400 font-medium">نقش</th>
              <th className="px-5 py-3 text-right text-gray-400 font-medium">بخش</th>
              <th className="px-5 py-3 text-right text-gray-400 font-medium">وضعیت رمز</th>
              <th className="px-5 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {list.map(u => {
              const sec = sections.find(s => s.id === u.section_id);
              return (
                <tr key={u.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 group transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-800/60 flex items-center justify-center text-xs font-bold text-indigo-300">
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-gray-200">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'super_admin' ? 'bg-purple-900/50 text-purple-300' :
                      u.role === 'it_head' ? 'bg-blue-900/50 text-blue-300' :
                      u.role === 'section_head' ? 'bg-emerald-900/50 text-emerald-300' :
                      'bg-amber-900/50 text-amber-300'
                    }`}>
                      {roleLabel[u.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{sec?.name || <span className="text-gray-600">—</span>}</td>
                  <td className="px-5 py-3">
                    {u.must_change_password ? (
                      <span className="text-xs text-amber-400">باید تغییر دهد</span>
                    ) : (
                      <span className="text-xs text-gray-600">تنظیم شده</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {u.role !== 'super_admin' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => setEditTarget(u)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                          <PencilLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(u.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sections={sections}
        onSaved={() => { setAddOpen(false); fetch(); }}
      />
      <UserFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        sections={sections}
        editUser={editTarget}
        onSaved={() => { setEditTarget(null); fetch(); }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteUser}
        loading={deleteLoading}
        message="آیا از حذف این کاربر اطمینان دارید؟"
      />
    </div>
  );
}

function UserFormModal({ open, onClose, sections, editUser, onSaved }) {
  const isEdit = !!editUser;
  const [form, setForm] = useState({ username: '', password: '', role: 'section_head', section_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editUser) {
      setForm({ username: editUser.username, password: '', role: editUser.role, section_id: editUser.section_id ?? '' });
    } else {
      setForm({ username: '', password: '', role: 'section_head', section_id: '' });
    }
    setError('');
  }, [editUser, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, section_id: form.section_id || null };
      if (!isEdit) {
        if (!form.password) { setError('رمز عبور الزامی است'); return; }
        await usersApi.create(payload);
      } else {
        await usersApi.update(editUser.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'خطایی رخ داد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'ویرایش کاربر' : 'افزودن کاربر جدید'} width="max-w-md">
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-700/50 text-red-300 rounded-xl text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">نام کاربری</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            رمز عبور {isEdit && <span className="text-gray-600">(خالی = بدون تغییر)</span>}
          </label>
          <PasswordInput
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
            required={!isEdit}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">نقش</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value, section_id: '' }))}
          >
            <option value="it_head">مدیر IT</option>
            <option value="section_head">مسئول بخش</option>
            <option value="purchase_admin">مدیر خرید</option>
            <option value="tender_admin">مدیر مناقصات</option>
            <option value="contract_admin">مدیر قراردادها</option>
          </select>
        </div>
        {form.role === 'section_head' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">بخش</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              value={form.section_id}
              onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
              required
            >
              <option value="">— انتخاب بخش —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm">انصراف</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
            {loading ? 'در حال ذخیره...' : isEdit ? 'ذخیره تغییرات' : 'افزودن کاربر'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
