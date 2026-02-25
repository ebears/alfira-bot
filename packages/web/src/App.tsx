import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PlayerProvider } from './context/PlayerContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SongsPage from './pages/SongsPage';
import PlaylistsPage from './pages/PlaylistsPage';
import PlaylistDetailPage from './pages/PlaylistDetailPage';
import PlayerPage from './pages/PlayerPage';

export default function App() {
  return (
    <AuthProvider>
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
          <Route path="player" element={<PlayerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
