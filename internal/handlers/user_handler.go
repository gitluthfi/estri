package handlers

import (
	"net/http"

	"estri/internal/auth"
	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

// List returns every user account (admin only).
func (h *UserHandler) List(c *gin.Context) {
	var users []models.User
	if err := h.db.Order("created_at asc").Find(&users).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list users")
		return
	}
	out := make([]gin.H, 0, len(users))
	for i := range users {
		out = append(out, publicUser(&users[i]))
	}
	response.OK(c, out)
}

type createUserRequest struct {
	Username string      `json:"username" binding:"required"`
	Email    string      `json:"email" binding:"required,email"`
	Password string      `json:"password" binding:"required,min=8"`
	Role     models.Role `json:"role" binding:"required,oneof=admin dev"`
}

// Create provisions a new user account (admin only).
func (h *UserHandler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         req.Role,
		Active:       true,
	}
	if err := h.db.Create(&user).Error; err != nil {
		response.Error(c, http.StatusConflict, "username or email already exists")
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "user.create", user.Username)

	response.Created(c, publicUser(&user))
}

type updateUserRequest struct {
	Email    *string      `json:"email,omitempty"`
	Password *string      `json:"password,omitempty"`
	Role     *models.Role `json:"role,omitempty"`
	Active   *bool        `json:"active,omitempty"`
}

// Update edits an existing user account (admin only).
func (h *UserHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user id")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.Email != nil {
		user.Email = *req.Email
	}
	if req.Role != nil {
		if *req.Role != models.RoleAdmin && *req.Role != models.RoleDev {
			response.Error(c, http.StatusBadRequest, "invalid role")
			return
		}
		user.Role = *req.Role
	}
	if req.Active != nil {
		user.Active = *req.Active
	}
	if req.Password != nil && *req.Password != "" {
		if len(*req.Password) < 8 {
			response.Error(c, http.StatusBadRequest, "password must be at least 8 characters")
			return
		}
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to hash password")
			return
		}
		user.PasswordHash = hash
	}

	if err := h.db.Save(&user).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update user")
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "user.update", user.Username)

	response.OK(c, publicUser(&user))
}

// Delete removes a user account (admin only).
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user id")
		return
	}

	claims := middleware.CurrentClaims(c)
	if claims.UserID == id {
		response.Error(c, http.StatusBadRequest, "cannot delete your own account")
		return
	}

	// Bucket permissions must go first: they carry a foreign key to the
	// user, so deleting the user while permission rows still reference it
	// violates that constraint.
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", id).Delete(&models.BucketPermission{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.User{}, "id = ?", id).Error
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to delete user")
		return
	}

	writeAudit(h.db, c, &claims.UserID, "user.delete", id.String())

	response.OK(c, gin.H{"message": "user deleted"})
}

// --- Bucket permission management for dev users ---

type setPermissionsRequest struct {
	BucketIDs []uuid.UUID `json:"bucketIds"`
	CanWrite  bool        `json:"canWrite"`
	CanDelete bool        `json:"canDelete"`
}

// SetPermissions replaces the set of buckets a dev user may access.
func (h *UserHandler) SetPermissions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user id")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}

	var req setPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", id).Delete(&models.BucketPermission{}).Error; err != nil {
			return err
		}
		for _, bucketID := range req.BucketIDs {
			perm := models.BucketPermission{
				UserID:    id,
				BucketID:  bucketID,
				CanWrite:  req.CanWrite,
				CanDelete: req.CanDelete,
			}
			if err := tx.Create(&perm).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to set permissions")
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "user.permissions.set", user.Username)

	response.OK(c, gin.H{"message": "permissions updated"})
}

// GetPermissions lists the buckets a dev user can access.
func (h *UserHandler) GetPermissions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user id")
		return
	}

	var perms []models.BucketPermission
	if err := h.db.Preload("Bucket").Where("user_id = ?", id).Find(&perms).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to load permissions")
		return
	}
	response.OK(c, perms)
}
