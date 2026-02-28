import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminViewProvider } from './context/AdminViewContext';
import { PlayerProvider } from './context/PlayerContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SongsPage from './pages/SongsPage';
import PlaylistsPage from './pages/PlaylistsPage';
import PlaylistDetailPage from './pages/PlaylistDetailPage';
import QueuePage from './pages/QueuePage';

export default function App() {
  return (
    <AuthProvider>
      <AdminViewProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {/* PlayerProvider lives inside ProtectedRoute so it only
                    polls while a user is authenticated. */}
                <PlayerProvider>
                  <Layout />
                </PlayerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/songs" replace />} />
            <Route path="songs" element={<SongsPage />} />
            <Route path="playlists" element={<PlaylistsPage />} />
            <Route path="playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="queue" element={<QueuePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminViewProvider>
    </AuthProvider>
  );
}
