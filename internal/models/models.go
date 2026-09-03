package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Role string

const (
	RoleAdmin Role = "admin"
	RoleDev   Role = "dev"
)

// User represents an application account.
type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Role         Role      `gorm:"type:varchar(20);not null;default:dev" json:"role"`
	Active       bool      `gorm:"not null;default:true" json:"active"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`

	BucketPermissions []BucketPermission `gorm:"foreignKey:UserID" json:"-"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// AWSAuthMethod enumerates the supported ways estri talks to AWS S3.
type AWSAuthMethod string

const (
	AuthMethodIRSA       AWSAuthMethod = "irsa"        // default AWS SDK credential chain (K8s ServiceAccount / EKS Pod Identity)
	AuthMethodAssumeRole AWSAuthMethod = "assume_role" // assume an IAM role dynamically
	AuthMethodStaticKeys AWSAuthMethod = "static_keys" // access key / secret key stored (encrypted) in DB
)

// AWSCredential stores connection profiles used to reach S3. Only admins can
// manage these. AccessKey/SecretKey are stored AES-256-GCM encrypted; they are
// never returned by the API once set.
type AWSCredential struct {
	ID         uuid.UUID     `gorm:"type:uuid;primaryKey" json:"id"`
	Name       string        `gorm:"uniqueIndex;not null" json:"name"`
	AuthMethod AWSAuthMethod `gorm:"type:varchar(20);not null" json:"authMethod"`
	Region     string        `gorm:"not null" json:"region"`

	// Used when AuthMethod == static_keys. Encrypted at rest.
	AccessKeyEnc string `gorm:"column:access_key_enc" json:"-"`
	SecretKeyEnc string `gorm:"column:secret_key_enc" json:"-"`

	// Used when AuthMethod == assume_role (and optionally to further
	// restrict IRSA's base identity before assuming a role).
	RoleARN     string `gorm:"column:role_arn" json:"roleArn,omitempty"`
	ExternalID  string `gorm:"column:external_id" json:"externalId,omitempty"`
	SessionName string `gorm:"column:session_name" json:"sessionName,omitempty"`

	IsDefault bool      `gorm:"not null;default:false" json:"isDefault"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Buckets []Bucket `gorm:"foreignKey:CredentialID" json:"-"`
}

func (c *AWSCredential) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// HasStaticKeys reports whether an access/secret key pair is currently set.
func (c *AWSCredential) HasStaticKeys() bool {
	return c.AccessKeyEnc != "" && c.SecretKeyEnc != ""
}

// Bucket registers an S3 bucket known to estri and which credential profile
// should be used to access it.
type Bucket struct {
	ID           uuid.UUID     `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string        `gorm:"uniqueIndex;not null" json:"name"`
	Region       string        `gorm:"not null" json:"region"`
	CredentialID uuid.UUID     `gorm:"type:uuid;not null" json:"credentialId"`
	Credential   AWSCredential `gorm:"foreignKey:CredentialID" json:"-"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
}

func (b *Bucket) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// BucketPermission grants a "dev" user access to a specific bucket. Admins
// implicitly have access to every bucket and do not need rows here.
type BucketPermission struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_bucket" json:"userId"`
	BucketID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_bucket" json:"bucketId"`
	Bucket    Bucket    `gorm:"foreignKey:BucketID" json:"bucket,omitempty"`
	CanWrite  bool      `gorm:"not null;default:true" json:"canWrite"`
	CanDelete bool      `gorm:"not null;default:false" json:"canDelete"`
	CreatedAt time.Time `json:"createdAt"`
}

func (p *BucketPermission) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// AuditLog records sensitive actions (login, delete, credential changes...).
type AuditLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"userId,omitempty"`
	Action    string     `gorm:"not null;index" json:"action"`
	Detail    string     `json:"detail"`
	IPAddress string     `json:"ipAddress"`
	CreatedAt time.Time  `gorm:"index" json:"createdAt"`
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// AllModels returns every model for AutoMigrate.
func AllModels() []interface{} {
	return []interface{}{
		&User{},
		&AWSCredential{},
		&Bucket{},
		&BucketPermission{},
		&AuditLog{},
	}
}
