package handlers

import (
	"net/http"

	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BucketHandler struct {
	db *gorm.DB
}

func NewBucketHandler(db *gorm.DB) *BucketHandler {
	return &BucketHandler{db: db}
}

// ListAll returns every registered bucket (admin only, used in the admin
// bucket-registry screen).
func (h *BucketHandler) ListAll(c *gin.Context) {
	var buckets []models.Bucket
	if err := h.db.Order("name asc").Find(&buckets).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list buckets")
		return
	}
	response.OK(c, buckets)
}

// accessibleBucket decorates a Bucket with the current user's effective
// write/delete permissions on it.
type accessibleBucket struct {
	models.Bucket
	CanWrite  bool `json:"canWrite"`
	CanDelete bool `json:"canDelete"`
}

// ListAccessible returns the buckets the current user may browse, along with
// their effective permissions: admins get every bucket with full access,
// dev users get only their permitted buckets.
func (h *BucketHandler) ListAccessible(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	if claims.Role == models.RoleAdmin {
		var buckets []models.Bucket
		if err := h.db.Order("name asc").Find(&buckets).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to list buckets")
			return
		}
		out := make([]accessibleBucket, 0, len(buckets))
		for _, b := range buckets {
			out = append(out, accessibleBucket{Bucket: b, CanWrite: true, CanDelete: true})
		}
		response.OK(c, out)
		return
	}

	var perms []models.BucketPermission
	if err := h.db.Preload("Bucket").Where("user_id = ?", claims.UserID).Find(&perms).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list buckets")
		return
	}
	out := make([]accessibleBucket, 0, len(perms))
	for _, p := range perms {
		out = append(out, accessibleBucket{Bucket: p.Bucket, CanWrite: p.CanWrite, CanDelete: p.CanDelete})
	}
	response.OK(c, out)
}

type createBucketRequest struct {
	Name         string    `json:"name" binding:"required"`
	Region       string    `json:"region" binding:"required"`
	CredentialID uuid.UUID `json:"credentialId" binding:"required"`
}

// Create registers a new bucket (admin only).
func (h *BucketHandler) Create(c *gin.Context) {
	var req createBucketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var cred models.AWSCredential
	if err := h.db.First(&cred, "id = ?", req.CredentialID).Error; err != nil {
		response.Error(c, http.StatusBadRequest, "credential not found")
		return
	}

	bucket := models.Bucket{
		Name:         req.Name,
		Region:       req.Region,
		CredentialID: req.CredentialID,
	}
	if err := h.db.Create(&bucket).Error; err != nil {
		response.Error(c, http.StatusConflict, "bucket already registered")
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "bucket.create", bucket.Name)

	response.Created(c, bucket)
}

// Delete removes a bucket registration (admin only). This does not delete
// anything in S3 itself, only estri's record of it.
func (h *BucketHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid bucket id")
		return
	}

	if err := h.db.Delete(&models.Bucket{}, "id = ?", id).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to delete bucket")
		return
	}
	h.db.Where("bucket_id = ?", id).Delete(&models.BucketPermission{})

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "bucket.delete", id.String())

	response.OK(c, gin.H{"message": "bucket removed"})
}
