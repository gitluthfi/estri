package db

import (
	"fmt"
	"log"
	"time"

	"estri/internal/config"
	"estri/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens the PostgreSQL connection with a small retry loop (useful
// when the DB and app start roughly at the same time, e.g. in Kubernetes or
// docker-compose) and runs AutoMigrate.
func Connect(cfg *config.Config) (*gorm.DB, error) {
	var (
		db  *gorm.DB
		err error
	)

	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	for attempt := 1; attempt <= 10; attempt++ {
		db, err = gorm.Open(postgres.Open(cfg.DatabaseURL), gormCfg)
		if err == nil {
			break
		}
		log.Printf("db connect attempt %d/10 failed: %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("could not connect to database: %w", err)
	}

	if err := db.AutoMigrate(models.AllModels()...); err != nil {
		return nil, fmt.Errorf("automigrate failed: %w", err)
	}

	return db, nil
}
