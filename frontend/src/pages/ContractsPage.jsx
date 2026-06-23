import { useState, useEffect, useCallback } from 'react';
import { useTableEdit } from '../hooks/useTableEdit';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ConfirmDialog from '../components/ConfirmDialog';
import FilterBar from '../components/FilterBar';
import MultiSelect from '../components/MultiSelect';
import PersianDatePicker from '../components/PersianDatePicker';
import Modal from '../components/Modal';
import StatusHistoryTimeline from '../components/StatusHistoryTimeline';
import { contracts as contractsApi } from '../api';
import { useSections } from '../context/SectionsContext';
import { Plus, Trash2, PencilLine, Check, X, FileSignature, Archive, History, AlertTriangle } from 'lucide-react';
import { CONTRACT_STATUS_CONFIG as STATUS_CONFIG, CONTRACT_STATUS_OPTIONS as STATUS_OPTIONS } from '../config/statusConfigs';
import { isWithinDeletionWindow } from '../utils/isWithinDeletionWindow';
import { contractExpiryTag } from '../utils/dateHelpers';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

export default function ContractsPage() {
  const { user } = useAuth();
  const { sections } = useSections();
  const canEdit = user?.role === 'super_admin' || user?.role === 'contract_admin';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const r = await contractsApi.list(showArchived ? { archived: 1 } : {});
      setList(r.data);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const {
    editingId, editRow, setEditRow,
    deleteTarget, setDeleteTarget, deleteLoading,
    addRowLoading,
    historyTarget, setHistoryTarget, historyRows, closeHistory,
    startEdit, cancelEdit, saveEdit, addRow, deleteRow, handleArchive,
  } = useTableEdit({
    api: contractsApi,
    makeEditRow: row => ({
      title: row.title,
      status: row.status,
      counterparty: row.counterparty,
      start_date: row.start_date,
      end_date: row.end_date,
      amount: row.amount,
      description: row.description,
      section_ids: row.sections?.map(s => s.id) ?? [],
    }),
    fetchAll,
  });

  const canDelete = isWithinDeletionWindow;

  if (loading) return <Spinner />;

  const colCount = canEdit ? 9 : 8;

  const displayList = list.filter(c => {
    const matchesSearch = !searchTerm || c.title.includes(searchTerm) || (c.counterparty || '').includes(searchTerm);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader
        title="قراردادها"
        subtitle={`${displayList.length} مورد`}
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
                onClick={() => addRow({ title: 'قرارداد جدید' })}
                disabled={addRowLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                قرارداد جدید
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATUS_OPTIONS.map(o => (
          <StatCard key={o.value} label={o.label} value={list.filter(c => c.status === o.value).length} icon="📄" color="indigo" />
        ))}
      </div>

      {(() => {
        const expired  = list.filter(c => contractExpiryTag(c) === 'expired').length;
        const expiring = list.filter(c => contractExpiryTag(c) === 'expiring').length;
        if (!expired && !expiring) return null;
        return (
          <div className="mb-6 flex items-start gap-3 px-5 py-4 bg-amber-900/20 border border-amber-600/30 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">هشدار انقضای قرارداد</p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                {expired > 0 && <span>{expired} قرارداد منقضی شده</span>}
                {expired > 0 && expiring > 0 && ' — '}
                {expiring > 0 && <span>{expiring} قرارداد در ۶۰ روز آینده منقضی می‌شود</span>}
              </p>
            </div>
          </div>
        );
      })()}

      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statuses={STATUS_OPTIONS}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-right text-gray-400 font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">موضوع قرارداد</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">وضعیت</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-36">طرف قرارداد</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">تاریخ شروع</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">تاریخ پایان</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-32">مبلغ</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium min-w-48">بخش‌های مرتبط</th>
                {canEdit && <th className="px-4 py-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {displayList.map((c, idx) => {
                const expiryTag = contractExpiryTag(c);
                return (
                <tr key={c.id} className={`border-b border-gray-800/60 transition-colors group ${
                  expiryTag === 'expired'  ? 'bg-red-950/40 hover:bg-red-950/60' :
                  expiryTag === 'expiring' ? 'bg-amber-950/30 hover:bg-amber-950/50' :
                  'hover:bg-gray-800/30'
                } ${c.is_archived ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 text-center">{idx + 1}</td>

                  {editingId === c.id ? (
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
                          value={editRow.counterparty}
                          onChange={e => setEditRow(r => ({ ...r, counterparty: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <PersianDatePicker
                          value={editRow.start_date}
                          onChange={val => setEditRow(r => ({ ...r, start_date: val }))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <PersianDatePicker
                          value={editRow.end_date}
                          onChange={val => setEditRow(r => ({ ...r, end_date: val }))}
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
                        <MultiSelect
                          items={sections}
                          selectedIds={editRow.section_ids}
                          onChange={ids => setEditRow(r => ({ ...r, section_ids: ids }))}
                          emptyLabel="بخشی ثبت نشده است"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(c.id)} className="p-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white">
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
                      <td className="px-4 py-3 text-gray-200 font-medium">{c.title}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-gray-300">{c.counterparty || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{c.start_date || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{c.end_date || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{c.amount || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{c.sections?.length ? c.sections.map(s => s.name).join('، ') : <span className="text-gray-600">—</span>}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setHistoryTarget(c.id)}
                              className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                              title="تاریخچه وضعیت"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(c.id, !c.is_archived)}
                              className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-900/30 rounded-lg transition-colors"
                              title={c.is_archived ? 'بازگردانی' : 'آرشیو'}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => startEdit(c)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            {canDelete(c.created_at) && (
                              <button onClick={() => setDeleteTarget(c.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">
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
              {list.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-gray-600">
                    <div className="flex flex-col items-center gap-2">
                      <FileSignature className="w-8 h-8 text-gray-700" />
                      {showArchived ? 'هیچ قرارداد آرشیوشده‌ای وجود ندارد' : 'هیچ قراردادی ثبت نشده است'}
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
        message="آیا از حذف این قرارداد اطمینان دارید؟ حذف تنها در ۱۰ دقیقه اول پس از ایجاد امکان‌پذیر است."
      />

      <Modal
        open={!!historyTarget}
        onClose={closeHistory}
        title="تاریخچه وضعیت"
        width="max-w-md"
      >
        <StatusHistoryTimeline history={historyRows} statusConfig={STATUS_CONFIG} />
      </Modal>
    </div>
  );
}
