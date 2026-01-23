import { cn } from "@/lib/utils";
import { Tab, useAppStore } from "@/stores/appStore";
import { ChevronDown, FileText, Maximize2, Terminal, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { LogViewer } from "./LogViewer";
import { TerminalView } from "./TerminalView";

export function TabsPanel() {
  const {
    tabs,
    activeTabId,
    tabsPanelOpen,
    tabsPanelHeight,
    closeTab,
    setActiveTab,
    toggleTabsPanel,
    setTabsPanelHeight,
    closeAllTabs,
  } = useAppStore();

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = tabsPanelHeight;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = startY - e.clientY;
        const newHeight = Math.min(Math.max(startHeight + deltaY, 150), 600);
        setTabsPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [tabsPanelHeight, setTabsPanelHeight]
  );

  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const getTabIcon = (tab: Tab) => {
    return tab.type === "logs" ? (
      <FileText className="w-3.5 h-3.5" />
    ) : (
      <Terminal className="w-3.5 h-3.5" />
    );
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 border-t border-border shadow-2xl z-40 transition-all duration-200",
        tabsPanelOpen ? "" : "translate-y-[calc(100%-40px)]"
      )}
      style={{
        height: tabsPanelHeight,
        backgroundColor: "var(--color-background-card, #1f2937)",
        opacity: 1,
      }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 cursor-ns-resize bg-transparent hover:bg-accent/50 transition-colors",
          isResizing && "bg-accent"
        )}
        onMouseDown={handleMouseDown}
      />

      {/* Tab bar */}
      <div className="flex items-center h-10 px-2 border-b border-border" style={{ backgroundColor: "#0f1117" }}>
        {/* Tabs */}
        <div className="flex items-center gap-0.5 flex-1 scrollbar-hide bg-opacity-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (!tabsPanelOpen) {
                  toggleTabsPanel();
                }
              }}
              className={cn(
                "group flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-lg transition-colors whitespace-nowrap",
                activeTabId === tab.id
                  ? "text-text-primary border-t border-l border-r border-border -mb-px"
                  : "text-text-muted hover:text-text-primary hover:opacity-80"
              )}
              style={
                activeTabId === tab.id
                  ? { backgroundColor: "#2d3139" }
                  : { backgroundColor: "#161b22" }
              }           >
              {getTabIcon(tab)}
              <span className="max-w-32 truncate">{tab.containerName}</span>
              <span className="text-xs text-text-muted">
                {tab.type === "logs" ? "Logs" : "Terminal"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-background-hover opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={toggleTabsPanel}
            className="p-1.5 rounded hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors"
            title={tabsPanelOpen ? "Thu nhỏ" : "Mở rộng"}
          >
            {tabsPanelOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={closeAllTabs}
            className="p-1.5 rounded hover:bg-background-hover text-text-muted hover:text-text-primary transition-colors"
            title="Đóng tất cả"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab content - Render tất cả tabs, chỉ ẩn/hiện bằng CSS để giữ WebSocket connections */}
      <div className="h-[calc(100%-40px)] overflow-hidden relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0",
              activeTabId === tab.id ? "z-10 visible" : "z-0 invisible"
            )}
          >
            {tab.type === "logs" ? (
              <LogViewer
                containerId={tab.containerId}
                containerName={tab.containerName}
              />
            ) : (
              <TerminalView
                containerId={tab.containerId}
                containerName={tab.containerName}
                isActive={activeTabId === tab.id}
              />
            )}
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted">
            Chọn một tab để xem nội dung
          </div>
        )}
      </div>
    </div>
  );
}
