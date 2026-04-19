import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IssueTracker from './pages/IssueTracker';
import IssueDetail from './pages/IssueDetail';
import NewIssue from './pages/NewIssue';
import FoodVendors from './pages/FoodVendors';
import FoodVendorDetail from './pages/FoodVendorDetail';
import FoodEstablishments from './pages/FoodEstablishments';
import FoodEstablishmentDetail from './pages/FoodEstablishmentDetail';
import StaffManagement from './pages/StaffManagement';
import StaffProfile from './pages/StaffProfile';
import LeaveTracker from './pages/LeaveTracker';
import AdminPanel from './pages/AdminPanel';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <Header />
      <main className="main-content fade-in">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-center">
      <div className="loading-spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-center" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/issues" element={<ProtectedRoute><IssueTracker /></ProtectedRoute>} />
      <Route path="/issues/new" element={<ProtectedRoute><NewIssue /></ProtectedRoute>} />
      <Route path="/issues/:id" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />
      <Route path="/food/vendors" element={<ProtectedRoute><FoodVendors /></ProtectedRoute>} />
      <Route path="/food/vendors/:id" element={<ProtectedRoute><FoodVendorDetail /></ProtectedRoute>} />
      <Route path="/food/establishments" element={<ProtectedRoute><FoodEstablishments /></ProtectedRoute>} />
      <Route path="/food/establishments/:id" element={<ProtectedRoute><FoodEstablishmentDetail /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><StaffManagement /></ProtectedRoute>} />
      <Route path="/staff/:id" element={<ProtectedRoute><StaffProfile /></ProtectedRoute>} />
      <Route path="/leave" element={<ProtectedRoute><LeaveTracker /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
