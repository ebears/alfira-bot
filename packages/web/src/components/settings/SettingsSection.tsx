import type React from 'react';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="font-mono text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
