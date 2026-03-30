package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	maxHistoryPoints   = 20
	saveIntervalSecs   = 30
	defaultHistoryFile = "stats_history.json"
)

type ChartPoint struct {
	Time      string  `json:"time"`
	CPU       float64 `json:"cpu"`
	Disk      float64 `json:"disk"`
	MemUsed   float64 `json:"memUsed"`
	MemCached float64 `json:"memCached"`
	MemFree   float64 `json:"memFree"`
}

type StatsHistoryService struct {
	mu       sync.RWMutex
	points   []ChartPoint
	filePath string
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

func NewStatsHistoryService(dataDir string) *StatsHistoryService {
	if dataDir == "" {
		dataDir = "."
	}

	// Ensure directory exists
	os.MkdirAll(dataDir, 0755)

	s := &StatsHistoryService{
		points:   make([]ChartPoint, 0, maxHistoryPoints),
		filePath: filepath.Join(dataDir, defaultHistoryFile),
		stopCh:   make(chan struct{}),
	}

	// Load existing history from file
	s.loadFromFile()

	// Start periodic save goroutine
	s.wg.Add(1)
	go s.periodicSave()

	return s
}

func (s *StatsHistoryService) GetHistory() []ChartPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to avoid race conditions
	result := make([]ChartPoint, len(s.points))
	copy(result, s.points)
	return result
}

func (s *StatsHistoryService) AddPoint(point ChartPoint) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.points = append(s.points, point)
	if len(s.points) > maxHistoryPoints {
		s.points = s.points[len(s.points)-maxHistoryPoints:]
	}
}

func (s *StatsHistoryService) loadFromFile() {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return // File doesn't exist or can't be read, start fresh
	}

	var points []ChartPoint
	if err := json.Unmarshal(data, &points); err != nil {
		return // Invalid JSON, start fresh
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if len(points) > maxHistoryPoints {
		points = points[len(points)-maxHistoryPoints:]
	}
	s.points = points
}

func (s *StatsHistoryService) saveToFile() {
	s.mu.RLock()
	data, err := json.Marshal(s.points)
	s.mu.RUnlock()

	if err != nil {
		return
	}

	os.WriteFile(s.filePath, data, 0644)
}

func (s *StatsHistoryService) periodicSave() {
	defer s.wg.Done()

	ticker := time.NewTicker(saveIntervalSecs * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.saveToFile()
		case <-s.stopCh:
			s.saveToFile() // Save before shutdown
			return
		}
	}
}

func (s *StatsHistoryService) Close() {
	close(s.stopCh)
	s.wg.Wait()
}
