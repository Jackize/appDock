package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

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
	// Khởi tạo Docker service
	dockerService, err := services.NewDockerService()
	if err != nil {
		log.Fatalf("Không thể kết nối tới Docker: %v", err)
	}
	defer dockerService.Close()

	// Khởi tạo Auth service
	authService := services.NewAuthService()

	// Khởi tạo handlers
	containerHandler := handlers.NewContainerHandler(dockerService)
	imageHandler := handlers.NewImageHandler(dockerService)
	networkHandler := handlers.NewNetworkHandler(dockerService)
	volumeHandler := handlers.NewVolumeHandler(dockerService)
	systemHandler := handlers.NewSystemHandler(dockerService)
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
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Không thể khởi động server: %v", err)
	}
}
