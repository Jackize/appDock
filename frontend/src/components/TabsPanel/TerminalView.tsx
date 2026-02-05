import { Button } from "@/components/ui/Button";
import { getAuthToken } from "@/stores/authStore";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Circle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TerminalViewProps {
  containerId: string;
  containerName: string;
  isActive?: boolean;
}

export function TerminalView({ containerId, containerName, isActive = true }: TerminalViewProps) {
  const [isConnected, setIsConnected] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef<string>("");

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      rows: 30,
      cols: 80,
      theme: {
        background: "#1a1b26",
        foreground: "#e0e0e0",
        cursor: "#ffb86c",
        cursorAccent: "#1a1b26",
      },
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      allowProposedApi: true,
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    terminalInstanceRef.current = term;

    // Fit terminal to container (delay for visibility)
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.log("Initial fit error:", e);
      }
    }, 100);

    // Write initial message
    term.writeln("Đang kết nối tới container...");

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.log("Fit error:", e);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  // Re-fit terminal when becoming active (visible)
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          terminalInstanceRef.current?.focus();
        } catch (e) {
          console.log("Fit on active error:", e);
        }
      }, 50);
    }
  }, [isActive]);

  // Handle WebSocket connection
  useEffect(() => {
    const term = terminalInstanceRef.current;
    if (!term) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const wsUrl = `${protocol}//${host}/ws/containers/${containerId}/exec${tokenParam}`;

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        term.clear();
        term.writeln(`✓ Đã kết nối tới container: ${containerName}`);
        term.write("\r\n$ ");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "output" && data.data) {
            term.write(data.data);
          } else if (data.type === "error") {
            term.write(`\x1b[31m${data.data}\x1b[0m`); // Red color for errors
          }
        } catch {
          // Plain text
          if (event.data) {
            term.write(event.data);
          }
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        term.writeln("\r\n\n[Kết nối đã đóng]");
      };

      wsRef.current.onerror = () => {
        setIsConnected(false);
        term.writeln("\r\n\n[Lỗi kết nối]");
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [containerId, containerName]);

  // Handle terminal input
  useEffect(() => {
    const term = terminalInstanceRef.current;
    if (!term) return;

    const handleData = (data: string) => {
      const ws = wsRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        term.write("\x1b[31mKhông thể gửi lệnh - chưa kết nối\x1b[0m\r\n");
        return;
      }

      // Handle special keys
      if (data === "\r") {
        // Enter key
        term.write("\r\n");

        if (inputBufferRef.current.trim()) {
          ws.send(
            JSON.stringify({
              type: "input",
              data: inputBufferRef.current + "\n",
            })
          );
        }

        inputBufferRef.current = "";
        term.write("$ ");
      } else if (data === "\u007f") {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\u0003") {
        // Ctrl+C
        ws.send(
          JSON.stringify({
            type: "input",
            data: "\x03",
          })
        );
        term.write("^C\r\n$ ");
        inputBufferRef.current = "";
      } else if (data === "\u000c") {
        // Ctrl+L - clear screen
        term.clear();
        inputBufferRef.current = "";
        term.write("$ ");
      } else if (data.charCodeAt(0) >= 32 || data === "\t") {
        // Printable characters
        inputBufferRef.current += data;
        term.write(data);
      }
    };

    term.onData(handleData);
  }, []);

  const handleClear = () => {
    const term = terminalInstanceRef.current;
    if (term) {
      term.clear();
      term.write("$ ");
      inputBufferRef.current = "";
    }
  };

  const focusTerminal = () => {
    terminalInstanceRef.current?.focus();
  };

  return (
    <div
      className="flex flex-col h-full bg-[#1a1b26] text-gray-100"
      onClick={focusTerminal}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-elevated">
        <div className="flex items-center gap-2">
          <Circle
            className={`w-2 h-2 ${isConnected ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`}
          />
          <span className="text-sm text-text-muted">
            {isConnected ? "Đã kết nối" : "Mất kết nối"}
          </span>
          <span className="text-sm text-text-muted">•</span>
          <span className="text-sm text-text-muted font-mono">
            {containerName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleClear} title="Xóa terminal (Ctrl+L)">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden font-mono text-sm p-3 space-y-0.5"
        style={{
          backgroundColor: "#1a1b26",
        }}
      />

      {/* Help hint */}
      <div className="px-3 py-1 text-xs text-text-muted border-t border-border bg-background-elevated">
        <span className="mr-4">Ctrl+C Hủy</span>
        <span>Ctrl+L Xóa</span>
      </div>
    </div>
  );
}
