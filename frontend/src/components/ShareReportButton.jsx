import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { report as reportApi } from '../api';
import { Share2, Copy, Check, RefreshCw, X, Loader2 } from 'lucide-react';

export default function ShareReportButton() {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [token, setToken]     = useState(null);
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(false);

  const reportUrl = token
    ? `${window.location.origin}/report/${token}`
    : null;

  const fetchToken = async () => {
    if (token) { setOpen(true); return; }
    setLoading(true);
    try {
      const res = await reportApi.getToken();
      setToken(res.data.token);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      const res = await reportApi.regenerate();
      setToken(res.data.token);
      setCopied(false);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!reportUrl) return;
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={fetchToken}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-700/40 text-indigo-300 text-sm transition-colors disabled:opacity-60"
      >
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Share2 className="w-4 h-4" />}
        <span>اشتراک‌گذاری گزارش</span>
      </button>

      {open && token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-100 text-base">لینک گزارش ماهانه</h3>
                <p className="text-xs text-gray-500 mt-0.5">این لینک بدون نیاز به ورود به سیستم قابل مشاهده است</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 mb-4">
              <span className="text-xs text-gray-400 flex-1 truncate font-mono ltr:text-left rtl:text-left" dir="ltr">{reportUrl}</span>
              <button
                onClick={copy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'کپی شد' : 'کپی'}
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              گزارش شامل تمام پروژه‌ها، وظایف، خریدها، مناقصات و قراردادهای آرشیو‌نشده است.
            </p>

            {user?.role === 'super_admin' && (
              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400">تجدید لینک</p>
                    <p className="text-xs text-gray-600 mt-0.5">لینک قدیمی غیرفعال می‌شود و قابل استفاده نخواهد بود</p>
                  </div>
                  <button
                    onClick={regenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-700/50 bg-red-900/20 hover:bg-red-900/30 text-red-400 text-xs transition-colors disabled:opacity-60 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    تجدید لینک
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
