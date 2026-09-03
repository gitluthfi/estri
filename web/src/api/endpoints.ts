import { api } from "./client";
import type {
  AccessibleBucket,
  AuditLogEntry,
  AWSCredential,
  Bucket,
  BucketPermission,
  ObjectEntry,
  User,
} from "../types";

// --- auth ---
export const login = (username: string, password: string) =>
  api.post<{ user: User }>("/auth/login", { username, password }).then((r) => r.data);

export const logout = () => api.post("/auth/logout").then((r) => r.data);

export const me = () => api.get<{ user: User }>("/auth/me").then((r) => r.data);

// --- buckets (accessible to current user) ---
export const listAccessibleBuckets = () =>
  api.get<AccessibleBucket[]>("/buckets").then((r) => r.data);

// --- S3 objects ---
export const listObjects = (bucket: string, prefix: string) =>
  api
    .get<{ prefix: string; entries: ObjectEntry[] }>(
      `/buckets/${encodeURIComponent(bucket)}/objects`,
      { params: { prefix } },
    )
    .then((r) => r.data);

export const searchObjects = (bucket: string, q: string, prefix = "") =>
  api
    .get<{ query: string; entries: ObjectEntry[] }>(
      `/buckets/${encodeURIComponent(bucket)}/search`,
      { params: { q, prefix } },
    )
    .then((r) => r.data);

export const uploadFile = (
  bucket: string,
  prefix: string,
  file: File,
  onProgress?: (pct: number) => void,
) => {
  const form = new FormData();
  form.append("prefix", prefix);
  form.append("file", file);
  return api
    .post(`/buckets/${encodeURIComponent(bucket)}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    })
    .then((r) => r.data);
};

export const getDownloadUrl = (bucket: string, key: string) =>
  api
    .get<{ url: string; expiresIn: number }>(
      `/buckets/${encodeURIComponent(bucket)}/download`,
      { params: { key } },
    )
    .then((r) => r.data);

export const previewUrl = (bucket: string, key: string) =>
  `/api/buckets/${encodeURIComponent(bucket)}/preview?key=${encodeURIComponent(key)}`;

export const deleteObject = (bucket: string, key: string) =>
  api
    .delete(`/buckets/${encodeURIComponent(bucket)}/objects`, { params: { key } })
    .then((r) => r.data);

export const createFolder = (bucket: string, prefix: string) =>
  api
    .post(`/buckets/${encodeURIComponent(bucket)}/folders`, { prefix })
    .then((r) => r.data);

// --- admin: users ---
export const adminListUsers = () => api.get<User[]>("/admin/users").then((r) => r.data);

export const adminCreateUser = (data: {
  username: string;
  email: string;
  password: string;
  role: "admin" | "dev";
}) => api.post<User>("/admin/users", data).then((r) => r.data);

export const adminUpdateUser = (
  id: string,
  data: Partial<{ email: string; password: string; role: "admin" | "dev"; active: boolean }>,
) => api.put<User>(`/admin/users/${id}`, data).then((r) => r.data);

export const adminDeleteUser = (id: string) =>
  api.delete(`/admin/users/${id}`).then((r) => r.data);

export const adminGetUserPermissions = (id: string) =>
  api.get<BucketPermission[]>(`/admin/users/${id}/permissions`).then((r) => r.data);

export const adminSetUserPermissions = (
  id: string,
  data: { bucketIds: string[]; canWrite: boolean; canDelete: boolean },
) => api.put(`/admin/users/${id}/permissions`, data).then((r) => r.data);

// --- admin: AWS credentials ---
export const adminListCredentials = () =>
  api.get<AWSCredential[]>("/admin/credentials").then((r) => r.data);

export const adminCreateCredential = (data: {
  name: string;
  authMethod: "irsa" | "assume_role" | "static_keys";
  region: string;
  accessKey?: string;
  secretKey?: string;
  roleArn?: string;
  externalId?: string;
  sessionName?: string;
  isDefault?: boolean;
}) => api.post<AWSCredential>("/admin/credentials", data).then((r) => r.data);

export const adminUpdateCredential = (
  id: string,
  data: Partial<{
    region: string;
    accessKey: string;
    secretKey: string;
    roleArn: string;
    externalId: string;
    sessionName: string;
    isDefault: boolean;
  }>,
) => api.put<AWSCredential>(`/admin/credentials/${id}`, data).then((r) => r.data);

export const adminDeleteCredential = (id: string) =>
  api.delete(`/admin/credentials/${id}`).then((r) => r.data);

export const adminTestCredential = (id: string) =>
  api
    .post<{ account: string; arn: string; userId: string }>(`/admin/credentials/${id}/test`)
    .then((r) => r.data);

// --- admin: bucket registry ---
export const adminListBuckets = () => api.get<Bucket[]>("/admin/buckets").then((r) => r.data);

export const adminCreateBucket = (data: {
  name: string;
  region: string;
  credentialId: string;
}) => api.post<Bucket>("/admin/buckets", data).then((r) => r.data);

export const adminDeleteBucket = (id: string) =>
  api.delete(`/admin/buckets/${id}`).then((r) => r.data);

// --- admin: audit log ---
export const adminListAuditLogs = (params: { limit?: number; offset?: number; action?: string }) =>
  api
    .get<{ entries: AuditLogEntry[]; hasMore: boolean }>("/admin/audit-logs", { params })
    .then((r) => r.data);

export const adminListAuditActions = () =>
  api.get<string[]>("/admin/audit-logs/actions").then((r) => r.data);
