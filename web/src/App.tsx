import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Browser from "./pages/Browser";
import AdminUsers from "./pages/admin/Users";
import AdminCredentials from "./pages/admin/Credentials";
import AdminBuckets from "./pages/admin/Buckets";
import AdminAuditLog from "./pages/admin/AuditLog";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Browser />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requireRole="admin">
            <Layout>
              <AdminUsers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/credentials"
        element={
          <ProtectedRoute requireRole="admin">
            <Layout>
              <AdminCredentials />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/buckets"
        element={
          <ProtectedRoute requireRole="admin">
            <Layout>
              <AdminBuckets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-log"
        element={
          <ProtectedRoute requireRole="admin">
            <Layout>
              <AdminAuditLog />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
