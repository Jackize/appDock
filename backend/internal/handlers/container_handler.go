package handlers

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"appdock/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ContainerHandler struct {
	dockerService *services.DockerService
}

func NewContainerHandler(ds *services.DockerService) *ContainerHandler {
	return &ContainerHandler{dockerService: ds}
}

// ListContainers trả về danh sách tất cả containers
func (h *ContainerHandler) ListContainers(c *gin.Context) {
	all := c.Query("all") == "true"
	containers, err := h.dockerService.ListContainers(all)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, containers)
}

// GetContainer trả về chi tiết một container
func (h *ContainerHandler) GetContainer(c *gin.Context) {
	id := c.Param("id")
	container, err := h.dockerService.GetContainer(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, container)
}

// StartContainer khởi động một container
func (h *ContainerHandler) StartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.dockerService.StartContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container đã được khởi động"})
}

// StopContainer dừng một container
func (h *ContainerHandler) StopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.dockerService.StopContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container đã được dừng"})
}

// RestartContainer khởi động lại một container
func (h *ContainerHandler) RestartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.dockerService.RestartContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container đã được khởi động lại"})
}

// RemoveContainer xóa một container
func (h *ContainerHandler) RemoveContainer(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.dockerService.RemoveContainer(id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Container đã được xóa"})
}

// GetContainerLogs trả về logs của một container
func (h *ContainerHandler) GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	tail := c.DefaultQuery("tail", "100")
	logs, err := h.dockerService.GetContainerLogs(id, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// GetContainerStats trả về stats của một container
func (h *ContainerHandler) GetContainerStats(c *gin.Context) {
	id := c.Param("id")
	stats, err := h.dockerService.GetContainerStats(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Cho phép tất cả origins trong dev
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// StreamLogs stream logs qua WebSocket
func (h *ContainerHandler) StreamLogs(c *gin.Context) {
	id := c.Param("id")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	reader, err := h.dockerService.StreamContainerLogs(id)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"`+err.Error()+`"}`))
		return
	}
	defer reader.Close()

	// Channel để đóng kết nối
	done := make(chan struct{})

	// Goroutine để đọc từ client (ping/pong và close)
	go func() {
		defer close(done)
		for {
			messageType, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
			// Nếu client gửi ping, bỏ qua (chỉ để giữ kết nối)
			if messageType == websocket.PingMessage {
				conn.WriteMessage(websocket.PongMessage, nil)
			}
		}
	}()

	// Channel để nhận log lines
	logChan := make(chan string, 100)

	// Goroutine để đọc logs từ Docker
	go func() {
		scanner := bufio.NewScanner(reader)
		buf := make([]byte, 0, 64*1024)
		scanner.Buffer(buf, 1024*1024)

		for scanner.Scan() {
			select {
			case <-done:
				return
			case logChan <- scanner.Text():
			}
		}
		// Scanner kết thúc (container dừng hoặc lỗi)
		close(logChan)
	}()

	// Main loop: gửi logs tới WebSocket
	for {
		select {
		case <-done:
			return
		case line, ok := <-logChan:
			if !ok {
				// Log channel đóng, container có thể đã dừng
				// Gửi thông báo và đóng kết nối
				conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"closed","data":"Container logs stream ended"}`))
				return
			}
			cleanLine := cleanLogLine(line)
			if cleanLine != "" {
				msg := map[string]string{
					"type": "log",
					"data": cleanLine,
				}
				jsonMsg, _ := json.Marshal(msg)
				if err := conn.WriteMessage(websocket.TextMessage, jsonMsg); err != nil {
					return
				}
			}
		}
	}
}

// ExecTerminal tạo terminal session qua WebSocket
func (h *ContainerHandler) ExecTerminal(c *gin.Context) {
	id := c.Param("id")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Tạo exec session
	execID, err := h.dockerService.CreateExec(id)
	if err != nil {
		msg := map[string]string{"type": "error", "data": err.Error()}
		jsonMsg, _ := json.Marshal(msg)
		conn.WriteMessage(websocket.TextMessage, jsonMsg)
		return
	}

	// Attach vào exec session
	hijackedResp, err := h.dockerService.AttachExec(execID)
	if err != nil {
		msg := map[string]string{"type": "error", "data": err.Error()}
		jsonMsg, _ := json.Marshal(msg)
		conn.WriteMessage(websocket.TextMessage, jsonMsg)
		return
	}
	defer hijackedResp.Close()

	// Send welcome message
	welcomeMsg := map[string]string{
		"type": "output",
		"data": "Connected to container terminal\r\n",
	}
	jsonMsg, _ := json.Marshal(welcomeMsg)
	conn.WriteMessage(websocket.TextMessage, jsonMsg)

	// Goroutine để đọc từ container và gửi tới WebSocket
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 4096)
		for {
			n, err := hijackedResp.Reader.Read(buf)
			if err != nil {
				if err != io.EOF {
					msg := map[string]string{"type": "error", "data": "Connection closed"}
					jsonMsg, _ := json.Marshal(msg)
					conn.WriteMessage(websocket.TextMessage, jsonMsg)
				}
				return
			}
			if n > 0 {
				// Loại bỏ header bytes từ Docker multiplexed stream (8 bytes đầu)
				data := buf[:n]
				// Docker stream có thể có header, cố gắng parse
				output := cleanTerminalOutput(data)
				msg := map[string]string{
					"type": "output",
					"data": output,
				}
				jsonMsg, _ := json.Marshal(msg)
				if err := conn.WriteMessage(websocket.TextMessage, jsonMsg); err != nil {
					return
				}
			}
		}
	}()

	// Đọc input từ WebSocket và gửi tới container
	for {
		select {
		case <-done:
			return
		default:
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}

			var input struct {
				Type string `json:"type"`
				Data string `json:"data"`
			}
			if err := json.Unmarshal(message, &input); err != nil {
				// Nếu không parse được JSON, gửi trực tiếp
				hijackedResp.Conn.Write(message)
				continue
			}

			if input.Type == "input" {
				hijackedResp.Conn.Write([]byte(input.Data))
			} else if input.Type == "resize" {
				// Handle terminal resize (optional)
				// Cần parse width, height từ data
			}
		}
	}
}

// cleanLogLine loại bỏ các ký tự control từ Docker logs
func cleanLogLine(line string) string {
	// Docker logs có thể có header 8 bytes
	if len(line) > 8 {
		// Kiểm tra nếu có Docker stream header
		header := line[0]
		if header == 0x01 || header == 0x02 { // stdout hoặc stderr
			return strings.TrimSpace(line[8:])
		}
	}
	return strings.TrimSpace(line)
} // cleanTerminalOutput xử lý output từ Docker exec
func cleanTerminalOutput(data []byte) string {
	// Docker multiplexed stream có header 8 bytes cho mỗi frame
	// [type][0][0][0][size1][size2][size3][size4][payload]
	result := ""
	i := 0
	for i < len(data) {
		if i+8 <= len(data) {
			// Kiểm tra nếu có header
			header := data[i]
			if header == 0x01 || header == 0x02 { // stdout hoặc stderr
				// Đọc size từ bytes 4-7 (big endian)
				size := int(data[i+4])<<24 | int(data[i+5])<<16 | int(data[i+6])<<8 | int(data[i+7])
				i += 8
				if i+size <= len(data) {
					result += string(data[i : i+size])
					i += size
					continue
				}
			}
		}
		// Nếu không có header, lấy hết data còn lại
		result += string(data[i:])
		break
	}
	return result
}
