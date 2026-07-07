import type { ReactNode } from 'react';
import { useGame } from '../store/gameStore';
import { byCca3, formatArea, formatPopulation } from '../lib/countries';
import { useAsync } from '../lib/useAsync';
import { fetchCountryLive, fetchDishes, fetchEndemicSpecies, fetchLandmarks } from '../lib/wikidata';
import { fetchFirstSummary, fetchWikiSummary } from '../lib/wikipedia';
import { fetchWeather, seasonFor } from '../lib/weather';

const UNAVAILABLE = <span className="text-sm font-semibold text-white/35">Data unavailable</span>;

function Skeleton({ className = 'h-4 w-24' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-amber-glow">
        <span aria-hidden>{icon}</span> {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-dusk-800/80 px-3 py-2">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-white/90">{value}</div>
    </div>
  );
}

export function CountryPanel() {
  const selectedCca3 = useGame((s) => s.selectedCca3);
  const selectCountry = useGame((s) => s.selectCountry);
  const enterCountry = useGame((s) => s.enterCountry);
  const country = selectedCca3 ? byCca3.get(selectedCca3) : undefined;

  const cca2 = country?.cca2 ?? '';
  const live = useAsync(() => fetchCountryLive(cca2), [cca2]);

  const weather = useAsync(async () => {
    if (!country) throw new Error('no country');
    let lat = country.latlng[0];
    let lng = country.latlng[1];
    let label = country.capital[0] ?? country.name;
    try {
      const l = await fetchCountryLive(country.cca2);
      if (l.capital) ({ lat, lng } = l.capital), (label = l.capital.name);
    } catch {
      /* fall back to country centroid */
    }
    return { w: await fetchWeather(lat, lng), label, season: seasonFor(lat) };
  }, [cca2]);

  const about = useAsync(async () => {
    if (!country) throw new Error('no country');
    return fetchWikiSummary(country.name).catch(() => null);
  }, [cca2]);

  const landmarks = useAsync(async () => {
    const l = await fetchCountryLive(cca2);
    return fetchLandmarks(l.qid);
  }, [cca2]);

  const wildlife = useAsync(async () => {
    if (!country) throw new Error('no country');
    const [summary, endemic] = await Promise.all([
      fetchFirstSummary([`Wildlife of ${country.name}`, `Fauna of ${country.name}`]),
      fetchCountryLive(cca2).then((l) => fetchEndemicSpecies(l.qid)).catch(() => []),
    ]);
    return { summary, endemic };
  }, [cca2]);

  const dishes = useAsync(async () => {
    const l = await fetchCountryLive(cca2);
    return fetchDishes(l.qid);
  }, [cca2]);

  if (!country) return null;
  const liveData = live.status === 'ok' ? live.data : null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-105 animate-fade-in flex-col border-l border-amber-glow/25 bg-dusk-900/95 shadow-2xl backdrop-blur-md">
      {/* header */}
      <header className="flex items-start gap-3 border-b border-white/10 p-4">
        <img
          src={country.flagPng}
          alt={`Flag of ${country.name}`}
          className="mt-1 w-16 rounded-md shadow-md ring-1 ring-white/20"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-extrabold text-gold-300">
            {country.name} <span aria-hidden>{country.flagEmoji}</span>
          </h2>
          <p className="truncate text-xs font-semibold text-white/50">{country.officialName}</p>
          <p className="mt-1 text-xs font-bold text-coral-300">
            {country.region}
            {country.subregion ? ` · ${country.subregion}` : ''}
          </p>
        </div>
        <button
          onClick={() => selectCountry(null)}
          aria-label="Close panel"
          className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-black text-white/70 transition hover:bg-coral-500/40 hover:text-white"
        >
          ✕
        </button>
      </header>

      {/* scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <Section icon="📌" title="Fast facts">
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Capital" value={country.capital.join(', ') || UNAVAILABLE} />
            <Fact
              label="Population (live)"
              value={
                live.status === 'loading' ? (
                  <Skeleton />
                ) : liveData?.population ? (
                  formatPopulation(liveData.population)
                ) : (
                  UNAVAILABLE
                )
              }
            />
            <Fact label="Languages" value={country.languages.join(', ') || UNAVAILABLE} />
            <Fact
              label="Currency"
              value={
                country.currencies.map((c) => `${c.name} (${c.symbol || c.code})`).join(', ') ||
                UNAVAILABLE
              }
            />
            <Fact label="Area" value={formatArea(country.area)} />
            <Fact
              label="Neighbors"
              value={country.borders.length ? `${country.borders.length} countries` : country.landlocked ? 'None' : 'Ocean on all sides 🌊'}
            />
          </div>
        </Section>

        <Section icon="🌦️" title="Weather right now">
          {weather.status === 'loading' && <Skeleton className="h-20 w-full" />}
          {weather.status === 'error' && UNAVAILABLE}
          {weather.status === 'ok' && (
            <div className="rounded-2xl bg-gradient-to-br from-dusk-700 to-dusk-800 p-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl" aria-hidden>{weather.data.w.emoji}</span>
                <div>
                  <div className="font-display text-3xl font-extrabold text-white">
                    {Math.round(weather.data.w.tempC)}°C
                  </div>
                  <div className="text-xs font-bold text-white/70">
                    {weather.data.w.description} in {weather.data.label}
                  </div>
                </div>
                <div className="ml-auto text-right text-[11px] font-semibold leading-5 text-white/55">
                  Feels {Math.round(weather.data.w.feelsC)}°C
                  <br />💨 {Math.round(weather.data.w.windKmh)} km/h · 💧 {weather.data.w.humidity}%
                  {weather.data.w.tmaxC !== null && (
                    <>
                      <br />↑ {Math.round(weather.data.w.tmaxC!)}° ↓ {Math.round(weather.data.w.tminC ?? 0)}°
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 rounded-lg bg-dusk-950/50 px-2.5 py-1.5 text-xs font-bold text-gold-300">
                {weather.data.season.emoji} {weather.data.season.note}
              </div>
            </div>
          )}
        </Section>

        <Section icon="📖" title="About">
          {about.status === 'loading' && <Skeleton className="h-16 w-full" />}
          {about.status !== 'loading' &&
            (about.status === 'ok' && about.data ? (
              <p className="text-sm leading-6 text-white/80">
                {about.data.extract.length > 340
                  ? `${about.data.extract.slice(0, 340)}…`
                  : about.data.extract}{' '}
                <a
                  href={about.data.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-coral-300 underline decoration-coral-500/50 hover:text-coral-400"
                >
                  Wikipedia →
                </a>
              </p>
            ) : (
              UNAVAILABLE
            ))}
        </Section>

        <Section icon="🏛️" title="Leaders today">
          {live.status === 'loading' && <Skeleton className="h-10 w-full" />}
          {live.status === 'error' && UNAVAILABLE}
          {liveData && (
            <div className="space-y-1.5">
              {liveData.headsOfState.length > 0 && (
                <div className="text-sm">
                  <span className="font-extrabold text-white/50">Head of State: </span>
                  <span className="font-bold text-white/90">{liveData.headsOfState.join(' & ')}</span>
                </div>
              )}
              {liveData.headsOfGov.length > 0 && (
                <div className="text-sm">
                  <span className="font-extrabold text-white/50">Head of Government: </span>
                  <span className="font-bold text-white/90">{liveData.headsOfGov.join(' & ')}</span>
                </div>
              )}
              {liveData.headsOfState.length === 0 && liveData.headsOfGov.length === 0 && UNAVAILABLE}
              <p className="text-[10px] font-semibold text-white/30">Live from Wikidata</p>
            </div>
          )}
        </Section>

        <Section icon="🗿" title="Famous landmarks">
          {landmarks.status === 'loading' && <Skeleton className="h-24 w-full" />}
          {landmarks.status === 'error' && UNAVAILABLE}
          {landmarks.status === 'ok' &&
            (landmarks.data.length === 0 ? (
              UNAVAILABLE
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {landmarks.data.slice(0, 10).map((l) => (
                  <figure key={l.qid} className="w-32 shrink-0">
                    {l.imageUrl ? (
                      <img
                        src={l.imageUrl}
                        alt={l.name}
                        loading="lazy"
                        className="h-20 w-32 rounded-lg object-cover ring-1 ring-white/15"
                      />
                    ) : (
                      <div className="flex h-20 w-32 items-center justify-center rounded-lg bg-dusk-700 text-2xl">🗿</div>
                    )}
                    <figcaption className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-white/75">
                      {l.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
        </Section>

        <Section icon="🦜" title="Native animals & plants">
          {wildlife.status === 'loading' && <Skeleton className="h-16 w-full" />}
          {wildlife.status === 'error' && UNAVAILABLE}
          {wildlife.status === 'ok' && (
            <>
              {wildlife.data.summary ? (
                <p className="text-sm leading-6 text-white/80">
                  {wildlife.data.summary.extract.length > 260
                    ? `${wildlife.data.summary.extract.slice(0, 260)}…`
                    : wildlife.data.summary.extract}{' '}
                  <a
                    href={wildlife.data.summary.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-coral-300 underline decoration-coral-500/50"
                  >
                    Wikipedia →
                  </a>
                </p>
              ) : wildlife.data.endemic.length === 0 ? (
                UNAVAILABLE
              ) : null}
              {wildlife.data.endemic.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {wildlife.data.endemic.slice(0, 8).map((s) => (
                    <span
                      key={s.qid}
                      className="rounded-full bg-dusk-700 px-2.5 py-1 text-[11px] font-bold text-white/80"
                      title={s.name}
                    >
                      {s.kingdom === 'animal' ? '🐾' : '🌿'} {s.commonName ?? s.name}
                    </span>
                  ))}
                </div>
              )}
              {wildlife.data.endemic.length > 0 && (
                <p className="mt-1 text-[10px] font-semibold text-white/30">
                  🐾🌿 Endemic species — live from Wikidata
                </p>
              )}
            </>
          )}
        </Section>

        <Section icon="🍲" title="Signature dishes & drinks">
          {dishes.status === 'loading' && <Skeleton className="h-10 w-full" />}
          {dishes.status === 'error' && UNAVAILABLE}
          {dishes.status === 'ok' &&
            (dishes.data.length === 0 ? (
              UNAVAILABLE
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dishes.data.map((d) => (
                  <span
                    key={d.qid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-dusk-700 px-2.5 py-1 text-[11px] font-bold text-white/85"
                  >
                    {d.imageUrl && (
                      <img src={d.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" loading="lazy" />
                    )}
                    {d.name}
                  </span>
                ))}
              </div>
            ))}
        </Section>

        <Section icon="🎵" title="National anthem">
          {live.status === 'loading' && <Skeleton className="h-8 w-full" />}
          {live.status === 'error' && UNAVAILABLE}
          {liveData &&
            (liveData.anthem ? (
              <div className="rounded-xl bg-dusk-800/80 p-3">
                <div className="text-sm font-bold text-white/90">{liveData.anthem.name}</div>
                {liveData.anthem.audioUrl ? (
                  <>
                    <audio controls preload="none" src={liveData.anthem.audioUrl} className="mt-2 h-9 w-full" />
                    <p className="mt-1 text-[10px] font-semibold text-white/35">
                      Recording via Wikimedia Commons (free-licensed / public domain)
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-white/50">No free recording available.</p>
                )}
                {liveData.anthem.articleUrl && (
                  <a
                    href={liveData.anthem.articleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-bold text-coral-300 underline decoration-coral-500/50"
                  >
                    Read about the anthem →
                  </a>
                )}
              </div>
            ) : (
              UNAVAILABLE
            ))}
        </Section>

        <p className="mt-6 text-center text-[10px] font-semibold leading-4 text-white/30">
          Live data: Wikidata · Wikipedia · Open-Meteo · FlagCDN
          <br />
          Country dataset: mledoze/countries (ODbL)
        </p>
      </div>

      {/* GO! */}
      <footer className="border-t border-white/10 p-3">
        <button
          onClick={() => enterCountry(country.cca3)}
          className="w-full rounded-2xl bg-gradient-to-r from-coral-500 via-coral-400 to-amber-glow py-3.5 font-display text-2xl font-extrabold tracking-wide text-dusk-950 shadow-lg shadow-coral-600/40 transition hover:scale-[1.015] hover:shadow-coral-500/60"
        >
          GO! Step into {country.name} {country.flagEmoji}
        </button>
      </footer>
    </aside>
  );
}
