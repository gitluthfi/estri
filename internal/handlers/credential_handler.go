package handlers

import (
	"net/http"

	"estri/internal/crypto"
	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/response"
	"estri/internal/s3client"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CredentialHandler struct {
	db        *gorm.DB
	encryptor *crypto.Encryptor
	factory   *s3client.Factory
}

func NewCredentialHandler(db *gorm.DB, encryptor *crypto.Encryptor, factory *s3client.Factory) *CredentialHandler {
	return &CredentialHandler{db: db, encryptor: encryptor, factory: factory}
}

// List returns every AWS credential profile (admin only). Secrets are never
// included in the response.
func (h *CredentialHandler) List(c *gin.Context) {
	var creds []models.AWSCredential
	if err := h.db.Order("created_at asc").Find(&creds).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to list credentials")
		return
	}
	out := make([]gin.H, 0, len(creds))
	for i := range creds {
		out = append(out, publicCredential(&creds[i]))
	}
	response.OK(c, out)
}

type createCredentialRequest struct {
	Name        string               `json:"name" binding:"required"`
	AuthMethod  models.AWSAuthMethod `json:"authMethod" binding:"required,oneof=irsa assume_role static_keys"`
	Region      string               `json:"region" binding:"required"`
	AccessKey   string               `json:"accessKey"`
	SecretKey   string               `json:"secretKey"`
	RoleARN     string               `json:"roleArn"`
	ExternalID  string               `json:"externalId"`
	SessionName string               `json:"sessionName"`
	IsDefault   bool                 `json:"isDefault"`
}

// Create adds a new AWS credential profile (admin only).
func (h *CredentialHandler) Create(c *gin.Context) {
	var req createCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.AuthMethod == models.AuthMethodStaticKeys && (req.AccessKey == "" || req.SecretKey == "") {
		response.Error(c, http.StatusBadRequest, "accessKey and secretKey are required for static_keys")
		return
	}
	if req.AuthMethod == models.AuthMethodAssumeRole && req.RoleARN == "" {
		response.Error(c, http.StatusBadRequest, "roleArn is required for assume_role")
		return
	}

	cred := models.AWSCredential{
		Name:        req.Name,
		AuthMethod:  req.AuthMethod,
		Region:      req.Region,
		RoleARN:     req.RoleARN,
		ExternalID:  req.ExternalID,
		SessionName: req.SessionName,
		IsDefault:   req.IsDefault,
	}

	if req.AccessKey != "" {
		enc, err := h.encryptor.Encrypt(req.AccessKey)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to encrypt access key")
			return
		}
		cred.AccessKeyEnc = enc
	}
	if req.SecretKey != "" {
		enc, err := h.encryptor.Encrypt(req.SecretKey)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to encrypt secret key")
			return
		}
		cred.SecretKeyEnc = enc
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if cred.IsDefault {
			if err := tx.Model(&models.AWSCredential{}).Where("is_default = ?", true).Update("is_default", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(&cred).Error
	})
	if err != nil {
		response.Error(c, http.StatusConflict, "credential name already exists")
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "credential.create", cred.Name)

	response.Created(c, publicCredential(&cred))
}

type updateCredentialRequest struct {
	Region      *string `json:"region,omitempty"`
	AccessKey   *string `json:"accessKey,omitempty"`
	SecretKey   *string `json:"secretKey,omitempty"`
	RoleARN     *string `json:"roleArn,omitempty"`
	ExternalID  *string `json:"externalId,omitempty"`
	SessionName *string `json:"sessionName,omitempty"`
	IsDefault   *bool   `json:"isDefault,omitempty"`
}

// Update edits an AWS credential profile (admin only).
func (h *CredentialHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid credential id")
		return
	}

	var cred models.AWSCredential
	if err := h.db.First(&cred, "id = ?", id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "credential not found")
		return
	}

	var req updateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.Region != nil {
		cred.Region = *req.Region
	}
	if req.RoleARN != nil {
		cred.RoleARN = *req.RoleARN
	}
	if req.ExternalID != nil {
		cred.ExternalID = *req.ExternalID
	}
	if req.SessionName != nil {
		cred.SessionName = *req.SessionName
	}
	if req.AccessKey != nil && *req.AccessKey != "" {
		enc, err := h.encryptor.Encrypt(*req.AccessKey)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to encrypt access key")
			return
		}
		cred.AccessKeyEnc = enc
	}
	if req.SecretKey != nil && *req.SecretKey != "" {
		enc, err := h.encryptor.Encrypt(*req.SecretKey)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to encrypt secret key")
			return
		}
		cred.SecretKeyEnc = enc
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if req.IsDefault != nil && *req.IsDefault {
			if err := tx.Model(&models.AWSCredential{}).Where("id <> ?", cred.ID).Update("is_default", false).Error; err != nil {
				return err
			}
			cred.IsDefault = true
		} else if req.IsDefault != nil {
			cred.IsDefault = *req.IsDefault
		}
		return tx.Save(&cred).Error
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to update credential")
		return
	}

	h.factory.Invalidate(cred.ID.String())

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "credential.update", cred.Name)

	response.OK(c, publicCredential(&cred))
}

// Delete removes an AWS credential profile (admin only). Fails if any bucket
// still references it.
func (h *CredentialHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid credential id")
		return
	}

	var count int64
	h.db.Model(&models.Bucket{}).Where("credential_id = ?", id).Count(&count)
	if count > 0 {
		response.Error(c, http.StatusConflict, "credential is still in use by one or more buckets")
		return
	}

	if err := h.db.Delete(&models.AWSCredential{}, "id = ?", id).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to delete credential")
		return
	}

	h.factory.Invalidate(id.String())

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "credential.delete", id.String())

	response.OK(c, gin.H{"message": "credential deleted"})
}

func publicCredential(cr *models.AWSCredential) gin.H {
	return gin.H{
		"id":            cr.ID,
		"name":          cr.Name,
		"authMethod":    cr.AuthMethod,
		"region":        cr.Region,
		"roleArn":       cr.RoleARN,
		"externalId":    cr.ExternalID,
		"sessionName":   cr.SessionName,
		"hasStaticKeys": cr.HasStaticKeys(),
		"isDefault":     cr.IsDefault,
		"createdAt":     cr.CreatedAt,
		"updatedAt":     cr.UpdatedAt,
	}
}
