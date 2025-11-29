import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiRequest } from "./queryClient";

interface AuthUser {
  id: string;
  email: string;
  role: "company_owner" | "store_manager" | "customer";
  storeId?: string;
  storeName?: string;
  mustResetPassword?: boolean;
}

interface CustomerSession {
  id: string;
  storeId: string;
  storeName: string;
  expiresAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  customerSession: CustomerSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; mustResetPassword?: boolean; error?: string }>;
  logout: () => void;
  setCustomerSession: (session: CustomerSession | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch {
      localStorage.removeItem("token");
      setUser(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser();
    
    // Check for customer session in URL
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get("session");
    if (sessionToken) {
      validateCustomerSession(sessionToken);
    } else {
      // Check localStorage for existing customer session
      const savedSession = localStorage.getItem("customerSession");
      if (savedSession) {
        const session = JSON.parse(savedSession);
        if (new Date(session.expiresAt) > new Date()) {
          setCustomerSession(session);
        } else {
          localStorage.removeItem("customerSession");
        }
      }
    }
  }, []);

  const validateCustomerSession = async (token: string) => {
    try {
      const res = await fetch(`/api/qr/${token}/validate`);
      if (res.ok) {
        const data = await res.json();
        const session: CustomerSession = {
          id: data.sessionId,
          storeId: data.storeId,
          storeName: data.storeName,
          expiresAt: data.expiresAt,
        };
        setCustomerSession(session);
        localStorage.setItem("customerSession", JSON.stringify(session));
        // Clear URL params
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (error) {
      console.error("Failed to validate customer session:", error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json() as { token: string; user: AuthUser };
      localStorage.setItem("token", data.token);
      setUser(data.user);
      return { success: true, mustResetPassword: data.user?.mustResetPassword };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("customerSession");
    setUser(null);
    setCustomerSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customerSession,
        isLoading,
        login,
        logout,
        setCustomerSession,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
