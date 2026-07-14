interface Props {
  label: string;
  value: string | number;
  sub?: string;
  live?: boolean;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}

const ACCENT = {
  blue:  { bar: 'bg-brand-600', sub: 'text-brand-600' },
  green: { bar: 'bg-emerald-500', sub: 'text-emerald-600' },
  amber: { bar: 'bg-amber-500',   sub: 'text-amber-600' },
  red:   { bar: 'bg-red-500',     sub: 'text-red-600' },
};

export function StatCard({ label, value, sub, live, accent = 'blue' }: Props) {
  const a = ACCENT[accent];
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 relative overflow-hidden shadow-sm">
      <div className={`absolute top-0 left-0 w-full h-0.5 ${a.bar}`} />
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {live && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${a.bar} stat-pulse`} />
            live
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${a.sub}`}>{sub}</p>}
    </div>
  );
}
