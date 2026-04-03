package handlers

import (
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/sensors"
)

type SystemHandler struct{}

func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

type SystemStats struct {
	CPUUsage       float64  `json:"cpuUsage"`
	CPUCores       int      `json:"cpuCores"`
	CPUTemperature *float64 `json:"cpuTemperature,omitempty"`
	MemoryTotal    uint64   `json:"memoryTotal"`
	MemoryUsed     uint64   `json:"memoryUsed"`
	MemoryFree     uint64   `json:"memoryFree"`
	MemoryCached   uint64   `json:"memoryCached"`
	MemoryUsage    float64  `json:"memoryUsage"`
	DiskTotal      uint64   `json:"diskTotal"`
	DiskUsed       uint64   `json:"diskUsed"`
	DiskFree       uint64   `json:"diskFree"`
	DiskUsage      float64  `json:"diskUsage"`
}

type SystemInfo struct {
	Hostname     string `json:"hostname"`
	OS           string `json:"os"`
	Platform     string `json:"platform"`
	Architecture string `json:"architecture"`
	CPUModel     string `json:"cpuModel"`
	CPUCores     int    `json:"cpuCores"`
	Uptime       uint64 `json:"uptime"`
	BootTime     uint64 `json:"bootTime"`
}

func (h *SystemHandler) GetStats(c *gin.Context) {
	stats := SystemStats{
		CPUCores: runtime.NumCPU(),
	}

	// CPU Usage
	cpuPercents, err := cpu.Percent(100*time.Millisecond, false)
	if err == nil && len(cpuPercents) > 0 {
		stats.CPUUsage = cpuPercents[0]
	}

	// Memory
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		stats.MemoryTotal = vmStat.Total
		stats.MemoryUsed = vmStat.Used
		stats.MemoryFree = vmStat.Free
		stats.MemoryCached = vmStat.Cached + vmStat.Buffers
		stats.MemoryUsage = vmStat.UsedPercent
	}

	// Disk
	diskStat, err := disk.Usage("/")
	if err == nil {
		stats.DiskTotal = diskStat.Total
		stats.DiskUsed = diskStat.Used
		stats.DiskFree = diskStat.Free
		stats.DiskUsage = diskStat.UsedPercent
	}

	// CPU Temperature
	temps, err := sensors.SensorsTemperatures()
	if err == nil && len(temps) > 0 {
		for _, t := range temps {
			if t.SensorKey == "coretemp_packageid0_input" ||
				t.SensorKey == "k10temp_tctl_input" ||
				t.SensorKey == "cpu_thermal_input" ||
				t.SensorKey == "acpitz_input" {
				stats.CPUTemperature = &t.Temperature
				break
			}
		}
		if stats.CPUTemperature == nil {
			for _, t := range temps {
				if t.Temperature > 0 {
					stats.CPUTemperature = &t.Temperature
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, stats)
}

func (h *SystemHandler) GetInfo(c *gin.Context) {
	info := SystemInfo{
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		CPUCores:     runtime.NumCPU(),
	}

	// Hostname
	hostname, err := os.Hostname()
	if err == nil {
		info.Hostname = hostname
	}

	// Host info
	hostInfo, err := host.Info()
	if err == nil {
		info.Platform = hostInfo.Platform
		info.Uptime = hostInfo.Uptime
		info.BootTime = hostInfo.BootTime
	}

	// CPU Model
	cpuInfo, err := cpu.Info()
	if err == nil && len(cpuInfo) > 0 {
		info.CPUModel = cpuInfo[0].ModelName
	}

	c.JSON(http.StatusOK, info)
}
