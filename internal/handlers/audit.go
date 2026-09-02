package handlers

import (
	"estri/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// writeAudit persists a best-effort audit log entry. Failures are ignored
// (never block the request on audit logging).
func writeAudit(db *gorm.DB, c *gin.Context, userID *uuid.UUID, action, detail string) {
	entry := models.AuditLog{
		UserID:    userID,
		Action:    action,
		Detail:    detail,
		IPAddress: c.ClientIP(),
	}
	db.Create(&entry)
}
