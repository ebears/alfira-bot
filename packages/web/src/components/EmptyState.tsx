export default function EmptyState({
  title,
  message,
  isAdmin,
  onAdd,
  addLabel,
}: {
  title: string;
  message?: string;
  isAdmin: boolean;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">{title}</p>
      {message ? (
        <p className="font-mono text-xs text-faint">{message}</p>
      ) : isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button type="button" className="text-accent hover:underline" onClick={onAdd}>
            {addLabel}
          </button>{' '}
          to get started
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no songs have been added yet</p>
      )}
    </div>
  );
}
