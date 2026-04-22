import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AuthCallback() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();

  const token = useMemo(() => new URLSearchParams(search).get("token") || "", [search]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Thiếu token đăng nhập.");
      return;
    }

    const payload = decodeJwtPayload(token);
    const username =
      (payload?.["email"] as string | undefined) ||
      (payload?.["username"] as string | undefined) ||
      "google";

    setToken(token, username);
    navigate("/", { replace: true });
  }, [token, navigate, setToken]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-6 w-full max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-stopped mt-0.5" />
            <div>
              <p className="font-medium text-text-primary">Đăng nhập thất bại</p>
              <p className="text-sm text-text-muted mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-text-muted">Đang hoàn tất đăng nhập...</p>
      </div>
    </div>
  );
}

