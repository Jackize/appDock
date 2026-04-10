import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/ui/Toaster";
import { Containers } from "./pages/Containers";
import { Dashboard } from "./pages/Dashboard";
import { Images } from "./pages/Images";
import { Login } from "./pages/Login";
import { Networks } from "./pages/Networks";
import { Nginx } from "./pages/Nginx";
import { DNS } from "./pages/DNS";
import Servers from "./pages/Servers";
import { Settings } from "./pages/Settings";
import { Volumes } from "./pages/Volumes";
import { authAPI } from "./services/api";
import { useAuthStore } from "./stores/authStore";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-text-muted">Đang kiểm tra xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function LoginRoute() {
  const location = useLocation() as { state?: { from?: { pathname?: string; search?: string } } };
  const { isAuthenticated } = useAuthStore();
  const fromPath =
    location.state?.from?.pathname
      ? `${location.state.from.pathname}${location.state.from.search || ""}`
      : "/";
  return isAuthenticated ? <Navigate to={fromPath} replace /> : <Login />;
}

function App() {
  const { isLoading, setAuthEnabled, setLoading, initialize } =
    useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if auth is enabled on the server
        const status = await authAPI.getStatus();
        setAuthEnabled(status.enabled);
        // Initialize from persisted token as early as possible
        initialize();

        // If auth is enabled and we have a stored token, validate it
        if (status.enabled) {
          const token = useAuthStore.getState().token;
          if (token) {
            try {
              // Try to get user info to validate token
              await authAPI.getMe();
            } catch {
              // Token is invalid, will redirect to login
              useAuthStore.getState().logout();
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to check auth status:", error);
        // If we can't reach the server, assume auth is enabled
        setAuthEnabled(true);
        setLoading(false);
      }
    };

    checkAuth();
  }, [setAuthEnabled, setLoading, initialize]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-text-muted">Đang khởi động...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Login route */}
        <Route
          path="/login"
          element={<LoginRoute />}
        />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/containers" element={<Containers />} />
                  <Route path="/images" element={<Images />} />
                  <Route path="/networks" element={<Networks />} />
                  <Route path="/volumes" element={<Volumes />} />
                  <Route path="/nginx" element={<Nginx />} />
                  <Route path="/dns" element={<DNS />} />
                  <Route path="/servers" element={<Servers />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
