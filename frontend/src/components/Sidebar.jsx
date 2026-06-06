import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Monitor, Users, FolderKanban, LayoutDashboard, Shield, ChevronLeft } from 'lucide-react';

const STATUS_LABELS = {
  not_started: 'شروع نشده',
  in_progress: 'در حال انجام',
  on_hold: 'متوقف',
  completed: 'تکمیل شده',
};

export default function Sidebar({ sections = [], activeSectionId }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = {
    super_admin: 'مدیر سیستم',
    it_head: 'مدیر IT',
    section_head: 'مسئول بخش',
  }[user?.role] || '';

  return (
    <aside className="w-64 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col h-screen sticky top-0 overflow-y-auto scrollbar-thin">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">مدیریت پروژه IT</p>
            <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {user?.role === 'super_admin' && (
          <>
            <SidebarLink to="/admin" icon={<LayoutDashboard className="w-4 h-4" />} label="داشبورد کلی" />
            <SidebarLink to="/admin/sections" icon={<FolderKanban className="w-4 h-4" />} label="مدیریت بخش‌ها" />
            <SidebarLink to="/admin/users" icon={<Users className="w-4 h-4" />} label="مدیریت کاربران" />
            <SidebarLink to="/it-head" icon={<Shield className="w-4 h-4" />} label="نمای مدیر IT" />
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">بخش‌ها</p>
            </div>
            {sections.map(s => (
              <SidebarLink
                key={s.id}
                to={`/section/${s.id}`}
                icon={<ChevronLeft className="w-4 h-4" />}
                label={s.name}
              />
            ))}
          </>
        )}

        {user?.role === 'it_head' && (
          <>
            <SidebarLink to="/it-head" icon={<LayoutDashboard className="w-4 h-4" />} label="داشبورد کلی" />
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">بخش‌ها</p>
            </div>
            {sections.map(s => (
              <SidebarLink
                key={s.id}
                to={`/section/${s.id}`}
                icon={<ChevronLeft className="w-4 h-4" />}
                label={s.name}
              />
            ))}
          </>
        )}

        {user?.role === 'section_head' && (
          <>
            <SidebarLink
              to={`/section/${user.section_id}`}
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="پروژه‌های من"
            />
            <SidebarLink
              to={`/section/${user.section_id}/personnel`}
              icon={<Users className="w-4 h-4" />}
              label="مسئولین پروژه‌ها"
            />
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 mb-2">
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{user?.username}</p>
            <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          خروج از سیستم
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-400 font-medium'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
