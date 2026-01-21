import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useContainers, useSystemStats } from "@/hooks/useDocker";
import { formatBytes } from "@/lib/utils";
import {
  Activity,
  Container,
  Cpu,
  HardDrive,
  Image,
  MemoryStick,
  Network,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Mock data for charts - in production, this would come from real-time stats
const generateChartData = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 5}s`,
    cpu: Math.random() * 30 + 10,
    memory: Math.random() * 20 + 40,
  }));
};

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useSystemStats();
  const { data: containers } = useContainers();
  const [chartData, setChartData] = useState(generateChartData());

  // Simulate real-time chart updates
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) => {
        const newData = [
          ...prev.slice(1),
          {
            time: `${parseInt(prev[prev.length - 1].time) + 5}s`,
            cpu: Math.random() * 30 + 10,
            memory: Math.random() * 20 + 40,
          },
        ];
        return newData;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: "Containers",
      value: stats
        ? `${stats.containersRunning}/${
            stats.containersRunning + stats.containersStopped
          }`
        : "-",
      subtitle: "Đang chạy / Tổng",
      icon: Container,
      color: "from-accent to-accent-dark",
      iconBg: "bg-accent/20",
    },
    {
      title: "Images",
      value: stats?.imagesCount ?? "-",
      subtitle: "Images có sẵn",
      icon: Image,
      color: "from-accent-teal to-accent-cyan",
      iconBg: "bg-accent-teal/20",
    },
    {
      title: "Networks",
      value: stats?.networksCount ?? "-",
      subtitle: "Mạng được cấu hình",
      icon: Network,
      color: "from-status-paused to-orange-500",
      iconBg: "bg-status-paused/20",
    },
    {
      title: "Volumes",
      value: stats?.volumesCount ?? "-",
      subtitle: "Lưu trữ dữ liệu",
      icon: HardDrive,
      color: "from-status-created to-pink-500",
      iconBg: "bg-status-created/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Tổng quan</h1>
        <p className="text-text-secondary mt-1">
          Theo dõi và quản lý Docker của bạn
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
              <Card key={card.title} className="relative overflow-hidden">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-text-secondary">
                        {card.title}
                      </p>
                      <p className="text-3xl font-bold text-text-primary mt-1">
                        {card.value}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {card.subtitle}
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}
                    >
                      <card.icon className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                </CardContent>
                {/* Gradient line at bottom */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color}`}
                />
              </Card>
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent" />
              <CardTitle>Sử dụng CPU</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="cpuGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d353f" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1f26",
                      border: "1px solid #2d353f",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="#0ea5e9"
                    fillOpacity={1}
                    fill="url(#cpuGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MemoryStick className="w-5 h-5 text-accent-teal" />
              <CardTitle>Sử dụng Memory</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="memGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d353f" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1f26",
                      border: "1px solid #2d353f",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stroke="#14b8a6"
                    fillOpacity={1}
                    fill="url(#memGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent containers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <CardTitle>Containers gần đây</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {containers && containers.length > 0 ? (
            <div className="space-y-3">
              {containers.slice(0, 5).map((container) => (
                <div
                  key={container.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background-tertiary hover:bg-background-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        container.state === "running"
                          ? "bg-status-running animate-pulse"
                          : "bg-status-stopped"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-text-primary">
                        {container.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {container.image}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-secondary">
                      {container.state === "running" ? "Đang chạy" : "Đã dừng"}
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                      {container.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted py-8">
              Chưa có container nào
            </p>
          )}
        </CardContent>
      </Card>

      {/* System info */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hệ thống</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-background-tertiary">
                <p className="text-sm text-text-secondary">Bộ nhớ tổng</p>
                <p className="text-lg font-semibold text-text-primary">
                  {formatBytes(stats.memoryTotal)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <p className="text-sm text-text-secondary">Container chạy</p>
                <p className="text-lg font-semibold text-status-running">
                  {stats.containersRunning}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <p className="text-sm text-text-secondary">Container dừng</p>
                <p className="text-lg font-semibold text-status-stopped">
                  {stats.containersStopped}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <p className="text-sm text-text-secondary">Images</p>
                <p className="text-lg font-semibold text-text-primary">
                  {stats.imagesCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

