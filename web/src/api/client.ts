import axios from "axios";

// Session is carried via an HttpOnly cookie set by the backend, so we just
// need withCredentials for cross-origin dev setups (Vite on :5173, API on
// :8080). In production the frontend is typically served behind the same
// ingress/domain as the API.
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error || error.message || "Unexpected error";
    return Promise.reject(new Error(message));
  },
);
