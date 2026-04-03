import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Server } from "@/types";
import { setCurrentServerId } from "@/services/api";

interface ServerState {
  servers: Server[];
  currentServerId: string;
  isLoading: boolean;
  error: string | null;

  setServers: (servers: Server[]) => void;
  setCurrentServer: (id: string) => void;
  getCurrentServer: () => Server | undefined;
  addServer: (server: Server) => void;
  updateServer: (id: string, server: Partial<Server>) => void;
  removeServer: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: [],
      currentServerId: "local",
      isLoading: false,
      error: null,

      setServers: (servers) => {
        set({ servers });
        // Ensure current server still exists
        const state = get();
        const exists = servers.some((s) => s.id === state.currentServerId);
        if (!exists) {
          const defaultServer = servers.find((s) => s.isDefault) || servers[0];
          if (defaultServer) {
            set({ currentServerId: defaultServer.id });
            setCurrentServerId(defaultServer.id);
          }
        }
      },

      setCurrentServer: (id) => {
        set({ currentServerId: id });
        setCurrentServerId(id);
      },

      getCurrentServer: () => {
        const state = get();
        return state.servers.find((s) => s.id === state.currentServerId);
      },

      addServer: (server) => {
        set((state) => ({
          servers: [...state.servers, server],
        }));
      },

      updateServer: (id, updates) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      removeServer: (id) => {
        const state = get();
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
        }));
        // If we removed the current server, switch to local
        if (state.currentServerId === id) {
          set({ currentServerId: "local" });
          setCurrentServerId("local");
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),
    }),
    {
      name: "appdock-server-storage",
      partialize: (state) => ({
        currentServerId: state.currentServerId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setCurrentServerId(state.currentServerId);
        }
      },
    }
  )
);
