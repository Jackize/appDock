package middleware

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// defaultWSAllowedOrigins matches typical AppDock dev (Vite + unified image) and local API.
var defaultWSAllowedOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:8080",
	"http://127.0.0.1:8080",
}

// WebSocketCheckOrigin returns gorilla/websocket Upgrader.CheckOrigin.
// Allows: (1) empty Origin, (2) exact match on APPDOCK_WS_ALLOWED_ORIGINS (comma-separated),
// (3) when unset, default dev origins, (4) any Origin whose host equals the request Host
// (same-origin deployments, including HTTPS/WSS).
// Set APPDOCK_WS_ALLOW_INSECURE_ORIGINS=true only for exceptional debugging (allows any Origin).
func WebSocketCheckOrigin() func(r *http.Request) bool {
	return func(r *http.Request) bool {
		if strings.TrimSpace(os.Getenv("APPDOCK_WS_ALLOW_INSECURE_ORIGINS")) == "true" {
			return true
		}
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			return true
		}

		allowed := wsAllowedOriginsList()
		for _, o := range allowed {
			if strings.EqualFold(origin, o) {
				return true
			}
		}

		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return strings.EqualFold(u.Host, r.Host)
	}
}

func wsAllowedOriginsList() []string {
	raw := strings.TrimSpace(os.Getenv("APPDOCK_WS_ALLOWED_ORIGINS"))
	if raw == "" {
		return defaultWSAllowedOrigins
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return defaultWSAllowedOrigins
	}
	return out
}
