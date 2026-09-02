package middleware

import (
	"net/http"

	"estri/internal/auth"
	"estri/internal/models"
	"estri/internal/response"

	"github.com/gin-gonic/gin"
)

const (
	CookieName   = "estri_session"
	ctxClaimsKey = "claims"
)

// RequireAuth validates the session (from the estri_session cookie, or a
// Bearer Authorization header as a fallback for non-browser clients) and
// stores the parsed claims on the request context.
func RequireAuth(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(CookieName)
		if err != nil || token == "" {
			header := c.GetHeader("Authorization")
			if len(header) > 7 && header[:7] == "Bearer " {
				token = header[7:]
			}
		}
		if token == "" {
			response.Error(c, http.StatusUnauthorized, "not authenticated")
			c.Abort()
			return
		}

		claims, err := jwtManager.Verify(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired session")
			c.Abort()
			return
		}

		c.Set(ctxClaimsKey, claims)
		c.Next()
	}
}

// RequireRole restricts a route group to one or more roles.
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	allowed := make(map[models.Role]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		claims := CurrentClaims(c)
		if claims == nil || !allowed[claims.Role] {
			response.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CurrentClaims retrieves the authenticated user's claims from context, or
// nil if the request is unauthenticated.
func CurrentClaims(c *gin.Context) *auth.Claims {
	v, ok := c.Get(ctxClaimsKey)
	if !ok {
		return nil
	}
	claims, ok := v.(*auth.Claims)
	if !ok {
		return nil
	}
	return claims
}
