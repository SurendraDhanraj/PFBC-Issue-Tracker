import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider, useBranding } from './context/BrandingContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
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
import BottomNav from './components/BottomNav';
import { MobileNavProvider } from './context/MobileNavContext';

/** Applies dynamic favicon + page title */
function BrandingApplier() {
  const { appName, faviconUrl } = useBranding();
  useEffect(() => {
    if (appName) document.title = appName;
    if (faviconUrl) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = faviconUrl;
    }
  }, [appName, faviconUrl]);
  return null;
}

function AppLayout({ children }) {
  return (
    <MobileNavProvider>
      <div className="app-layout">
        <Sidebar />
        <Header />
        <main className="main-content fade-in">{children}</main>
        <BottomNav />
      </div>
    </MobileNavProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function SplashScreen() {
  const { appName, tagline, splashUrl, logoIcon } = useBranding();
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      gap: 20, zIndex: 9999,
    }}>
      {splashUrl ? (
        <img src={splashUrl} alt="App logo" style={{
          width: 96, height: 96, objectFit: 'contain',
          borderRadius: 18,
          background: 'white',
          padding: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        }} />
      ) : (
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'white',
          border: '1.5px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>{logoIcon}</div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{appName}</div>
        {tagline && <div style={{ fontSize: 13, color: '#64748b' }}>{tagline}</div>}
      </div>
      <div style={{
        width: 36, height: 36, border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6', borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }} />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" replace />} />
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
        <BrandingProvider>
          <BrandingApplier />
          <AppRoutes />
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
