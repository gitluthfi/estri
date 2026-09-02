package handlers

import (
	"net/http"
	"time"

	"estri/internal/auth"
	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db         *gorm.DB
	jwtManager *auth.JWTManager
	cfg        CookieConfig
}

// CookieConfig controls how the session cookie is issued.
type CookieConfig struct {
	Secure bool
	Domain string
}

func NewAuthHandler(db *gorm.DB, jwtManager *auth.JWTManager, cfg CookieConfig) *AuthHandler {
	return &AuthHandler{db: db, jwtManager: jwtManager, cfg: cfg}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Login authenticates by username OR email + password, and sets an HttpOnly
// session cookie carrying a signed JWT.
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "username and password are required")
		return
	}

	var user models.User
	err := h.db.Where("username = ? OR email = ?", req.Username, req.Username).First(&user).Error
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if !user.Active {
		response.Error(c, http.StatusForbidden, "account is disabled")
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		response.Error(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, expiresAt, err := h.jwtManager.Generate(&user)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to create session")
		return
	}

	maxAge := int(time.Until(expiresAt).Seconds())
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(middleware.CookieName, token, maxAge, "/", h.cfg.Domain, h.cfg.Secure, true)

	writeAudit(h.db, c, &user.ID, "login", "")

	response.OK(c, gin.H{
		"user": publicUser(&user),
	})
}

// Logout clears the session cookie.
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie(middleware.CookieName, "", -1, "/", h.cfg.Domain, h.cfg.Secure, true)
	response.OK(c, gin.H{"message": "logged out"})
}

// Me returns the currently authenticated user's profile.
func (h *AuthHandler) Me(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		response.Error(c, http.StatusUnauthorized, "not authenticated")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		response.Error(c, http.StatusUnauthorized, "user not found")
		return
	}

	response.OK(c, gin.H{"user": publicUser(&user)})
}

func publicUser(u *models.User) gin.H {
	return gin.H{
		"id":       u.ID,
		"username": u.Username,
		"email":    u.Email,
		"role":     u.Role,
		"active":   u.Active,
	}
}
