import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, onClose, onConfirm, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title="تأیید حذف" width="max-w-sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 bg-red-900/40 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-gray-300 text-sm">{message || 'آیا از حذف این مورد اطمینان دارید؟'}</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'در حال حذف...' : 'حذف'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
