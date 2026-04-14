package handlers

import (
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v4/net"
)

const maxConnectionsScan = 20000
const topRemotePeers = 25

// NetworkSnapshot is returned by GET /api/system/network (JSON shape matches backend).
type NetworkSnapshot struct {
	Hostname        string            `json:"hostname"`
	Timestamp       int64             `json:"timestamp"`
	TCPCount        int               `json:"tcpCount"`
	UDPCount        int               `json:"udpCount"`
	TCPByStatus     map[string]int    `json:"tcpByStatus"`
	TopRemotePeers  []RemotePeerCount `json:"topRemotePeers"`
	UniqueRemoteIPs int               `json:"uniqueRemoteIps"`
	Interfaces      []NetIFCounters   `json:"interfaces"`
}

type RemotePeerCount struct {
	Addr  string `json:"addr"`
	Count int    `json:"count"`
}

type NetIFCounters struct {
	Name         string `json:"name"`
	BytesSent    uint64 `json:"bytesSent"`
	BytesRecv    uint64 `json:"bytesRecv"`
	PacketsSent  uint64 `json:"packetsSent"`
	PacketsRecv  uint64 `json:"packetsRecv"`
}

type NetworkHandler struct{}

func NewNetworkHandler() *NetworkHandler {
	return &NetworkHandler{}
}

func (h *NetworkHandler) GetNetwork(c *gin.Context) {
	snap, err := buildNetworkSnapshot()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, snap)
}

func buildNetworkSnapshot() (*NetworkSnapshot, error) {
	hn, _ := os.Hostname()
	snap := &NetworkSnapshot{
		Hostname:    hn,
		Timestamp:   time.Now().UnixMilli(),
		TCPByStatus: make(map[string]int),
	}

	tcpConns, err := net.Connections("tcp")
	if err != nil {
		return snap, err
	}
	if len(tcpConns) > maxConnectionsScan {
		tcpConns = tcpConns[:maxConnectionsScan]
	}

	peerCount := make(map[string]int)
	ipSet := make(map[string]struct{})
	snap.TCPCount = len(tcpConns)

	for _, co := range tcpConns {
		st := co.Status
		if st == "" {
			st = "UNKNOWN"
		}
		snap.TCPByStatus[st]++
		if co.Raddr.IP != "" {
			ipSet[co.Raddr.IP] = struct{}{}
			key := co.Raddr.IP
			if co.Raddr.Port > 0 {
				key = co.Raddr.IP + ":" + strconv.FormatUint(uint64(co.Raddr.Port), 10)
			}
			peerCount[key]++
		}
	}
	snap.UniqueRemoteIPs = len(ipSet)

	type kv struct {
		k string
		v int
	}
	pairs := make([]kv, 0, len(peerCount))
	for k, v := range peerCount {
		pairs = append(pairs, kv{k, v})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].v == pairs[j].v {
			return pairs[i].k < pairs[j].k
		}
		return pairs[i].v > pairs[j].v
	})
	n := topRemotePeers
	if len(pairs) < n {
		n = len(pairs)
	}
	snap.TopRemotePeers = make([]RemotePeerCount, 0, n)
	for i := 0; i < n; i++ {
		snap.TopRemotePeers = append(snap.TopRemotePeers, RemotePeerCount{Addr: pairs[i].k, Count: pairs[i].v})
	}

	udpConns, _ := net.Connections("udp")
	snap.UDPCount = len(udpConns)

	ioc, err := net.IOCounters(false)
	if err == nil {
		for _, io := range ioc {
			if io.Name == "lo" {
				continue
			}
			snap.Interfaces = append(snap.Interfaces, NetIFCounters{
				Name:        io.Name,
				BytesSent:   io.BytesSent,
				BytesRecv:   io.BytesRecv,
				PacketsSent: io.PacketsSent,
				PacketsRecv: io.PacketsRecv,
			})
		}
	}

	return snap, nil
}
