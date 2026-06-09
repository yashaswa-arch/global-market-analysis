import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore, useAuthListener } from "@/stores/authStore";

export function AuthInit({ children }: { children: React.ReactNode }) {
  useAuthListener();
  const { isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#3b82f6" }}>
        <div className="spinner"></div>
        <style>{`
          .spinner { width: 40px; height: 40px; border: 3px solid rgba(59,130,246,0.2); border-radius: 50%; border-top-color: #3b82f6; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute() {
  const { userId, isLoading } = useAuthStore();

  if (!isLoading && !userId) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
