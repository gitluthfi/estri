package main

import (
	"fmt"
	"log"
	"os"

	"estri/internal/auth"
	"estri/internal/models"

	"gorm.io/gorm"
)

// seedAdmin creates a bootstrap admin account on first run, controlled by
// ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars. It is a no-op once
// any user already exists, so it is safe to run on every startup.
func seedAdmin(database *gorm.DB) error {
	var count int64
	if err := database.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	username := getenvDefault("ADMIN_USERNAME", "admin")
	email := getenvDefault("ADMIN_EMAIL", "admin@estri.local")
	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		return fmt.Errorf("no users exist yet and ADMIN_PASSWORD is not set; set it to bootstrap the first admin account")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	admin := models.User{
		Username:     username,
		Email:        email,
		PasswordHash: hash,
		Role:         models.RoleAdmin,
		Active:       true,
	}
	if err := database.Create(&admin).Error; err != nil {
		return err
	}

	log.Printf("bootstrap admin account created: username=%s email=%s", username, email)
	return nil
}

func getenvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
