package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"appdock/internal/handlers"
	"appdock/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Khởi tạo Docker service
	dockerService, err := services.NewDockerService()
	if err != nil {
		log.Fatalf("Không thể kết nối tới Docker: %v", err)
	}
	defer dockerService.Close()

	// Khởi tạo handlers
	containerHandler := handlers.NewContainerHandler(dockerService)
	imageHandler := handlers.NewImageHandler(dockerService)
	networkHandler := handlers.NewNetworkHandler(dockerService)
	volumeHandler := handlers.NewVolumeHandler(dockerService)
	systemHandler := handlers.NewSystemHandler(dockerService)

	// Khởi tạo Gin router
	router := gin.Default()

	// CORS configuration (chỉ cần cho development mode)
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173", "http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	router.Use(cors.New(config))

	// API routes
	api := router.Group("/api")
	{
		// System
		api.GET("/system/info", systemHandler.GetSystemInfo)
		api.GET("/system/stats", systemHandler.GetSystemStats)

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

	// WebSocket cho real-time logs và terminal
	router.GET("/ws/containers/:id/logs", containerHandler.StreamLogs)
	router.GET("/ws/containers/:id/exec", containerHandler.ExecTerminal)

	// Serve static files (Frontend) - cho production mode
	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "./static" // Mặc định là ./static
	}

	// Kiểm tra xem có thư mục static không (production mode)
	if _, err := os.Stat(staticPath); err == nil {
		log.Printf("📁 Serving static files from: %s", staticPath)

		// Serve static assets (JS, CSS, images, etc.)
		router.Static("/assets", filepath.Join(staticPath, "assets"))

		// Serve favicon và các file static khác ở root
		router.StaticFile("/favicon.ico", filepath.Join(staticPath, "favicon.ico"))
		router.StaticFile("/vite.svg", filepath.Join(staticPath, "vite.svg"))

		// SPA fallback - serve index.html cho tất cả routes không match
		router.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			// Nếu là API hoặc WebSocket request thì return 404
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") {
				c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
				return
			}

			// Serve index.html cho SPA routing
			c.File(filepath.Join(staticPath, "index.html"))
		})
	} else {
		log.Printf("⚠️  Static folder not found at %s - Running in API-only mode", staticPath)
	}

	// Lấy port từ environment hoặc mặc định 3000 (unified port)
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 AppDock đang chạy tại http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Không thể khởi động server: %v", err)
	}
}
