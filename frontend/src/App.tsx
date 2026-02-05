import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/ui/Toaster";
import { Containers } from "./pages/Containers";
import { Dashboard } from "./pages/Dashboard";
import { Images } from "./pages/Images";
import { Login } from "./pages/Login";
import { Networks } from "./pages/Networks";
import { Volumes } from "./pages/Volumes";
import { authAPI } from "./services/api";
import { useAuthStore } from "./stores/authStore";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading, setAuthEnabled, setLoading, initialize } =
    useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if auth is enabled on the server
        const status = await authAPI.getStatus();
        setAuthEnabled(status.enabled);

        // If auth is enabled and we have a stored token, validate it
        if (status.enabled) {
          const token = useAuthStore.getState().token;
          if (token) {
            try {
              // Try to get user info to validate token
              await authAPI.getMe();
              initialize();
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
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
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
