import { Button } from "@/components/ui/Button";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LogViewerProps {
  containerId: string;
  containerName: string;
}

interface LogMessage {
  id: number;
  timestamp: string;
  content: string;
  type: "stdout" | "stderr";
}

export function LogViewer({ containerId, containerName }: LogViewerProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [status, setStatus] = useState<"loading" | "streaming" | "static">("loading");
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logIdRef = useRef(0);
  const isPausedRef = useRef(isPaused);
  const isMountedRef = useRef(true);

  // Keep isPausedRef in sync
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Parse log line helper
  const parseLogLine = (line: string): LogMessage | null => {
    if (!line.trim()) return null;
    
    // Parse timestamp if present
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s*(.*)$/);
    const timestamp = match ? match[1] : new Date().toISOString();
    const content = match ? match[2] : line;
    
    if (!content.trim()) return null;
    
    return {
      id: logIdRef.current++,
      timestamp,
      content,
      type: "stdout",
    };
  };

  useEffect(() => {
    isMountedRef.current = true;
    logIdRef.current = 0;
    setLogs([]);
    setStatus("loading");
    setIsStreaming(false);

    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // First, fetch existing logs via REST API
    const fetchInitialLogs = async () => {
      try {
        const response = await fetch(
          `/api/containers/${containerId}/logs?tail=500`
        );
        if (!response.ok) throw new Error("Failed to fetch logs");
        
        const data = await response.json();
        if (!isMountedRef.current) return;
        
        if (data.logs) {
          const lines = data.logs.split("\n").filter((l: string) => l.trim());
          const parsedLogs = lines
            .map((line: string) => parseLogLine(line))
            .filter((log: LogMessage | null): log is LogMessage => log !== null);
          
          setLogs(parsedLogs);
        }
      } catch (error) {
        console.error("Error fetching initial logs:", error);
      }
    };

    // Then try to connect WebSocket for streaming
    const connectWebSocket = () => {
      // Double check we don't have an existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/containers/${containerId}/logs`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current || wsRef.current !== ws) return;
        setIsStreaming(true);
        setStatus("streaming");
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current || wsRef.current !== ws) return;

        try {
          const data = JSON.parse(event.data);
          
          // Handle closed message from server
          if (data.type === "closed") {
            setIsStreaming(false);
            setStatus("static");
            return;
          }
          
          // Handle error message
          if (data.error) {
            console.error("WebSocket error:", data.error);
            setIsStreaming(false);
            setStatus("static");
            return;
          }
          
          // Handle log message
          if (data.type === "log" && data.data && !isPausedRef.current) {
            const newLog = parseLogLine(data.data);
            if (newLog) {
              setLogs((prev) => [...prev, newLog].slice(-500));
            }
          }
        } catch {
          // Plain text - try to parse as log
          if (!isPausedRef.current) {
            const newLog = parseLogLine(event.data);
            if (newLog) {
              setLogs((prev) => [...prev, newLog].slice(-500));
            }
          }
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current || wsRef.current !== ws) return;
        setIsStreaming(false);
        setStatus("static");
      };

      ws.onerror = () => {
        if (!isMountedRef.current || wsRef.current !== ws) return;
        setIsStreaming(false);
        setStatus("static");
      };
    };

    // Execute: fetch logs first, then try streaming
    fetchInitialLogs().then(() => {
      if (isMountedRef.current) {
        connectWebSocket();
      }
    });

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [containerId]);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    setLogs([]);
    logIdRef.current = 0;
  };

  const handleDownload = () => {
    const content = logs.map((l) => `${l.timestamp} ${l.content}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${containerName}-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case "loading":
        return { color: "bg-yellow-500 animate-pulse", text: "Đang tải..." };
      case "streaming":
        return { color: "bg-green-500", text: "Live" };
      case "static":
        return { color: "bg-gray-500", text: "Logs tĩnh" };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex flex-col h-full bg-[#1a1b26]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-[#16161e]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
          <span className="text-sm text-gray-400">{statusInfo.text}</span>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm text-gray-400">{logs.length} dòng</span>
          {isPaused && isStreaming && (
            <>
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm text-yellow-400">Tạm dừng</span>
            </>
          )}
        </div>
        <Tooltip.Provider delayDuration={200}>
          <div className="flex items-center gap-1">
            {isStreaming && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="bg-gray-900 text-gray-100 px-3 py-2 rounded-lg text-sm shadow-lg border border-gray-700 z-50"
                    sideOffset={5}
                  >
                    {isPaused ? "Tiếp tục nhận logs mới" : "Tạm dừng nhận logs"}
                    <Tooltip.Arrow className="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
            
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={logs.length === 0}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-gray-100 px-3 py-2 rounded-lg text-sm shadow-lg border border-gray-700 z-50"
                  sideOffset={5}
                >
                  Tải xuống logs (.txt)
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-gray-100 px-3 py-2 rounded-lg text-sm shadow-lg border border-gray-700 z-50"
                  sideOffset={5}
                >
                  Xóa tất cả logs
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </Tooltip.Provider>
      </div>

      {/* Logs content */}
      <div
        className="flex-1 overflow-auto font-mono text-xs p-3 space-y-0.5 bg-[#1a1b26]"
        onScroll={(e) => {
          const target = e.currentTarget;
          const atBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 50;
          setAutoScroll(atBottom);
        }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {status === "loading" ? "Đang tải logs..." : "Không có logs"}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex hover:bg-white/5 rounded px-1">
              <span className="text-gray-500 w-20 flex-shrink-0 select-none">
                {formatTime(log.timestamp)}
              </span>
              <span className="text-gray-200 whitespace-pre-wrap break-all">
                {log.content}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Auto scroll indicator */}
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-16 right-4 px-3 py-1.5 bg-accent text-white rounded-full text-xs shadow-lg hover:bg-accent-hover transition-colors"
        >
          ↓ Logs mới
        </button>
      )}
    </div>
  );
}
