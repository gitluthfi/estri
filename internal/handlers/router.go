package handlers

import (
	"net/http"
	"strings"

	"estri/internal/auth"
	"estri/internal/config"
	"estri/internal/crypto"
	"estri/internal/middleware"
	"estri/internal/models"
	"estri/internal/s3client"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NewRouter wires up the estri monolith: the JSON API under /api, and the
// built React SPA for everything else. There is deliberately no CORS setup
// here — the UI is always served from the same origin as the API (both in
// production and in local dev, where Vite proxies /api to this server), so
// cross-origin requests are simply not a supported use case.
func NewRouter(cfg *config.Config, db *gorm.DB, jwtManager *auth.JWTManager, encryptor *crypto.Encryptor, factory *s3client.Factory) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.LoggerWithConfig(gin.LoggerConfig{SkipPaths: []string{"/healthz"}}))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	authHandler := NewAuthHandler(db, jwtManager, CookieConfig{Secure: cfg.CookieSecure, Domain: cfg.CookieDomain})
	userHandler := NewUserHandler(db)
	credentialHandler := NewCredentialHandler(db, encryptor, factory)
	bucketHandler := NewBucketHandler(db)
	s3Handler := NewS3Handler(db, factory)

	api := r.Group("/api")
	{
		api.POST("/auth/login", authHandler.Login)
		api.POST("/auth/logout", authHandler.Logout)

		authed := api.Group("/")
		authed.Use(middleware.RequireAuth(jwtManager))
		{
			authed.GET("auth/me", authHandler.Me)

			// Buckets the current user is allowed to browse.
			authed.GET("buckets", bucketHandler.ListAccessible)

			// S3 object browsing - available to admin and dev (per-bucket
			// permission enforced inside each handler).
			objects := authed.Group("buckets/:bucket")
			{
				objects.GET("objects", s3Handler.List)
				objects.GET("search", s3Handler.Search)
				objects.POST("upload", s3Handler.Upload)
				objects.POST("presign-upload", s3Handler.PresignUpload)
				objects.GET("download", s3Handler.Download)
				objects.GET("preview", s3Handler.Preview)
				objects.DELETE("objects", s3Handler.Delete)
				objects.POST("folders", s3Handler.CreateFolder)
			}

			// Admin-only management endpoints.
			admin := authed.Group("admin")
			admin.Use(middleware.RequireRole(models.RoleAdmin))
			{
				admin.GET("users", userHandler.List)
				admin.POST("users", userHandler.Create)
				admin.PUT("users/:id", userHandler.Update)
				admin.DELETE("users/:id", userHandler.Delete)
				admin.GET("users/:id/permissions", userHandler.GetPermissions)
				admin.PUT("users/:id/permissions", userHandler.SetPermissions)

				admin.GET("credentials", credentialHandler.List)
				admin.POST("credentials", credentialHandler.Create)
				admin.PUT("credentials/:id", credentialHandler.Update)
				admin.DELETE("credentials/:id", credentialHandler.Delete)

				admin.GET("buckets", bucketHandler.ListAll)
				admin.POST("buckets", bucketHandler.Create)
				admin.DELETE("buckets/:id", bucketHandler.Delete)
			}
		}
	}

	spa := ServeSPA(cfg.StaticDir)
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		spa(c)
	})

	return r
}
