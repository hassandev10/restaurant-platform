# Multi-stage Dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/smart-restaurant-api cmd/api/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Africa/Cairo

WORKDIR /app
COPY --from=builder /app/smart-restaurant-api /app/
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/scripts /app/scripts

EXPOSE 8080
CMD ["/app/smart-restaurant-api"]
