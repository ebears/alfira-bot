import { useEffect, useState } from 'react';
import { useAdminView } from '../../context/AdminViewContext';

const FREQ_LABELS = [
  '25',
  '40',
  '63',
  '100',
  '160',
  '250',
  '400',
  '630',
  '1k',
  '1.6k',
  '2.5k',
  '4k',
  '6.3k',
  '10k',
  '16k',
];
const DEFAULT_BANDS = Array(15).fill(50);

export default function EqualizerSection() {
  const { isAdminView } = useAdminView();
  const [bands, setBands] = useState<number[]>(DEFAULT_BANDS);
  const [savedBands, setSavedBands] = useState<number[]>(DEFAULT_BANDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/equalizer');
        if (res.ok) {
          const data = (await res.json()) as { bands: number[] };
          setBands(data.bands);
          setSavedBands(data.bands);
        }
      } catch {
        // silently fail
      }
    }
    if (isAdminView) load();
  }, [isAdminView]);

  const hasChanges = JSON.stringify(bands) !== JSON.stringify(savedBands);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/equalizer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bands }),
      });
      if (res.ok) {
        setSavedBands(bands);
      } else {
        console.error('Failed to save equalizer settings:', res.status);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setBands(DEFAULT_BANDS);
  }

  function updateBand(index: number, value: number) {
    const next = [...bands];
    next[index] = value;
    setBands(next);
  }

  function gainDisplay(value: number): string {
    const gain = value - 50;
    if (gain === 0) return '0.0 dB';
    return `${gain > 0 ? '+' : ''}${gain.toFixed(1)} dB`;
  }

  return (
    <div className={`space-y-3 ${!isAdminView ? 'opacity-40 pointer-events-none' : ''}`}>
      <h4 className="font-mono text-[11px] text-muted uppercase tracking-wider">Equalizer</h4>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 md:flex-nowrap flex-wrap min-w-[700px] md:min-w-0">
          {bands.map((value, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(e) => updateBand(i, parseInt(e.target.value, 10))}
                className="accent-accent"
                style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '80px' }}
              />
              <span className="font-mono text-[10px] text-muted">{FREQ_LABELS[i]}</span>
              <span className="font-mono text-[10px] text-fg min-w-[3.5em] text-right">{gainDisplay(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`font-body text-sm px-4 py-1.5 rounded transition-colors ${
            hasChanges && !saving
              ? 'bg-accent text-elevated cursor-pointer'
              : 'bg-elevated text-muted cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="font-body text-sm px-4 py-1.5 rounded bg-elevated text-muted hover:text-fg transition-colors cursor-pointer"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
