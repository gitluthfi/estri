export type Role = "admin" | "dev";

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
}

export type AWSAuthMethod = "irsa" | "assume_role" | "static_keys";

export interface AWSCredential {
  id: string;
  name: string;
  authMethod: AWSAuthMethod;
  region: string;
  roleArn?: string;
  externalId?: string;
  sessionName?: string;
  hasStaticKeys: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bucket {
  id: string;
  name: string;
  region: string;
  credentialId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessibleBucket extends Bucket {
  canWrite: boolean;
  canDelete: boolean;
}

export interface BucketPermission {
  id: string;
  userId: string;
  bucketId: string;
  bucket?: Bucket;
  canWrite: boolean;
  canDelete: boolean;
  createdAt: string;
}

export interface ObjectEntry {
  key: string;
  name: string;
  isFolder: boolean;
  size: number;
  lastModified?: string;
}
