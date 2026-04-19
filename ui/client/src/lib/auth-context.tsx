import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  organization: string | null;
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; organization?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredToken(): string | null {
  return localStorage.getItem("netspectre_token");
}

function getStoredUser(): User | null {
  const stored = localStorage.getItem("netspectre_user");
  return stored ? JSON.parse(stored) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Invalid session");
        })
        .then((freshUser) => {
          setUser(freshUser);
          localStorage.setItem("netspectre_user", JSON.stringify(freshUser));
        })
        .catch(() => {
          localStorage.removeItem("netspectre_token");
          localStorage.removeItem("netspectre_user");
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("netspectre_token", data.token);
      localStorage.setItem("netspectre_user", JSON.stringify(data.user));

      if (data.user.mustChangePassword) {
        setLocation("/auth/change-password");
      } else {
        setLocation("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  }, [setLocation]);

  const register = useCallback(async (data: { email: string; password: string; name: string; organization?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Registration failed");

      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("netspectre_token", result.token);
      localStorage.setItem("netspectre_user", JSON.stringify(result.user));
      setLocation("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [setLocation]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const currentToken = getStoredToken();
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Password change failed");

    const updatedUser = { ...user!, mustChangePassword: false };
    setUser(updatedUser);
    localStorage.setItem("netspectre_user", JSON.stringify(updatedUser));
    setLocation("/dashboard");
  }, [user, setLocation]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("netspectre_token");
    localStorage.removeItem("netspectre_user");
    setLocation("/auth/login");
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, changePassword, logout }}>
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

export function useAuthHeaders(): Record<string, string> {
  const { token } = useAuth();
  return token ? { Authorization: `Bearer ${token}` } : {};
}