package auth

import (
	"errors"
	"time"

	"estri/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims embedded in the estri session JWT.
type Claims struct {
	UserID   uuid.UUID   `json:"userId"`
	Username string      `json:"username"`
	Role     models.Role `json:"role"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret     []byte
	expiryMins int
}

func NewJWTManager(secret string, expiryMins int) *JWTManager {
	return &JWTManager{secret: []byte(secret), expiryMins: expiryMins}
}

// Generate creates a signed JWT for the given user.
func (m *JWTManager) Generate(u *models.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(m.expiryMins) * time.Minute)
	claims := Claims{
		UserID:   u.ID,
		Username: u.Username,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   u.ID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	return signed, expiresAt, err
}

// Verify parses and validates a JWT, returning its claims.
func (m *JWTManager) Verify(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}
	return claims, nil
}
