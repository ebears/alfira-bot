const TAG_COLORS = [
  { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
] as const;

/** djb2 hash — deterministic, fast, good distribution for short strings */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Returns deterministic color classes for a given tag string */
export function getTagColorClasses(tag: string): (typeof TAG_COLORS)[number] {
  return TAG_COLORS[djb2(tag.toLowerCase()) % TAG_COLORS.length];
}
