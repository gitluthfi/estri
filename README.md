# estri

**estri** is a modern, web-based S3 file browser with multi-bucket support, admin-managed
AWS credential profiles, and role-based access control (RBAC).

estri ships as a **single monolithic binary/image**: the Go server serves both the JSON API
and the built React UI from the same process and the same port. There is nothing to deploy
separately — one Docker image, one Kubernetes Deployment, one Service.

## Features

- **Auth & RBAC** — username/email + password login via JWT stored in an HttpOnly cookie.
  Two roles: `admin` (full access, including credential/user management) and `dev` (browse
  only the buckets they've been granted, with per-bucket write/delete permissions).
- **Multi-bucket S3 browser** — switch between buckets, navigate folders/prefixes, upload
  (multipart, streamed — no size limit imposed by the app), download via presigned URL,
  inline preview for images/text/PDF, delete files/folders, and search within a bucket.
- **Flexible AWS auth**, configurable per credential profile from the admin panel:
  1. **IRSA / EKS Pod Identity** — uses the default AWS SDK credential chain, so it picks up
     the ServiceAccount's IAM role automatically inside Kubernetes.
  2. **Assume Role** — assumes an IAM Role ARN via STS (optionally starting from a static
     base identity), auto-refreshing credentials.
  3. **Static Access Key / Secret Key** — entered in the admin UI, encrypted with AES-256-GCM
     before being stored in PostgreSQL, never returned by the API afterwards.
- **Kubernetes-ready** — one multi-stage Dockerfile, one Deployment/Service, a ServiceAccount
  pre-wired for IRSA, ConfigMap/Secret templates, and both ALB and nginx-ingress examples.

## Architecture

```
┌────────────┐      ┌────────────────────────────────┐
│  Browser   │◄────►│           estri (Go)            │◄────► AWS S3 / STS
│  React SPA │      │  Gin router: /api/* + web/dist  │
└────────────┘      └────────────────┬─────────────────┘
                                      ▼
                                PostgreSQL
                    (users, roles, buckets, encrypted AWS
                     credential profiles, audit log)
```

The `web/` directory holds the React source. It's built once (`npm run build`) into
`web/dist`, which the Go server serves as static files alongside its `/api/*` routes — the
browser only ever talks to one origin, in dev and in production alike. `web/` is a
build-time input, not a separately running service.

## Project structure

```
estri/
├── cmd/server/          entrypoint + first-run admin bootstrap
├── internal/
│   ├── auth/             JWT + bcrypt password hashing
│   ├── config/           env var loading
│   ├── crypto/           AES-256-GCM encryption for stored AWS keys
│   ├── db/               Postgres connection + AutoMigrate
│   ├── handlers/         HTTP handlers, router, and static/SPA file serving
│   ├── middleware/       session auth + RBAC guards
│   ├── models/           GORM models (User, AWSCredential, Bucket, BucketPermission, AuditLog)
│   └── s3client/         credential-aware S3 client factory + object operations
├── web/                 React + TypeScript + Tailwind UI (Vite) — build-time only
│   └── src/
│       ├── api/           axios client + typed endpoint wrappers
│       ├── components/    FileTable, modals, layout, icons
│       ├── context/       auth context
│       └── pages/         Login, Browser, admin/{Users,Credentials,Buckets}
├── k8s/                  Kubernetes manifests (+ kustomization.yaml)
├── Dockerfile            single multi-stage build: web → Go binary → runtime image
└── docker-compose.yml    local dev stack (Postgres + the estri app)
```

## Local development

### Option A — Docker Compose (recommended)

Requires Docker. Builds the single estri image (frontend bundled in) and runs it alongside
Postgres:

```bash
cp .env.example .env   # optional, compose sets sane dev defaults itself
docker compose up --build
```

Then open **http://localhost:8080**. The bootstrap admin account is created automatically on
first startup from the `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars in
`docker-compose.yml` (defaults: `admin` / `admin@estri.local` / `changeme123` — override via
a `.env` file at the repo root or your shell environment before running `docker compose up`).

To let the container reach real AWS from your machine, set `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` (or mount `~/.aws`) in `docker-compose.yml`, then create an `irsa`-type
credential in the admin panel — locally this just falls back to the default SDK chain, which
will pick up whatever AWS identity the container has.

### Option B — run natively

Needs Go 1.22+, Node 20+, and a running Postgres (`docker compose up postgres` works).

```bash
cp .env.example .env   # edit JWT_SECRET / ENCRYPTION_KEY / ADMIN_PASSWORD

# Terminal 1 — API (serves on :8080; UI static files are optional here,
# since Terminal 2's dev server is what you'll actually browse to)
go run ./cmd/server

# Terminal 2 — UI with hot reload, proxying /api to the Go server above
cd web
npm install
npm run dev
```

Open **http://localhost:5173** — Vite proxies `/api/*` to `http://localhost:8080` (see
`web/vite.config.ts`), so the browser still only ever talks to one origin during development
too.

To run the *actual* single-binary monolith locally without Vite: `npm run build` inside
`web/` (produces `web/dist`), then `go run ./cmd/server` and open **http://localhost:8080**
directly — the Go server serves the built UI itself.

## Configuring AWS access

Everything AWS-related is managed from **Admin → AWS Credentials** (admin role required):

1. Create a credential profile, choosing one of the three auth methods.
   - For **Assume Role**, provide the Role ARN (and External ID / session name if your trust
     policy requires them). The role is assumed from whatever base identity is available
     (IRSA, or optional base static keys on the same profile).
   - For **Static Keys**, paste the access key / secret key — they're AES-256-GCM encrypted
     with `ENCRYPTION_KEY` before being written to Postgres and are never sent back to the
     browser once saved (edit screens only let you replace them, not view them).
2. Go to **Admin → Buckets** and register a bucket name + region, bound to one of your
   credential profiles.
3. Go to **Admin → Users** to grant `dev` accounts access to specific buckets, with
   independent write/delete toggles. Admins can always browse every registered bucket.

## Kubernetes deployment

1. **Build & push the image:**
   ```bash
   docker build -t <registry>/estri:<tag> .
   docker push <registry>/estri:<tag>
   ```
   Update the `image:` field in `k8s/deployment.yaml` accordingly.

2. **Secrets** — don't apply `k8s/secret.yaml` as-is; create it for real instead:
   ```bash
   kubectl create namespace estri
   kubectl create secret generic estri-secret -n estri \
     --from-literal=DATABASE_URL='postgres://estri:<password>@<host>:5432/estri?sslmode=require' \
     --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
     --from-literal=ENCRYPTION_KEY="$(openssl rand -base64 32)" \
     --from-literal=ADMIN_PASSWORD='<your-bootstrap-admin-password>'
   ```
   In production, prefer pointing `DATABASE_URL` at a managed database (RDS/Aurora) rather
   than the optional in-cluster `k8s/postgres.yaml` StatefulSet, which is provided for
   demos/small deployments only.

3. **IRSA (optional, EKS only)** — if you want the "IRSA / Pod Identity" AWS auth method to
   work, annotate `k8s/serviceaccount.yaml` with your IAM role ARN before applying, and make
   sure that role's trust policy allows the estri ServiceAccount's OIDC identity.

4. **Apply everything:**
   ```bash
   kubectl apply -k k8s/
   ```
   (`k8s/secret.yaml` is listed in the kustomization for completeness/documentation — since
   you already created the real Secret above, either skip re-applying it or edit
   `kustomization.yaml` to remove it from the list.)

5. **Ingress** — `k8s/ingress.yaml` ships an AWS ALB Ingress Controller example (adjust the
   ACM certificate ARN and hostname) plus a commented-out nginx-ingress alternative. Since
   estri is one Service, the ingress just routes everything to it — no path-splitting needed.

6. Update `COOKIE_DOMAIN` in `k8s/configmap.yaml` to match your real ingress hostname before
   applying.

## Security notes

- `ENCRYPTION_KEY` protects static AWS credentials at rest — treat it like any other
  production secret (rotate carefully: rotating it re-encrypts nothing automatically, so
  existing static-key credentials would need to be re-entered).
- `JWT_SECRET` signs session tokens; rotating it invalidates all active sessions.
- Sessions are HttpOnly cookies (`COOKIE_SECURE=true` in production, HTTPS only).
- Every login and mutating action (user/credential/bucket changes, uploads, deletes) is
  recorded in the `audit_logs` table.

## Database schema

Managed automatically via GORM `AutoMigrate` on backend startup — no separate migration
tooling is required. See `internal/models/models.go` for the full schema (`users`,
`aws_credentials`, `buckets`, `bucket_permissions`, `audit_logs`).
