// Package crypto provides AES-256-GCM encryption used to protect AWS static
// credentials (access key / secret key) at rest in PostgreSQL. The key comes
// from the ENCRYPTION_KEY environment variable, which must never be
// committed to source control (see .env.example / k8s Secret).
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

// Encryptor wraps a derived AES-256 key for GCM encryption/decryption.
type Encryptor struct {
	gcm cipher.AEAD
}

// New derives a 32-byte key from the given secret (any length, via SHA-256)
// so operators can supply a passphrase of any size in ENCRYPTION_KEY.
func New(secret string) (*Encryptor, error) {
	if secret == "" {
		return nil, errors.New("encryption key must not be empty")
	}
	key := sha256.Sum256([]byte(secret))

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Encryptor{gcm: gcm}, nil
}

// Encrypt returns a base64-encoded nonce||ciphertext string.
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := e.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt reverses Encrypt.
func (e *Encryptor) Decrypt(encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	nonceSize := e.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := e.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
