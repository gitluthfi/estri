package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// ServeSPA returns a handler that serves the built React SPA from staticDir:
// existing files (JS/CSS/images/...) are served as-is, and any other path is
// answered with index.html so client-side routing (React Router) works on a
// hard refresh or deep link. estri ships as a single binary/image that
// serves both the API and the UI, so this is the only "frontend serving"
// estri needs — there is no separate frontend service to deploy.
func ServeSPA(staticDir string) gin.HandlerFunc {
	absStatic, err := filepath.Abs(staticDir)
	if err != nil {
		absStatic = staticDir
	}
	indexPath := filepath.Join(absStatic, "index.html")
	fileServer := http.FileServer(http.Dir(absStatic))

	return func(c *gin.Context) {
		reqPath := filepath.Clean(c.Request.URL.Path)
		full := filepath.Join(absStatic, reqPath)

		// Guard against path traversal: the resolved path must stay inside
		// absStatic.
		rel, err := filepath.Rel(absStatic, full)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		info, err := os.Stat(full)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		c.File(indexPath)
	}
}
