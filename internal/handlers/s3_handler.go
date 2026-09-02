package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/response"
	"estri/internal/s3client"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type S3Handler struct {
	db      *gorm.DB
	factory *s3client.Factory
}

func NewS3Handler(db *gorm.DB, factory *s3client.Factory) *S3Handler {
	return &S3Handler{db: db, factory: factory}
}

// access resolves the bucket by name and verifies the current user is
// allowed to access it, returning the bucket, its credential, and the
// caller's effective write/delete permissions.
func (h *S3Handler) access(c *gin.Context) (bucket *models.Bucket, canWrite bool, canDelete bool, ok bool) {
	claims := middleware.CurrentClaims(c)
	bucketName := c.Param("bucket")

	var b models.Bucket
	if err := h.db.Preload("Credential").First(&b, "name = ?", bucketName).Error; err != nil {
		response.Error(c, http.StatusNotFound, "bucket not found")
		return nil, false, false, false
	}

	if claims.Role == models.RoleAdmin {
		return &b, true, true, true
	}

	var perm models.BucketPermission
	err := h.db.Where("user_id = ? AND bucket_id = ?", claims.UserID, b.ID).First(&perm).Error
	if err != nil {
		response.Error(c, http.StatusForbidden, "you do not have access to this bucket")
		return nil, false, false, false
	}

	return &b, perm.CanWrite, perm.CanDelete, true
}

// List browses immediate children of a prefix within the bucket.
func (h *S3Handler) List(c *gin.Context) {
	bucket, _, _, ok := h.access(c)
	if !ok {
		return
	}
	prefix := c.Query("prefix")

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	entries, err := s3client.ListObjects(c.Request.Context(), client, bucket.Name, prefix)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to list objects: %v", err))
		return
	}
	response.OK(c, gin.H{"prefix": prefix, "entries": entries})
}

// Search performs a bounded recursive filename search within the bucket.
func (h *S3Handler) Search(c *gin.Context) {
	bucket, _, _, ok := h.access(c)
	if !ok {
		return
	}
	query := c.Query("q")
	if query == "" {
		response.Error(c, http.StatusBadRequest, "query parameter 'q' is required")
		return
	}
	prefix := c.Query("prefix")
	limit, _ := strconv.Atoi(c.Query("limit"))

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	entries, err := s3client.SearchObjects(c.Request.Context(), client, bucket.Name, prefix, query, limit)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("search failed: %v", err))
		return
	}
	response.OK(c, gin.H{"query": query, "entries": entries})
}

// Upload accepts a multipart/form-data file upload and streams it to S3.
func (h *S3Handler) Upload(c *gin.Context) {
	bucket, canWrite, _, ok := h.access(c)
	if !ok {
		return
	}
	if !canWrite {
		response.Error(c, http.StatusForbidden, "you do not have write access to this bucket")
		return
	}

	prefix := c.PostForm("prefix")
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "file is required")
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "failed to read uploaded file")
		return
	}
	defer file.Close()

	key := path.Join(prefix, fileHeader.Filename)
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	if err := s3client.Upload(c.Request.Context(), client, bucket.Name, key, file, contentType); err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("upload failed: %v", err))
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "object.upload", fmt.Sprintf("%s/%s", bucket.Name, key))

	response.Created(c, gin.H{"key": key})
}

// PresignUpload issues a presigned PUT URL so the browser can upload large
// files directly to S3 without proxying bytes through the backend.
func (h *S3Handler) PresignUpload(c *gin.Context) {
	bucket, canWrite, _, ok := h.access(c)
	if !ok {
		return
	}
	if !canWrite {
		response.Error(c, http.StatusForbidden, "you do not have write access to this bucket")
		return
	}

	var req struct {
		Key         string `json:"key" binding:"required"`
		ContentType string `json:"contentType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.ContentType == "" {
		req.ContentType = "application/octet-stream"
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	url, err := s3client.PresignPutURL(c.Request.Context(), client, bucket.Name, req.Key, req.ContentType, 15*time.Minute)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to presign upload: %v", err))
		return
	}

	response.OK(c, gin.H{"url": url, "expiresIn": 900})
}

// Download issues a presigned GET URL for the requested object.
func (h *S3Handler) Download(c *gin.Context) {
	bucket, _, _, ok := h.access(c)
	if !ok {
		return
	}
	key := c.Query("key")
	if key == "" {
		response.Error(c, http.StatusBadRequest, "key parameter is required")
		return
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	presignedURL, err := s3client.PresignGetURL(c.Request.Context(), client, bucket.Name, key, 15*time.Minute)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to presign download: %v", err))
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "object.download", fmt.Sprintf("%s/%s", bucket.Name, key))

	response.OK(c, gin.H{"url": presignedURL, "expiresIn": 900})
}

// Preview streams small text/image/pdf objects inline for in-browser preview.
func (h *S3Handler) Preview(c *gin.Context) {
	bucket, _, _, ok := h.access(c)
	if !ok {
		return
	}
	key := c.Query("key")
	if key == "" {
		response.Error(c, http.StatusBadRequest, "key parameter is required")
		return
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	obj, err := s3client.GetObject(c.Request.Context(), client, bucket.Name, key)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to fetch object: %v", err))
		return
	}
	defer obj.Body.Close()

	const maxPreviewBytes = 10 * 1024 * 1024 // 10MB
	if obj.ContentLength != nil && *obj.ContentLength > maxPreviewBytes {
		response.Error(c, http.StatusRequestEntityTooLarge, "file too large to preview; use download instead")
		return
	}

	contentType := "application/octet-stream"
	if obj.ContentType != nil {
		contentType = *obj.ContentType
	}
	c.Header("Content-Disposition", "inline; filename=\""+url.QueryEscape(path.Base(key))+"\"")
	c.Status(http.StatusOK)
	c.Header("Content-Type", contentType)
	_, _ = io.Copy(c.Writer, obj.Body)
}

// Delete removes a single object or, when path ends in "/", an entire folder.
func (h *S3Handler) Delete(c *gin.Context) {
	bucket, _, canDelete, ok := h.access(c)
	if !ok {
		return
	}
	if !canDelete {
		response.Error(c, http.StatusForbidden, "you do not have delete access to this bucket")
		return
	}

	key := c.Query("key")
	if key == "" {
		response.Error(c, http.StatusBadRequest, "key parameter is required")
		return
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	if strings.HasSuffix(key, "/") {
		err = s3client.DeleteFolder(c.Request.Context(), client, bucket.Name, key)
	} else {
		err = s3client.DeleteObject(c.Request.Context(), client, bucket.Name, key)
	}
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("delete failed: %v", err))
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "object.delete", fmt.Sprintf("%s/%s", bucket.Name, key))

	response.OK(c, gin.H{"message": "deleted"})
}

// CreateFolder writes a zero-byte object ending in "/" to represent an empty
// folder, matching how most S3 consoles emulate directories.
func (h *S3Handler) CreateFolder(c *gin.Context) {
	bucket, canWrite, _, ok := h.access(c)
	if !ok {
		return
	}
	if !canWrite {
		response.Error(c, http.StatusForbidden, "you do not have write access to this bucket")
		return
	}

	var req struct {
		Prefix string `json:"prefix" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	key := req.Prefix
	if !strings.HasSuffix(key, "/") {
		key += "/"
	}

	client, err := h.factory.ClientFor(c.Request.Context(), &bucket.Credential)
	if err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to connect to S3: %v", err))
		return
	}

	if err := s3client.Upload(c.Request.Context(), client, bucket.Name, key, strings.NewReader(""), "application/x-directory"); err != nil {
		response.Error(c, http.StatusBadGateway, fmt.Sprintf("failed to create folder: %v", err))
		return
	}

	claims := middleware.CurrentClaims(c)
	writeAudit(h.db, c, &claims.UserID, "folder.create", fmt.Sprintf("%s/%s", bucket.Name, key))

	response.Created(c, gin.H{"key": key})
}
