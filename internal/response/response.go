// Package response provides small helpers for consistent JSON API responses.
package response

import "github.com/gin-gonic/gin"

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(200, data)
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(201, data)
}
