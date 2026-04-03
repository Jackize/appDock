package main

import (
	"flag"
	"log"
	"os"

	"appdock-agent/handlers"
	"appdock-agent/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	port := flag.String("port", "9090", "Port to listen on")
	apiKey := flag.String("api-key", "", "API key for authentication")
	dockerSocket := flag.String("docker-socket", "/var/run/docker.sock", "Docker socket path")
	flag.Parse()

	// Environment variables override flags
	if envPort := os.Getenv("AGENT_PORT"); envPort != "" {
		*port = envPort
	}
	if envAPIKey := os.Getenv("AGENT_API_KEY"); envAPIKey != "" {
		*apiKey = envAPIKey
	}
	if envDockerSocket := os.Getenv("AGENT_DOCKER_SOCKET"); envDockerSocket != "" {
		*dockerSocket = envDockerSocket
	}

	if *apiKey == "" {
		log.Fatal("API key is required. Use --api-key flag or AGENT_API_KEY environment variable")
	}

	// Initialize handlers
	systemHandler := handlers.NewSystemHandler()
	dockerHandler, err := handlers.NewDockerHandler(*dockerSocket)
	if err != nil {
		log.Printf("Warning: Could not connect to Docker: %v", err)
	}

	// Setup Gin
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Type", "X-API-Key"}
	router.Use(cors.New(config))

	// Health check (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "agent": "appdock-agent"})
	})

	// API routes (auth required)
	api := router.Group("/api")
	api.Use(middleware.APIKeyAuth(*apiKey))
	{
		// System endpoints
		api.GET("/system/stats", systemHandler.GetStats)
		api.GET("/system/info", systemHandler.GetInfo)

		// Docker endpoints
		if dockerHandler != nil {
			docker := api.Group("/docker")
			{
				docker.GET("/info", dockerHandler.GetInfo)
				docker.GET("/version", dockerHandler.GetVersion)

				// Containers
				docker.GET("/containers", dockerHandler.ListContainers)
				docker.GET("/containers/:id", dockerHandler.GetContainer)
				docker.POST("/containers/:id/start", dockerHandler.StartContainer)
				docker.POST("/containers/:id/stop", dockerHandler.StopContainer)
				docker.POST("/containers/:id/restart", dockerHandler.RestartContainer)
				docker.DELETE("/containers/:id", dockerHandler.RemoveContainer)
				docker.GET("/containers/:id/logs", dockerHandler.GetContainerLogs)
				docker.GET("/containers/:id/stats", dockerHandler.GetContainerStats)

				// Images
				docker.GET("/images", dockerHandler.ListImages)
				docker.GET("/images/:id", dockerHandler.GetImage)
				docker.DELETE("/images/:id", dockerHandler.RemoveImage)

				// Networks
				docker.GET("/networks", dockerHandler.ListNetworks)
				docker.GET("/networks/:id", dockerHandler.GetNetwork)
				docker.POST("/networks", dockerHandler.CreateNetwork)
				docker.DELETE("/networks/:id", dockerHandler.RemoveNetwork)

				// Volumes
				docker.GET("/volumes", dockerHandler.ListVolumes)
				docker.GET("/volumes/:name", dockerHandler.GetVolume)
				docker.POST("/volumes", dockerHandler.CreateVolume)
				docker.DELETE("/volumes/:name", dockerHandler.RemoveVolume)
			}
		}
	}

	log.Printf("🚀 AppDock Agent starting on port %s", *port)
	log.Printf("🔐 API Key authentication enabled")
	if dockerHandler != nil {
		log.Printf("🐳 Docker connected via %s", *dockerSocket)
	} else {
		log.Printf("⚠️  Docker not available")
	}

	if err := router.Run(":" + *port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
