FROM golang:1.24-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git ca-certificates

COPY agent/go.mod agent/go.sum ./
RUN go mod download

COPY agent/ ./

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /out/appdock-agent .


FROM alpine:latest

RUN apk add --no-cache ca-certificates wget

WORKDIR /app

ENV AGENT_PORT=9090
ENV AGENT_DATA_DIR=/data
ENV AGENT_DOCKER_SOCKET=/var/run/docker.sock

COPY --from=builder /out/appdock-agent /app/appdock-agent

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${AGENT_PORT}/health" || exit 1

CMD ["/app/appdock-agent"]
