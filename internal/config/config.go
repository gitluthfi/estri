package config

import (
	"os"
	"strconv"
)

// Config holds all runtime configuration for the estri monolith (API +
// bundled web UI), sourced from environment variables (see .env.example /
// k8s ConfigMap+Secret).
type Config struct {
	Port string

	// StaticDir is where the built React SPA (web/dist) lives on disk. The
	// server serves it directly alongside the /api routes — estri ships as
	// a single binary/image/deployment, not separate frontend & backend
	// services.
	StaticDir string

	DatabaseURL string

	JWTSecret     string
	JWTExpiryMins int

	// EncryptionKey is a 32-byte (AES-256) key, base64 or raw, used to
	// encrypt AWS static credentials at rest in the database.
	EncryptionKey string

	// CookieSecure controls whether the session cookie is marked Secure.
	// Should be true in production (HTTPS behind ingress).
	CookieSecure bool

	// CookieDomain scopes the session cookie; empty = current host.
	CookieDomain string

	// Environment: "development" | "production"
	Environment string
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return i
}

// Load reads configuration from environment variables.
func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "8080"),
		StaticDir:     getEnv("STATIC_DIR", "web/dist"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://estri:estri@localhost:5432/estri?sslmode=disable"),
		JWTSecret:     getEnv("JWT_SECRET", ""),
		JWTExpiryMins: getEnvInt("JWT_EXPIRY_MINUTES", 480),
		EncryptionKey: getEnv("ENCRYPTION_KEY", ""),
		CookieSecure:  getEnvBool("COOKIE_SECURE", true),
		CookieDomain:  getEnv("COOKIE_DOMAIN", ""),
		Environment:   getEnv("ENVIRONMENT", "production"),
	}
}
