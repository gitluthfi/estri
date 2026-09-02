package main

import (
	"log"

	"estri/internal/auth"
	"estri/internal/config"
	"estri/internal/crypto"
	"estri/internal/db"
	"estri/internal/handlers"
	"estri/internal/s3client"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load() // no-op if .env is absent (e.g. in production/k8s)

	cfg := config.Load()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set")
	}
	if cfg.EncryptionKey == "" {
		log.Fatal("ENCRYPTION_KEY must be set (used to encrypt AWS static credentials at rest)")
	}

	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	encryptor, err := crypto.New(cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("failed to initialize encryptor: %v", err)
	}

	if err := seedAdmin(database); err != nil {
		log.Fatalf("failed to seed initial admin user: %v", err)
	}

	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiryMins)
	factory := s3client.NewFactory(encryptor)

	router := handlers.NewRouter(cfg, database, jwtManager, encryptor, factory)

	log.Printf("estri listening on :%s (env=%s, static=%s)", cfg.Port, cfg.Environment, cfg.StaticDir)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
