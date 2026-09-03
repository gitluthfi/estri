package handlers

import (
	"net/http"
	"strconv"

	"estri/internal/models"
	"estri/internal/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuditHandler struct {
	db *gorm.DB
}

func NewAuditHandler(db *gorm.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

// auditLogEntry decorates a raw AuditLog row with the acting user's
// username (via a left join, so entries survive the user later being
// deleted — the audit trail is never erased with them).
type auditLogEntry struct {
	models.AuditLog
	Username string `json:"username"`
}

// List returns audit log entries, newest first, admin only. Supports
// keyset-free offset pagination (fine at this scale) plus optional
// filtering by action and/or acting user.
func (h *AuditHandler) List(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if err != nil || limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		offset = 0
	}

	query := h.db.Table("audit_logs").
		Select("audit_logs.*, users.username as username").
		Joins("LEFT JOIN users ON users.id = audit_logs.user_id")

	if action := c.Query("action"); action != "" {
		query = query.Where("audit_logs.action = ?", action)
	}
	if userID := c.Query("userId"); userID != "" {
		query = query.Where("audit_logs.user_id = ?", userID)
	}

	var entries []auditLogEntry
	if err := query.
		Order("audit_logs.created_at DESC").
		Limit(limit + 1).
		Offset(offset).
		Find(&entries).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list audit logs")
		return
	}

	hasMore := len(entries) > limit
	if hasMore {
		entries = entries[:limit]
	}

	response.OK(c, gin.H{"entries": entries, "hasMore": hasMore})
}

// Actions returns the distinct action values seen so far, so the frontend
// can offer a filter dropdown without hardcoding the list.
func (h *AuditHandler) Actions(c *gin.Context) {
	var actions []string
	if err := h.db.Model(&models.AuditLog{}).
		Distinct().
		Order("action").
		Pluck("action", &actions).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list actions")
		return
	}
	response.OK(c, actions)
}
