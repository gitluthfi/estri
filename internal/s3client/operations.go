package s3client

import (
	"context"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// ObjectEntry represents either a "folder" (common prefix) or a file object
// within a bucket listing.
type ObjectEntry struct {
	Key          string    `json:"key"`
	Name         string    `json:"name"`
	IsFolder     bool      `json:"isFolder"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified,omitempty"`
}

// ListObjects lists immediate children of prefix within bucket, using "/" as
// the delimiter so sub-folders show up as common prefixes rather than being
// recursively flattened.
func ListObjects(ctx context.Context, client *s3.Client, bucket, prefix string) ([]ObjectEntry, error) {
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	var entries []ObjectEntry
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket:    aws.String(bucket),
		Prefix:    aws.String(prefix),
		Delimiter: aws.String("/"),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, cp := range page.CommonPrefixes {
			key := aws.ToString(cp.Prefix)
			entries = append(entries, ObjectEntry{
				Key:      key,
				Name:     folderName(key, prefix),
				IsFolder: true,
			})
		}
		for _, obj := range page.Contents {
			key := aws.ToString(obj.Key)
			if key == prefix {
				continue // the "directory marker" object itself
			}
			entries = append(entries, ObjectEntry{
				Key:          key,
				Name:         strings.TrimPrefix(key, prefix),
				IsFolder:     false,
				Size:         aws.ToInt64(obj.Size),
				LastModified: aws.ToTime(obj.LastModified),
			})
		}
	}
	return entries, nil
}

// SearchObjects performs a recursive (no delimiter) listing under prefix and
// filters keys containing query (case-insensitive substring match). Bounded
// to avoid unbounded scans of huge buckets.
func SearchObjects(ctx context.Context, client *s3.Client, bucket, prefix, query string, maxResults int) ([]ObjectEntry, error) {
	if maxResults <= 0 {
		maxResults = 500
	}
	query = strings.ToLower(query)

	var entries []ObjectEntry
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() && len(entries) < maxResults {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, obj := range page.Contents {
			key := aws.ToString(obj.Key)
			if !strings.Contains(strings.ToLower(key), query) {
				continue
			}
			entries = append(entries, ObjectEntry{
				Key:          key,
				Name:         key,
				IsFolder:     false,
				Size:         aws.ToInt64(obj.Size),
				LastModified: aws.ToTime(obj.LastModified),
			})
			if len(entries) >= maxResults {
				break
			}
		}
	}
	return entries, nil
}

// Upload streams a file into S3 using the multipart manager, suitable for
// large files without buffering them entirely in memory.
func Upload(ctx context.Context, client *s3.Client, bucket, key string, body io.Reader, contentType string) error {
	uploader := manager.NewUploader(client)
	_, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	return err
}

// DeleteObject removes a single object.
func DeleteObject(ctx context.Context, client *s3.Client, bucket, key string) error {
	_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	return err
}

// DeleteFolder removes every object under a given prefix ("folder").
func DeleteFolder(ctx context.Context, client *s3.Client, bucket, prefix string) error {
	if !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return err
		}
		if len(page.Contents) == 0 {
			continue
		}
		var objs []types.ObjectIdentifier
		for _, obj := range page.Contents {
			objs = append(objs, types.ObjectIdentifier{Key: obj.Key})
		}
		_, err = client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(bucket),
			Delete: &types.Delete{Objects: objs},
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// PresignGetURL returns a time-limited download URL for an object.
func PresignGetURL(ctx context.Context, client *s3.Client, bucket, key string, expiry time.Duration) (string, error) {
	presigner := s3.NewPresignClient(client)
	req, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// PresignPutURL returns a time-limited direct-upload URL for an object.
func PresignPutURL(ctx context.Context, client *s3.Client, bucket, key, contentType string, expiry time.Duration) (string, error) {
	presigner := s3.NewPresignClient(client)
	req, err := presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// GetObject fetches an object's body directly, e.g. for small file previews.
func GetObject(ctx context.Context, client *s3.Client, bucket, key string) (*s3.GetObjectOutput, error) {
	return client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
}

func folderName(key, prefix string) string {
	trimmed := strings.TrimPrefix(key, prefix)
	return strings.TrimSuffix(trimmed, "/")
}
