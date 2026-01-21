import { Button } from "@/components/ui/Button";
import { Circle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TerminalViewProps {
  containerId: string;
  containerName: string;
}

interface TerminalLine {
  id: number;
  content: string;
  type: "input" | "output" | "error" | "system";
}

export function TerminalView({ containerId, containerName }: TerminalViewProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lineIdRef = useRef(0);

  const addLine = useCallback((content: string, type: TerminalLine["type"]) => {
    setLines((prev) => {
      const newLine: TerminalLine = {
        id: lineIdRef.current++,
        content,
        type,
      };
      // Keep last 2000 lines
      return [...prev, newLine].slice(-2000);
    });
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/containers/${containerId}/exec`;

    const connect = () => {
      addLine(`Đang kết nối tới container ${containerName}...`, "system");

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        addLine("Đã kết nối thành công!", "system");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "output" && data.data) {
            // Split by newlines and add each line
            const outputLines = data.data.split(/\r?\n/);
            outputLines.forEach((line: string) => {
              if (line.trim()) {
                addLine(line, "output");
              }
            });
          } else if (data.type === "error") {
            addLine(data.data, "error");
          }
        } catch {
          // Plain text
          if (event.data.trim()) {
            addLine(event.data, "output");
          }
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        addLine("Kết nối đã đóng", "system");
      };

      wsRef.current.onerror = () => {
        setIsConnected(false);
        addLine("Lỗi kết nối", "error");
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [containerId, containerName, addLine]);

  // Auto scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const sendCommand = (command: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLine("Không thể gửi lệnh - chưa kết nối", "error");
      return;
    }

    // Add to history
    if (command.trim()) {
      setHistory((prev) => [...prev.filter((h) => h !== command), command]);
      setHistoryIndex(-1);
    }

    // Display input
    addLine(`$ ${command}`, "input");

    // Send to WebSocket
    wsRef.current.send(
      JSON.stringify({
        type: "input",
        data: command + "\n",
      })
    );

    setCurrentInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendCommand(currentInput);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex =
          historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(history[history.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(history[history.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput("");
      }
    } else if (e.key === "c" && e.ctrlKey) {
      // Ctrl+C
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: "\x03", // Ctrl+C character
          })
        );
        addLine("^C", "input");
        setCurrentInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      // Ctrl+L to clear
      e.preventDefault();
      setLines([]);
    }
  };

  const handleClear = () => {
    setLines([]);
    lineIdRef.current = 0;
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input":
        return "text-accent";
      case "error":
        return "text-red-400";
      case "system":
        return "text-yellow-400";
      default:
        return "text-text-primary";
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#1a1b26] text-gray-100"
      onClick={focusInput}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-elevated">
        <div className="flex items-center gap-2">
          <Circle
            className={`w-2 h-2 ${isConnected ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`}
          />
          <span className="text-sm text-text-muted">
            {isConnected ? "Đang kết nối" : "Mất kết nối"}
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

      {/* Terminal content */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-auto font-mono text-sm p-3 space-y-0.5"
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all ${getLineColor(line.type)}`}
          >
            {line.content}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center">
          <span className="text-accent select-none">$ </span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-text-primary font-mono caret-accent"
            autoFocus
            disabled={!isConnected}
            placeholder={isConnected ? "" : "Đang chờ kết nối..."}
          />
        </div>
      </div>

      {/* Help hint */}
      <div className="px-3 py-1 text-xs text-text-muted border-t border-border bg-background-elevated">
        <span className="mr-4">↑↓ Lịch sử lệnh</span>
        <span className="mr-4">Ctrl+C Hủy</span>
        <span>Ctrl+L Xóa</span>
      </div>
    </div>
  );
}
