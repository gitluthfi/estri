// Package s3client builds AWS S3 clients for estri's three supported
// connection methods:
//
//  1. IRSA / EKS Pod Identity - the default AWS SDK credential chain, which
//     picks up the ServiceAccount-projected web identity token automatically
//     when running inside Kubernetes with an IAM-annotated ServiceAccount.
//  2. Assume Role - starts from the default chain (or static keys, if also
//     supplied) and assumes a given IAM Role ARN via STS, refreshing
//     credentials automatically as they near expiry.
//  3. Static Access Key / Secret Key - credentials stored (encrypted) in
//     Postgres and decrypted on demand.
package s3client

import (
	"context"
	"fmt"

	"estri/internal/crypto"
	"estri/internal/models"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// Factory builds *s3.Client instances from AWSCredential profiles, caching
// clients per credential ID so we don't renegotiate STS/role assumption on
// every request.
type Factory struct {
	encryptor *crypto.Encryptor
	cache     map[string]*s3.Client
}

func NewFactory(encryptor *crypto.Encryptor) *Factory {
	return &Factory{
		encryptor: encryptor,
		cache:     make(map[string]*s3.Client),
	}
}

// ClientFor returns (creating and caching if needed) an S3 client for the
// given credential profile.
func (f *Factory) ClientFor(ctx context.Context, cred *models.AWSCredential) (*s3.Client, error) {
	cacheKey := cred.ID.String()
	if c, ok := f.cache[cacheKey]; ok {
		return c, nil
	}

	client, err := f.build(ctx, cred)
	if err != nil {
		return nil, err
	}
	f.cache[cacheKey] = client
	return client, nil
}

// Invalidate drops any cached client for a credential (call after editing it).
func (f *Factory) Invalidate(credentialID string) {
	delete(f.cache, credentialID)
}

func (f *Factory) build(ctx context.Context, cred *models.AWSCredential) (*s3.Client, error) {
	switch cred.AuthMethod {
	case models.AuthMethodIRSA:
		cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cred.Region))
		if err != nil {
			return nil, fmt.Errorf("loading default AWS config (IRSA): %w", err)
		}
		return s3.NewFromConfig(cfg), nil

	case models.AuthMethodAssumeRole:
		if cred.RoleARN == "" {
			return nil, fmt.Errorf("credential %q: role_arn is required for assume_role", cred.Name)
		}

		baseCfg, err := f.baseConfig(ctx, cred)
		if err != nil {
			return nil, err
		}

		stsClient := sts.NewFromConfig(baseCfg)
		provider := stscreds.NewAssumeRoleProvider(stsClient, cred.RoleARN, func(o *stscreds.AssumeRoleOptions) {
			if cred.SessionName != "" {
				o.RoleSessionName = cred.SessionName
			} else {
				o.RoleSessionName = "estri-session"
			}
			if cred.ExternalID != "" {
				o.ExternalID = &cred.ExternalID
			}
		})
		baseCfg.Credentials = aws.NewCredentialsCache(provider)
		return s3.NewFromConfig(baseCfg), nil

	case models.AuthMethodStaticKeys:
		accessKey, secretKey, err := f.decryptKeys(cred)
		if err != nil {
			return nil, err
		}
		cfg, err := awsconfig.LoadDefaultConfig(ctx,
			awsconfig.WithRegion(cred.Region),
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
			),
		)
		if err != nil {
			return nil, fmt.Errorf("loading static AWS config: %w", err)
		}
		return s3.NewFromConfig(cfg), nil

	default:
		return nil, fmt.Errorf("unsupported auth method %q", cred.AuthMethod)
	}
}

// baseConfig builds the config an assume-role provider starts from: static
// keys if the credential also carries them, otherwise the default chain
// (env vars, IRSA, instance profile, etc).
func (f *Factory) baseConfig(ctx context.Context, cred *models.AWSCredential) (aws.Config, error) {
	if cred.HasStaticKeys() {
		accessKey, secretKey, err := f.decryptKeys(cred)
		if err != nil {
			return aws.Config{}, err
		}
		return awsconfig.LoadDefaultConfig(ctx,
			awsconfig.WithRegion(cred.Region),
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
			),
		)
	}
	return awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cred.Region))
}

func (f *Factory) decryptKeys(cred *models.AWSCredential) (accessKey, secretKey string, err error) {
	accessKey, err = f.encryptor.Decrypt(cred.AccessKeyEnc)
	if err != nil {
		return "", "", fmt.Errorf("decrypting access key: %w", err)
	}
	secretKey, err = f.encryptor.Decrypt(cred.SecretKeyEnc)
	if err != nil {
		return "", "", fmt.Errorf("decrypting secret key: %w", err)
	}
	return accessKey, secretKey, nil
}
