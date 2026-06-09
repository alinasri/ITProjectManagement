import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ConfirmDialog from '../components/ConfirmDialog';
import MultiSelect from '../components/MultiSelect';
import PersianDatePicker from '../components/PersianDatePicker';
import Modal from '../components/Modal';
import StatusHistoryTimeline from '../components/StatusHistoryTimeline';
import { tenders as tendersApi } from '../api';
import { useSections } from '../context/SectionsContext';
import { Plus, Trash2, PencilLine, Check, X, Gavel, Archive, History } from 'lucide-react';

const STATUS_CONFIG = {
  open:       { label: 'در حال برگزاری',  cls: 'bg-blue-900/60 text-blue-300' },
  evaluating: { label: 'در حال ارزیابی',  cls: 'bg-amber-900/60 text-amber-300' },
  awarded:    { label: 'برنده اعلام شده', cls: 'bg-emerald-900/60 text-emerald-300' },
  completed:  { label: 'خاتمه یافته',     cls: 'bg-gray-700/60 text-gray-300' },
  cancelled:  { label: 'لغو شده',         cls: 'bg-red-900/60 text-red-300' },
};
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

function StatusPill({ status }) {
  const { label, cls } = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function TendersPage() {
  const { user } = useAuth();
  const { sections } = useSections();
  const canEdit = user?.role === 'super_admin' || user?.role === 'tender_admin';

  const [list, setList] = useState([]);
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
      const r = await tendersApi.list(showArchived ? { archived: 1 } : {});
      setList(r.data);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!historyTarget) return;
    tendersApi.getHistory(historyTarget).then(r => setHistoryRows(r.data));
  }, [historyTarget]);

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditRow({
      title: row.title,
      status: row.status,
      estimated_amount: row.estimated_amount,
      deadline: row.deadline,
      winner: row.winner,
      description: row.description,
      section_ids: row.sections?.map(s => s.id) ?? [],
    });
  };

  const saveEdit = async (id) => {
    await tendersApi.update(id, { ...editRow });
    setEditingId(null);
    fetchAll();
  };

  const cancelEdit = () => setEditingId(null);

  const addRow = async () => {
    setAddRowLoading(true);
    try {
      await tendersApi.create({ title: 'مناقصه جدید' });
      fetchAll();
    } finally {
      setAddRowLoading(false);
    }
  };

  const deleteRow = async () => {
    setDeleteLoading(true);
    try {
      await tendersApi.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchive = async (id, archive) => {
    await tendersApi.archive(id, archive);
    fetchAll();
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
        title="مناقصات"
        subtitle={`${list.length} مورد`}
        action={
          <div className="flex items-center gap-2">
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
                مناقصه جدید
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {STATUS_OPTIONS.map(o => (
          <StatCard key={o.value} label={o.label} value={list.filter(t => t.status === o.value).length} icon="🔨" color="indigo" />
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-right text-gray-400 font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">موضوع مناقصه</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">وضعیت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">برآورد مبلغ</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">مهلت ارسال</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">برنده</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">بخش‌های مرتبط</th>
                {canEdit && <th className="px-4 py-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {list.map((t, idx) => (
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
                          value={editRow.estimated_amount}
                          onChange={e => setEditRow(r => ({ ...r, estimated_amount: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <PersianDatePicker
                          value={editRow.deadline}
                          onChange={val => setEditRow(r => ({ ...r, deadline: val }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                          value={editRow.winner}
                          onChange={e => setEditRow(r => ({ ...r, winner: e.target.value }))}
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
                      <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                      <td className="px-4 py-3 text-gray-300">{t.estimated_amount || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{t.deadline || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{t.winner || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{t.sections?.length ? t.sections.map(s => s.name).join('، ') : <span className="text-gray-600">—</span>}</td>
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
                            <button onClick={() => setDeleteTarget(t.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
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
                      <Gavel className="w-8 h-8 text-gray-700" />
                      {showArchived ? 'هیچ مناقصه آرشیوشده‌ای وجود ندارد' : 'هیچ مناقصه‌ای ثبت نشده است'}
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
        message="آیا از حذف این مناقصه اطمینان دارید؟ این عملیات قابل بازگشت نیست."
      />

      <Modal
        open={!!historyTarget}
        onClose={() => { setHistoryTarget(null); setHistoryRows([]); }}
        title="تاریخچه وضعیت"
        width="max-w-md"
      >
        <StatusHistoryTimeline history={historyRows} statusConfig={STATUS_CONFIG} />
      </Modal>
    </div>
  );
}
