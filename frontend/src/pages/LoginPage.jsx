import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Monitor } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.must_change_password) return navigate('/change-password');
      if (user.role === 'super_admin') navigate('/admin');
      else if (user.role === 'it_head') navigate('/it-head');
      else navigate(`/section/${user.section_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ورود به سیستم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-900/50">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">سامانه مدیریت پروژه</h1>
          <p className="text-gray-400 text-sm">اداره فناوری اطلاعات</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">ورود به سیستم</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-700/50 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">نام کاربری</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="نام کاربری را وارد کنید"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">رمز عبور</label>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="رمز عبور را وارد کنید"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-colors shadow-lg shadow-indigo-900/40"
            >
              {loading ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-600 leading-relaxed mt-6">
          توسعه دهنده: علی نصری
          <br />
          واحد فناوری اطلاعات — مدیریت اکتشاف نفت
        </p>
      </div>
    </div>
  );
}
