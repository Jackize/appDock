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
  Thermometer,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const getTimeLabel = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

type ChartPoint = {
  time: string;
  cpu: number;
  disk: number;
  memUsed: number;
  memCached: number;
  memFree: number;
};

const buildInitialChart = (): ChartPoint[] =>
  Array.from({ length: 20 }, () => ({
    time: getTimeLabel(),
    cpu: 0,
    disk: 0,
    memUsed: 0,
    memCached: 0,
    memFree: 100,
  }));

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useSystemStats();
  const { data: containers } = useContainers();
  const [chartData, setChartData] = useState<ChartPoint[]>(buildInitialChart);

  // Append real stats to chart whenever stats refetches
  useEffect(() => {
    if (!stats) return;
    const total = stats.memoryTotal || 1;
    const memUsedPct = parseFloat(((stats.memoryUsed / total) * 100).toFixed(1));
    const memCachedPct = parseFloat(((stats.memoryCached / total) * 100).toFixed(1));
    const memFreePct = parseFloat((100 - memUsedPct - memCachedPct).toFixed(1));

    setChartData((prev) => [
      ...prev.slice(1),
      {
        time: getTimeLabel(),
        cpu: parseFloat(stats.cpuUsage.toFixed(1)),
        disk: parseFloat(stats.diskUsage.toFixed(1)),
        memUsed: memUsedPct,
        memCached: memCachedPct,
        memFree: Math.max(0, memFreePct),
      },
    ]);
  }, [stats]);

  // Temperature gauge data
  const tempValue = stats?.cpuTemperature ?? 0;
  const getTempColor = (temp: number) => {
    if (temp < 60) return "#3b82f6"; // blue
    if (temp <= 80) return "#eab308"; // yellow
    return "#ef4444"; // red
  };
  const tempGaugeData = [
    { name: "temp", value: Math.min(tempValue, 100) },
    { name: "empty", value: Math.max(0, 100 - tempValue) },
  ];

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
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    unit="%"
                    domain={[0, 100]}
                  />
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

        {/* Memory Usage Chart - Stacked Area */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MemoryStick className="w-5 h-5 text-accent-teal" />
              <CardTitle>Sử dụng Memory</CardTitle>
              {stats && (
                <span className="text-sm text-text-muted ml-auto">
                  {formatBytes(stats.memoryTotal)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} stackOffset="none">
                  <defs>
                    <linearGradient id="memUsedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="memCachedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="memFreeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d353f" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1f26",
                      border: "1px solid #2d353f",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        memUsed: "Used",
                        memCached: "Cached",
                        memFree: "Free",
                      };
                      return [`${value}%`, labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        memUsed: "Used",
                        memCached: "Cached",
                        memFree: "Free",
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="memUsed"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#memUsedGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="memCached"
                    stackId="1"
                    stroke="#eab308"
                    fill="url(#memCachedGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="memFree"
                    stackId="1"
                    stroke="#22c55e"
                    fill="url(#memFreeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* CPU Temperature Gauge */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-500" />
              <CardTitle>Nhiệt độ CPU</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {stats?.cpuTemperature != null ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="tempGaugeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="60%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={tempGaugeData}
                      cx="50%"
                      cy="70%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={getTempColor(tempValue)} />
                      <Cell fill="#2d353f" />
                    </Pie>
                    <text
                      x="50%"
                      y="65%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-3xl font-bold"
                      fill={getTempColor(tempValue)}
                    >
                      {tempValue.toFixed(1)}°C
                    </text>
                    <text
                      x="50%"
                      y="80%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-sm"
                      fill="#64748b"
                    >
                      {tempValue < 60 ? "Normal" : tempValue <= 80 ? "Warm" : "Hot"}
                    </text>
                    {/* Scale labels */}
                    <text x="12%" y="72%" textAnchor="middle" fill="#64748b" fontSize={12}>0°C</text>
                    <text x="88%" y="72%" textAnchor="middle" fill="#64748b" fontSize={12}>100°C</text>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  <div className="text-center">
                    <Thermometer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Không có dữ liệu nhiệt độ</p>
                    <p className="text-sm">Cần cài đặt lm-sensors</p>
                  </div>
                </div>
              )}
            </div>
            {/* Color legend */}
            {stats?.cpuTemperature != null && (
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-text-muted">&lt;60°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-text-muted">60-80°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-text-muted">&gt;80°C</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disk Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-purple-500" />
              <CardTitle>Sử dụng Disk</CardTitle>
              {stats && (
                <span className="text-sm text-text-muted ml-auto">
                  {formatBytes(stats.diskUsed)} / {formatBytes(stats.diskTotal)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="diskGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d353f" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1f26",
                      border: "1px solid #2d353f",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(value: number) => [`${value}%`, "Disk"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="disk"
                    stroke="#a855f7"
                    fillOpacity={1}
                    fill="url(#diskGradient)"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-3 rounded-lg bg-background-tertiary">
                <p className="text-sm text-text-secondary">Bộ nhớ RAM</p>
                <p className="text-lg font-semibold text-text-primary">
                  {formatBytes(stats.memoryTotal)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-500" />
                  <p className="text-sm text-text-secondary">Disk</p>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  {formatBytes(stats.diskUsed)} / {formatBytes(stats.diskTotal)}
                </p>
                <div className="mt-1 w-full bg-background-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      stats.diskUsage > 90
                        ? "bg-red-500"
                        : stats.diskUsage > 70
                        ? "bg-orange-500"
                        : "bg-purple-500"
                    }`}
                    style={{ width: `${stats.diskUsage}%` }}
                  />
                </div>
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
              <div className="p-3 rounded-lg bg-background-tertiary">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <p className="text-sm text-text-secondary">CPU Temp</p>
                </div>
                <p className={`text-lg font-semibold ${
                  stats.cpuTemperature != null
                    ? stats.cpuTemperature > 80
                      ? "text-red-500"
                      : stats.cpuTemperature > 60
                      ? "text-orange-500"
                      : "text-green-500"
                    : "text-text-muted"
                }`}>
                  {stats.cpuTemperature != null
                    ? `${stats.cpuTemperature.toFixed(1)}°C`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
