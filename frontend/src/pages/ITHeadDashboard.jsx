import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { projects as projectsApi, ongoingTasks as ongoingTasksApi } from '../api';
import { useSections } from '../context/SectionsContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { ChevronLeft } from 'lucide-react';

const STATUS_COLORS = {
  not_started: '#6b7280',
  in_progress:  '#3b82f6',
  on_hold:      '#f59e0b',
  completed:    '#10b981',
};

const STATUS_LABELS = {
  not_started: 'شروع نشده',
  in_progress: 'در حال انجام',
  on_hold:     'متوقف',
  completed:   'تکمیل شده',
};

export default function ITHeadDashboard() {
  const { sections } = useSections();
  const [allProjects, setAllProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([projectsApi.list(), ongoingTasksApi.list()])
      .then(([pRes, tRes]) => {
        setAllProjects(pRes.data);
        setAllTasks(tRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const total = allProjects.length;
  const inProgress = allProjects.filter(p => p.status === 'in_progress').length;
  const onHold = allProjects.filter(p => p.status === 'on_hold').length;
  const completed = allProjects.filter(p => p.status === 'completed').length;
  const notStarted = allProjects.filter(p => p.status === 'not_started').length;

  // Pie chart data
  const pieData = [
    { name: STATUS_LABELS.not_started, value: notStarted, key: 'not_started' },
    { name: STATUS_LABELS.in_progress,  value: inProgress, key: 'in_progress' },
    { name: STATUS_LABELS.on_hold,      value: onHold,     key: 'on_hold' },
    { name: STATUS_LABELS.completed,    value: completed,  key: 'completed' },
  ].filter(d => d.value > 0);

  // Bar chart data per section
  const barData = sections.map(s => {
    const sp = allProjects.filter(p => p.section_id === s.id);
    return {
      name: s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name,
      'شروع نشده':    sp.filter(p => p.status === 'not_started').length,
      'در حال انجام': sp.filter(p => p.status === 'in_progress').length,
      'متوقف':         sp.filter(p => p.status === 'on_hold').length,
      'تکمیل شده':    sp.filter(p => p.status === 'completed').length,
    };
  });

  return (
    <div>
      <PageHeader title="داشبورد مدیر IT" subtitle="نمای کلی تمام بخش‌ها" />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="کل پروژه‌ها" value={total} icon="📋" color="indigo" />
        <StatCard label="در حال انجام" value={inProgress} icon="🔄" color="blue" />
        <StatCard label="متوقف" value={onHold} icon="⏸️" color="amber" />
        <StatCard label="تکمیل شده" value={completed} icon="✅" color="emerald" />
        <StatCard label="وظایف جاری" value={allTasks.length} icon="🗂️" color="gray" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Pie chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">توزیع وضعیت پروژه‌ها</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map(entry => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 12, color: '#f3f4f6', direction: 'rtl' }}
                formatter={(value, name) => [value + ' پروژه', name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map(d => (
              <div key={d.key} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.key] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">پروژه‌ها به تفکیک بخش</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 12, color: '#f3f4f6', direction: 'rtl' }}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#9ca3af', direction: 'rtl' }} />
              <Bar dataKey="در حال انجام" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
              <Bar dataKey="متوقف"         stackId="a" fill="#f59e0b" />
              <Bar dataKey="تکمیل شده"    stackId="a" fill="#10b981" />
              <Bar dataKey="شروع نشده"    stackId="a" fill="#4b5563" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section cards */}
      <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">بخش‌ها</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.map(s => {
          const sp = allProjects.filter(p => p.section_id === s.id);
          const st = allTasks.filter(t => t.section_id === s.id);
          const pct = sp.length ? Math.round((sp.filter(p => p.status === 'completed').length / sp.length) * 100) : 0;
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/section/${s.id}`)}
              className="bg-gray-900 border border-gray-800 hover:border-indigo-700/60 rounded-2xl p-5 text-right transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-100 leading-snug">{s.name}</h3>
                <ChevronLeft className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                <span className="text-gray-400">{sp.length} پروژه</span>
                <span className="text-emerald-400">{sp.filter(p => p.status === 'completed').length} تکمیل</span>
                <span className="text-amber-400">{sp.filter(p => p.status === 'on_hold').length} متوقف</span>
                <span className="text-gray-500">{st.length} وظیفه جاری</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1.5">{pct}% تکمیل شده</p>

              {/* Status mini-row */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {sp.slice(0, 3).map(p => (
                  <StatusBadge key={p.id} status={p.status} />
                ))}
                {sp.length > 3 && <span className="text-xs text-gray-600">+{sp.length - 3} مورد دیگر</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
