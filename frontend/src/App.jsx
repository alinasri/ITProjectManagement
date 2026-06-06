import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SectionsProvider } from './context/SectionsContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ITHeadDashboard from './pages/ITHeadDashboard';
import SectionDashboard from './pages/SectionDashboard';
import ChangePasswordPage from './pages/ChangePasswordPage';
import PurchasesPage from './pages/PurchasesPage';
import TendersPage from './pages/TendersPage';
import ContractsPage from './pages/ContractsPage';

function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Renders login page immediately; redirects away only after auth check completes
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  // Don't block — show the login page while the check is in flight.
  // Once resolved, if user exists redirect them home.
  if (!loading && user && !user.must_change_password) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Single persistent Layout for all protected routes
function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  return (
    <SectionsProvider>
      <Layout />
    </SectionsProvider>
  );
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  if (user.role === 'it_head') return <Navigate to="/it-head" replace />;
  if (user.role === 'section_head') return <Navigate to={`/section/${user.section_id}`} replace />;
  if (user.role === 'purchase_admin') return <Navigate to="/purchases" replace />;
  if (user.role === 'tender_admin') return <Navigate to="/tenders" replace />;
  if (user.role === 'contract_admin') return <Navigate to="/contracts" replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login renders immediately — no loading gate */}
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />

          <Route element={<RequireAuth />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* All dashboard routes share one persistent Layout */}
          <Route element={<ProtectedLayout />}>
            <Route element={<RequireAuth roles={['super_admin']} />}>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Route>
            <Route element={<RequireAuth roles={['it_head', 'super_admin']} />}>
              <Route path="/it-head/*" element={<ITHeadDashboard />} />
            </Route>
            <Route element={<RequireAuth roles={['section_head', 'super_admin', 'it_head']} />}>
              <Route path="/section/:sectionId/*" element={<SectionDashboard />} />
            </Route>
            <Route element={<RequireAuth roles={['super_admin', 'it_head', 'purchase_admin']} />}>
              <Route path="/purchases" element={<PurchasesPage />} />
            </Route>
            <Route element={<RequireAuth roles={['super_admin', 'it_head', 'tender_admin']} />}>
              <Route path="/tenders" element={<TendersPage />} />
            </Route>
            <Route element={<RequireAuth roles={['super_admin', 'it_head', 'contract_admin']} />}>
              <Route path="/contracts" element={<ContractsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
