import { useEffect, useState, useCallback } from "react";
import { api } from "../shared/api";

export interface AdminInfo {
  username: string;
  displayName: string;
}

export function useAdminSession() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AdminInfo>("/admin/auth/me");
      setAdmin(data);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      await api.post("/admin/auth/login", { username, password });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await api.post("/admin/auth/logout");
    setAdmin(null);
  }, []);

  return { admin, loading, login, logout, refresh };
}
