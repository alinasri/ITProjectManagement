import { useState, useEffect } from 'react';

/**
 * Shared state + actions for pages that have inline-editable rows with
 * archive, delete, and status-history support.
 *
 * @param {object} api          - API object with update/create/remove/archive/getHistory methods
 * @param {function} makeEditRow - (row) => object  — extracts editable fields from a data row
 * @param {function} fetchAll   - refresh callback (wrapped in useCallback by the caller)
 */
export function useTableEdit({ api, makeEditRow, fetchAll }) {
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addRowLoading, setAddRowLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  useEffect(() => {
    if (!historyTarget) return;
    api.getHistory(historyTarget).then(r => setHistoryRows(r.data));
  }, [historyTarget, api]);

  const startEdit = (row) => { setEditingId(row.id); setEditRow(makeEditRow(row)); };
  const cancelEdit = () => setEditingId(null);

  // Pass `data` to override editRow (e.g. when the caller needs to transform before save).
  const saveEdit = async (id, data = editRow) => {
    await api.update(id, data);
    setEditingId(null);
    fetchAll();
  };

  const addRow = async (defaults) => {
    setAddRowLoading(true);
    try { await api.create(defaults); fetchAll(); }
    finally { setAddRowLoading(false); }
  };

  const deleteRow = async () => {
    setDeleteLoading(true);
    try {
      await api.remove(deleteTarget);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      if (err.response?.status === 409) { setDeleteTarget(null); fetchAll(); }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchive = async (id, archive) => {
    await api.archive(id, archive);
    fetchAll();
  };

  const closeHistory = () => { setHistoryTarget(null); setHistoryRows([]); };

  return {
    editingId, editRow, setEditRow,
    deleteTarget, setDeleteTarget, deleteLoading,
    addRowLoading,
    historyTarget, setHistoryTarget, historyRows, closeHistory,
    startEdit, cancelEdit, saveEdit, addRow, deleteRow, handleArchive,
  };
}
