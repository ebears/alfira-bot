import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, go straight to songs.
  useEffect(() => {
    if (!loading && user) navigate('/songs', { replace: true });
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg, transparent, transparent 40px,
            #c8f135 40px, #c8f135 41px
          ), repeating-linear-gradient(
            90deg, transparent, transparent 40px,
            #c8f135 40px, #c8f135 41px
          )`,
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-fade-up">
        <div className="bg-surface border border-border rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="font-display text-6xl text-accent tracking-widest">alfira</h1>
            <p className="font-mono text-xs text-muted mt-2 tracking-widest uppercase">
              music bot
            </p>
          </div>

          {/* Description */}
          <p className="font-body text-sm text-muted text-center mb-8 leading-relaxed">
            Log in with your Discord account to access the music library and controls.
          </p>

          {/* Login button — redirects to Express OAuth handler */}
          <a
            href="/auth/login"
            className="flex items-center justify-center gap-3 w-full bg-[#5865F2]
                       hover:bg-[#4752C4] text-white font-body font-bold text-sm
                       px-6 py-3 rounded transition-colors duration-150"
          >
            <DiscordIcon />
            Login with Discord
          </a>
        </div>

        <p className="text-center font-mono text-[10px] text-faint mt-6 tracking-widest uppercase">
          access is restricted to server members
        </p>
      </div>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0
        0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0
        0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0
        0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0
        0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.042.031.053a19.9
        19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295
        1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0
        1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0
        .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074
        0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0
        1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0
        0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0
        0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0
        0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0
        0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419
        2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157
        2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419
        2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
