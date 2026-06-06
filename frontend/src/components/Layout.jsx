import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSections } from '../context/SectionsContext';

export default function Layout() {
  const { sections } = useSections();

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar sections={sections} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
