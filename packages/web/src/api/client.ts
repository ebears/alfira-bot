import axios from 'axios';

// ---------------------------------------------------------------------------
// Axios instance
//
// Uses relative URLs so Vite's dev proxy forwards /api and /auth requests to
// the Express server on :3001. In production, configure a reverse proxy
// (nginx, Caddy, etc.) to do the same thing.
//
// withCredentials is set globally so the HttpOnly session cookie is sent on
// every request automatically.
// ---------------------------------------------------------------------------
const client = axios.create({
  withCredentials: true,
});

// Intercept 401 responses globally — redirect to login without flash.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
