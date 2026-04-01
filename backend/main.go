package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"appdock/internal/handlers"
	"appdock/internal/middleware"
	"appdock/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

//go:embed all:static
var embeddedStatic embed.FS

func main() {
	// Load .env file if exists (optional, won't error if not found)
	if err := godotenv.Load(); err != nil {
		log.Println("📝 No .env file found, using environment variables")
	} else {
		log.Println("📝 Loaded configuration from .env file")
	}
	// Initialize Docker service (gracefully handles Docker not running)
	dockerService, err := services.NewDockerService()
	if err != nil {
		log.Printf("⚠️  Warning: Could not initialize Docker service: %v", err)
	}
	if dockerService.IsConnected() {
		log.Println("🐳 Connected to Docker daemon")
	} else {
		log.Println("⚠️  Docker is not running - system stats will still work, but Docker operations will be unavailable")
	}
	
	// Start background health check to detect Docker status changes
	dockerService.OnStatusChange(func(connected bool) {
		if connected {
			log.Println("🐳 Docker daemon is now available")
		} else {
			log.Println("⚠️  Docker daemon disconnected")
		}
	})
	dockerService.StartHealthCheck(5 * time.Second)
	defer dockerService.Close()

	// Khởi tạo Auth service
	authService := services.NewAuthService()

	// Khởi tạo Stats History service
	dataDir := os.Getenv("APPDOCK_DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	statsHistoryService := services.NewStatsHistoryService(dataDir)
	defer statsHistoryService.Close()

	// Start stats collection goroutine
	statsCollectorCtx, statsCollectorCancel := context.WithCancel(context.Background())
	go collectStats(statsCollectorCtx, dockerService, statsHistoryService)

	// Khởi tạo handlers
	containerHandler := handlers.NewContainerHandler(dockerService)
	imageHandler := handlers.NewImageHandler(dockerService)
	networkHandler := handlers.NewNetworkHandler(dockerService)
	volumeHandler := handlers.NewVolumeHandler(dockerService)
	systemHandler := handlers.NewSystemHandler(dockerService, statsHistoryService)
	authHandler := handlers.NewAuthHandler(authService)

	// Khởi tạo Gin router
	router := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173", "http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	router.Use(cors.New(config))

	// Auth status và login (public routes - không cần auth)
	router.GET("/api/auth/status", authHandler.GetAuthStatus)
	router.POST("/api/auth/login", authHandler.Login)

	// API routes (protected)
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(authService))
	{
		// Auth routes (cần đăng nhập)
		api.POST("/auth/refresh", authHandler.RefreshToken)
		api.GET("/auth/me", authHandler.GetMe)
		api.POST("/auth/change-password", authHandler.ChangePassword)

		// System
		api.GET("/system/info", systemHandler.GetSystemInfo)
		api.GET("/system/stats", systemHandler.GetSystemStats)
		api.GET("/system/stats/history", systemHandler.GetStatsHistory)
		api.GET("/system/docker-status", systemHandler.GetDockerStatus)

		// Containers
		containers := api.Group("/containers")
		{
			containers.GET("", containerHandler.ListContainers)
			containers.GET("/:id", containerHandler.GetContainer)
			containers.POST("/:id/start", containerHandler.StartContainer)
			containers.POST("/:id/stop", containerHandler.StopContainer)
			containers.POST("/:id/restart", containerHandler.RestartContainer)
			containers.DELETE("/:id", containerHandler.RemoveContainer)
			containers.GET("/:id/logs", containerHandler.GetContainerLogs)
			containers.GET("/:id/stats", containerHandler.GetContainerStats)
		}

		// Images
		images := api.Group("/images")
		{
			images.GET("", imageHandler.ListImages)
			images.POST("/pull", imageHandler.PullImage)
			images.DELETE("/bulk", imageHandler.RemoveImages) // Bulk delete - phải đặt trước /:id
			images.GET("/:id", imageHandler.GetImage)
			images.DELETE("/:id", imageHandler.RemoveImage)
		}

		// Networks
		networks := api.Group("/networks")
		{
			networks.GET("", networkHandler.ListNetworks)
			networks.GET("/:id", networkHandler.GetNetwork)
			networks.POST("", networkHandler.CreateNetwork)
			networks.DELETE("/:id", networkHandler.RemoveNetwork)
		}

		// Volumes
		volumes := api.Group("/volumes")
		{
			volumes.GET("", volumeHandler.ListVolumes)
			volumes.GET("/:name", volumeHandler.GetVolume)
			volumes.POST("", volumeHandler.CreateVolume)
			volumes.DELETE("/:name", volumeHandler.RemoveVolume)
		}
	}

	// WebSocket cho real-time logs và terminal (protected với WebSocket auth)
	ws := router.Group("/ws")
	ws.Use(middleware.WebSocketAuthMiddleware(authService))
	{
		ws.GET("/containers/:id/logs", containerHandler.StreamLogs)
		ws.GET("/containers/:id/exec", containerHandler.ExecTerminal)
	}

	// Serve static files (Frontend)
	// Priority: embedded static > ./static folder > API-only mode
	var staticFS http.FileSystem
	if sub, err := fs.Sub(embeddedStatic, "static"); err == nil {
		// Check if embedded FS has actual content (index.html)
		if f, err := sub.Open("index.html"); err == nil {
			f.Close()
			staticFS = http.FS(sub)
			log.Printf("📦 Serving embedded static files")
		}
	}
	if staticFS == nil {
		if _, err := os.Stat("./static"); err == nil {
			staticFS = http.Dir("./static")
			log.Printf("📁 Serving static files from ./static")
		}
	}

	if staticFS != nil {
		router.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") {
				c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
				return
			}
			// Try to serve the file, fallback to index.html for SPA routing
			f, err := staticFS.Open(path)
			if err != nil {
				c.FileFromFS("index.html", staticFS)
				return
			}
			f.Close()
			c.FileFromFS(path, staticFS)
		})
	} else {
		log.Printf("⚠️  No static files found - Running in API-only mode")
	}

	// Lấy port từ environment hoặc mặc định 3000 (unified port)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Log auth status
	if authService.IsAuthEnabled() {
		log.Printf("🔐 Authentication: ENABLED (user: %s) (password: %s)", authService.GetCurrentUser(), authService.GetPassword())
	} else {
		log.Printf("⚠️  Authentication: DISABLED")
	}

	log.Printf("🚀 AppDock đang chạy tại http://localhost:%s", port)

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Không thể khởi động server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Đang tắt server...")

	// Stop stats collector
	statsCollectorCancel()

	// Shutdown server with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("✅ Server đã tắt")
}

// collectStats periodically collects system stats and adds to history
func collectStats(ctx context.Context, ds *services.DockerService, shs *services.StatsHistoryService) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Collect immediately on start
	collectAndAddPoint(ds, shs)

	for {
		select {
		case <-ticker.C:
			collectAndAddPoint(ds, shs)
		case <-ctx.Done():
			return
		}
	}
}

func collectAndAddPoint(ds *services.DockerService, shs *services.StatsHistoryService) {
	stats, err := ds.GetSystemStats()
	if err != nil {
		return
	}

	total := float64(stats.MemoryTotal)
	if total == 0 {
		total = 1
	}

	memUsedPct := (float64(stats.MemoryUsed) / total) * 100
	memCachedPct := (float64(stats.MemoryCached) / total) * 100
	memFreePct := 100 - memUsedPct - memCachedPct
	if memFreePct < 0 {
		memFreePct = 0
	}

	point := services.ChartPoint{
		Time:      time.Now().Format("15:04:05"),
		CPU:       stats.CPUUsage,
		Disk:      stats.DiskUsage,
		MemUsed:   memUsedPct,
		MemCached: memCachedPct,
		MemFree:   memFreePct,
	}

	shs.AddPoint(point)
}
