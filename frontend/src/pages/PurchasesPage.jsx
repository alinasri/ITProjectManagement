import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ConfirmDialog from '../components/ConfirmDialog';
import MultiSelect from '../components/MultiSelect';
import { purchases as purchasesApi } from '../api';
import { useSections } from '../context/SectionsContext';
import { Plus, Trash2, PencilLine, Check, X, ShoppingCart } from 'lucide-react';

const STATUS_CONFIG = {
  pending:   { label: 'در انتظار',    cls: 'bg-gray-700/60 text-gray-300' },
  approved:  { label: 'تایید شده',    cls: 'bg-blue-900/60 text-blue-300' },
  purchased: { label: 'خریداری شده',  cls: 'bg-indigo-900/60 text-indigo-300' },
  delivered: { label: 'تحویل شده',    cls: 'bg-emerald-900/60 text-emerald-300' },
  cancelled: { label: 'لغو شده',      cls: 'bg-red-900/60 text-red-300' },
};
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

function StatusPill({ status }) {
  const { label, cls } = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const { sections } = useSections();
  const canEdit = user?.role === 'super_admin' || user?.role === 'purchase_admin';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addRowLoading, setAddRowLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const r = await purchasesApi.list();
      setList(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditRow({
      title: row.title,
      status: row.status,
      supplier: row.supplier,
      amount: row.amount,
      purchase_date: row.purchase_date,
      description: row.description,
      section_ids: row.sections?.map(s => s.id) ?? [],
    });
  };

  const saveEdit = async (id) => {
    await purchasesApi.update(id, { ...editRow });
    setEditingId(null);
    fetchAll();
  };

  const cancelEdit = () => setEditingId(null);

  const addRow = async () => {
    setAddRowLoading(true);
    try {
      await purchasesApi.create({ title: 'خرید جدید' });
      fetchAll();
    } finally {
      setAddRowLoading(false);
    }
  };

  const deleteRow = async () => {
    setDeleteLoading(true);
    try {
      await purchasesApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const colCount = canEdit ? 8 : 7;

  return (
    <div>
      <PageHeader
        title="خریدها"
        subtitle={`${list.length} مورد`}
        action={canEdit && (
          <button
            onClick={addRow}
            disabled={addRowLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            خرید جدید
          </button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {STATUS_OPTIONS.map(o => (
          <StatCard key={o.value} label={o.label} value={list.filter(p => p.status === o.value).length} icon="🛒" color="indigo" />
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-right text-gray-400 font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">موضوع خرید</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">وضعیت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">تأمین‌کننده</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">مبلغ</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">تاریخ خرید</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">بخش‌های مرتبط</th>
                {canEdit && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody>
              {list.map((p, idx) => (
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
                          value={editRow.status}
                          onChange={e => setEditRow(r => ({ ...r, status: e.target.value }))}
                        >
                          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.supplier}
                          onChange={e => setEditRow(r => ({ ...r, supplier: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.amount}
                          onChange={e => setEditRow(r => ({ ...r, amount: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.purchase_date}
                          onChange={e => setEditRow(r => ({ ...r, purchase_date: e.target.value }))}
                          placeholder="مثال: ۱۴۰۳/۰۳/۱۵"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <MultiSelect
                          items={sections}
                          selectedIds={editRow.section_ids}
                          onChange={ids => setEditRow(r => ({ ...r, section_ids: ids }))}
                          emptyLabel="بخشی ثبت نشده است"
                        />
                      </td>
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
                      <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                      <td className="px-4 py-3 text-gray-300">{p.supplier || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{p.amount || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{p.purchase_date || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{p.sections?.length ? p.sections.map(s => s.name).join('، ') : <span className="text-gray-600">—</span>}</td>
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
              {list.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-gray-600">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-gray-700" />
                      هیچ خریدی ثبت نشده است
                    </div>
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
        onConfirm={deleteRow}
        loading={deleteLoading}
        message="آیا از حذف این خرید اطمینان دارید؟ این عملیات قابل بازگشت نیست."
      />
    </div>
  );
}
