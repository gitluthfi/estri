# estri ships as a single image: the React SPA is built first, then bundled
# alongside the Go binary in the final stage. One image, one container, one
# Kubernetes Deployment — the Go server serves both the API and the UI.

# --- frontend build stage ---
FROM node:20-alpine AS webbuild

WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install

COPY web/ .
RUN npm run build

# --- backend build stage ---
FROM golang:1.22-alpine AS build

WORKDIR /src
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/estri-server ./cmd/server

# --- runtime stage ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S estri && adduser -S estri -G estri

WORKDIR /app
COPY --from=build /out/estri-server /usr/local/bin/estri-server
COPY --from=webbuild /web/dist ./web/dist

ENV STATIC_DIR=/app/web/dist

USER estri
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/estri-server"]
