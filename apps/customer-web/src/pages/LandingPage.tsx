import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ROOM_TYPES = [
  { value: '', label: 'Any type' },
  { value: 'single', label: 'Single Room' },
  { value: 'shared', label: 'Shared Room' },
  { value: 'pg', label: 'PG' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'studio', label: 'Studio' },
];

const STEPS = [
  { label: 'Set your needs', body: 'City, budget, room type — takes 30 seconds.' },
  { label: 'Get matched instantly', body: 'Verified listings filtered to what you actually want, not a wall of noise.' },
  { label: 'Book with confidence', body: 'View details, contact the owner, and lock it in — all in one place.' },
];

const STATS = [
  { number: '2,400+', label: 'Verified listings' },
  { number: '18', label: 'Cities covered' },
  { number: '4.8★', label: 'Avg renter rating' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [roomType, setRoomType] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (roomType) params.set('roomType', roomType);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Hero */}
      <section
        style={{ background: '#0d1117' }}
        className="relative flex flex-col items-center justify-center min-h-[88vh] px-4 py-16 text-center overflow-hidden"
      >
        {/* Subtle background radial — adds depth without decoration */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(2,132,199,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <p
          className="text-xs font-semibold tracking-[0.25em] uppercase mb-6"
          style={{ color: '#fbbf24', letterSpacing: '0.25em' }}
        >
          Verified rooms. Real landlords.
        </p>

        <h1 className="text-4xl sm:text-6xl font-black text-white leading-[1.08] max-w-2xl mb-6">
          Your next room<br />
          <span style={{ color: '#fbbf24' }}>shouldn't be</span>{' '}
          <span className="text-white">a lottery.</span>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-md mb-10 leading-relaxed">
          Search thousands of verified listings across Nepal and India.
          Filter by budget, BHK, and neighborhood — then book directly.
        </p>

        {/* Embedded search */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-lg flex flex-col sm:flex-row gap-2 sm:gap-0 sm:rounded-xl sm:overflow-hidden sm:border sm:border-white/10 sm:bg-white/5 sm:backdrop-blur-sm p-0"
        >
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Which city?"
            className="flex-1 px-4 py-3 bg-white/10 sm:bg-transparent text-white placeholder-slate-400 rounded-xl sm:rounded-none text-sm focus:outline-none focus:bg-white/15 transition-colors border border-white/10 sm:border-0"
          />
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="px-4 py-3 bg-white/10 sm:bg-transparent text-white rounded-xl sm:rounded-none text-sm focus:outline-none appearance-none cursor-pointer border border-white/10 sm:border-0 sm:border-l sm:border-white/10"
          >
            {ROOM_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value} className="text-gray-900 bg-white">
                {rt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-6 py-3 font-semibold text-sm text-white rounded-xl sm:rounded-none transition-colors"
            style={{ background: '#0284c7' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0369a1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0284c7'; }}
          >
            Search rooms
          </button>
        </form>

        <p className="text-slate-500 text-xs mt-4">No sign-up needed to browse</p>
      </section>

      {/* Stats strip */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-8 grid grid-cols-3 divide-x divide-gray-100">
          {STATS.map((s) => (
            <div key={s.label} className="text-center px-4">
              <p
                className="text-2xl sm:text-3xl font-black tabular-nums"
                style={{ color: '#0284c7' }}
              >
                {s.number}
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f8fafc] flex-1 px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">How it works</h2>
          <p className="text-gray-500 text-sm mb-10">Three steps. No hidden surprises.</p>
          <div className="space-y-0">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-5 pb-8">
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: '#0284c7' }}
                  >
                    {i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 mt-2" style={{ background: '#e2e8f0' }} />
                  )}
                </div>
                <div className="pt-1 pb-2">
                  <p className="font-semibold text-gray-900 text-sm">{step.label}</p>
                  <p className="text-gray-500 text-sm mt-1">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{ background: '#0d1117' }}
        className="px-4 py-14 text-center"
      >
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to find your room?
        </h2>
        <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto">
          Join thousands of renters who found their place through RoomFinder.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/search')}
            className="px-6 py-3 rounded-lg font-semibold text-sm text-white transition-colors"
            style={{ background: '#0284c7' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0369a1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0284c7'; }}
          >
            Browse listings
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
            style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            Sign in
          </button>
        </div>
      </section>
    </div>
  );
}
