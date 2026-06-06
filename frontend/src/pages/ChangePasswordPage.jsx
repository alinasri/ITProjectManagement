import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../api';
import { KeyRound } from 'lucide-react';

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass !== confirm) return setError('رمزهای جدید یکسان نیستند');
    if (newPass.length < 6) return setError('رمز عبور باید حداقل ۶ کاراکتر باشد');
    setLoading(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: newPass });
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      if (updated.role === 'super_admin') navigate('/admin');
      else if (updated.role === 'it_head') navigate('/it-head');
      else navigate(`/section/${updated.section_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'خطایی رخ داد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-600 rounded-2xl mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">تغییر رمز عبور</h1>
          <p className="text-gray-400 text-sm">برای ادامه ابتدا رمز عبور خود را تغییر دهید</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-700/50 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'رمز عبور فعلی', val: current, set: setCurrent, auto: 'current-password' },
              { label: 'رمز عبور جدید', val: newPass, set: setNewPass, auto: 'new-password' },
              { label: 'تکرار رمز عبور جدید', val: confirm, set: setConfirm, auto: 'new-password' },
            ].map(({ label, val, set, auto }) => (
              <div key={label}>
                <label className="block text-sm text-gray-400 mb-2">{label}</label>
                <input
                  type="password"
                  value={val}
                  onChange={e => set(e.target.value)}
                  autoComplete={auto}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loading ? 'در حال ذخیره...' : 'ذخیره رمز عبور'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
