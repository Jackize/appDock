import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  username: string
}

export interface AuthState {
  // State
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authEnabled: boolean | null // null = chưa biết

  // Actions
  setToken: (token: string, username: string) => void
  setAuthEnabled: (enabled: boolean) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  initialize: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,
      authEnabled: null,

      // Set token after login
      setToken: (token: string, username: string) => {
        set({
          token,
          user: { username },
          isAuthenticated: true,
          isLoading: false,
        })
      },

      // Set whether auth is enabled on the server
      setAuthEnabled: (enabled: boolean) => {
        set({ authEnabled: enabled })
        // If auth is disabled, user is automatically authenticated
        if (!enabled) {
          set({
            isAuthenticated: true,
            isLoading: false,
          })
        }
      },

      // Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      // Logout
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
      },

      // Initialize auth state
      initialize: () => {
        const state = get()
        // If we have a token, we're authenticated
        if (state.token) {
          set({ isAuthenticated: true, isLoading: false })
        } else if (state.authEnabled === false) {
          // If auth is disabled, we're authenticated without token
          set({ isAuthenticated: true, isLoading: false })
        } else {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'appdock-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
)

// Helper to get token for API calls
export const getAuthToken = () => useAuthStore.getState().token
