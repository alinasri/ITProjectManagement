export default function StatusHistoryTimeline({ history, statusConfig }) {
  if (!history?.length) {
    return (
      <p className="text-gray-500 text-sm text-center py-6">تاریخچه‌ای ثبت نشده است</p>
    );
  }

  return (
    <ol className="relative border-r-2 border-gray-700 mr-3 space-y-5 py-1">
      {history.map((h) => (
        <li key={h.id} className="mr-6">
          <span className="absolute -right-[7px] w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-gray-900" />
          <div className="text-xs text-gray-500 mb-1.5">
            {h.changed_at}
            {h.changed_by_username && (
              <span className="mr-2 text-gray-400">{h.changed_by_username}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {h.from_status ? (
              <>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[h.from_status]?.cls || 'bg-gray-700 text-gray-300'}`}>
                  {statusConfig[h.from_status]?.label || h.from_status}
                </span>
                <span className="text-gray-600 text-base">←</span>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">ایجاد شد</span>
                <span className="text-gray-600 text-base">←</span>
              </>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[h.to_status]?.cls || 'bg-gray-700 text-gray-300'}`}>
              {statusConfig[h.to_status]?.label || h.to_status}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
