import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import { useGame } from '../store/gameStore';
import { countryColor } from '../lib/colors';
import { WORLD_FEATURES, countryOfFeature, featureName, type CountryFeature } from '../lib/worldGeo';
import { Starfield } from './Starfield';

export function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const selectCountry = useGame((s) => s.selectCountry);
  const selectedCca3 = useGame((s) => s.selectedCca3);
  const selectedRef = useRef<string | null>(selectedCca3);

  useEffect(() => {
    selectedRef.current = selectedCca3;
    // re-trigger accessor evaluation so the selected country stays highlighted
    globeRef.current?.polygonCapColor(capColor).polygonAltitude(altitude);
  }, [selectedCca3]);

  function capColor(obj: object): string {
    const f = obj as CountryFeature;
    const c = countryOfFeature(f);
    const col = countryColor(c?.cca3);
    if (c && selectedRef.current === c.cca3) return col.bright;
    return hoverRef.current === f ? col.bright : col.fill;
  }

  function altitude(obj: object): number {
    const f = obj as CountryFeature;
    const c = countryOfFeature(f);
    if (c && selectedRef.current === c.cca3) return 0.045;
    return hoverRef.current === f ? 0.045 : 0.012;
  }

  const hoverRef = useRef<CountryFeature | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const globe = new Globe(el, { animateIn: true })
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#ff9d6f')
      .atmosphereAltitude(0.16)
      .polygonsData(WORLD_FEATURES as unknown as object[])
      .polygonCapColor(capColor)
      .polygonSideColor(() => 'rgba(12, 18, 51, 0.72)')
      .polygonStrokeColor(() => 'rgba(7, 11, 36, 0.9)')
      .polygonAltitude(altitude)
      .polygonsTransitionDuration(220)
      .polygonLabel((obj: object) => {
        const f = obj as CountryFeature;
        const c = countryOfFeature(f);
        return `<div style="font-family:Nunito,sans-serif;background:rgba(12,18,51,.92);border:1px solid rgba(255,179,71,.5);padding:6px 12px;border-radius:10px;font-weight:800;font-size:14px;color:#ffe29a">
          ${c ? `${c.flagEmoji} ` : ''}${featureName(f)}
        </div>`;
      })
      .onPolygonHover((h: object | null) => {
        hoverRef.current = h as CountryFeature | null;
        el.style.cursor = h ? 'pointer' : 'grab';
        globe.polygonCapColor(capColor).polygonAltitude(altitude);
      })
      .onPolygonClick((obj: object) => {
        const c = countryOfFeature(obj as CountryFeature);
        if (!c) return;
        globe.controls().autoRotate = false;
        selectCountry(c.cca3);
        globe.pointOfView({ lat: c.latlng[0], lng: c.latlng[1], altitude: 1.6 }, 850);
      });

    globe.globeMaterial().color.set('#10225c');
    globe.pointOfView({ lat: 18, lng: 12, altitude: 2.2 }, 0);
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.45;
    globe.controls().addEventListener('start', () => {
      globe.controls().autoRotate = false;
    });

    const ro = new ResizeObserver(() => {
      globe.width(el.clientWidth).height(el.clientHeight);
    });
    ro.observe(el);
    globe.width(el.clientWidth).height(el.clientHeight);
    globeRef.current = globe;

    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'x') return;
      const pov = globe.pointOfView();
      const next = Math.min(4, Math.max(0.15, pov.altitude * (k === 'z' ? 0.68 : 1.47)));
      globe.pointOfView({ altitude: next }, 280);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      globeRef.current = null;
      globe._destructor();
      el.replaceChildren(); // drop the dead canvas (StrictMode double-mount)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-dusk-950 via-dusk-900 to-[#1a1038]">
      <Starfield />
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-dusk-900/80 px-4 py-1.5 text-xs font-bold text-gold-300/90 backdrop-blur">
        Drag to spin · Hover for names · Click a country · <kbd className="text-amber-glow">Z</kbd> zoom in · <kbd className="text-amber-glow">X</kbd> zoom out
      </div>
    </div>
  );
}
