import * as topojson from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import type { Country } from './countries';
import { countryForAtlasId } from './countries';

export interface CountryFeature {
  type: 'Feature';
  id?: string | number;
  properties: { name?: string };
  geometry: GeoJSON.Geometry;
}

/** GeoJSON features for every country shape in the world-atlas 110m TopoJSON. */
export const WORLD_FEATURES: CountryFeature[] = (
  topojson.feature(worldTopo, worldTopo.objects.countries) as unknown as {
    features: CountryFeature[];
  }
).features;

/** Adjacency between country shapes (index-aligned with WORLD_FEATURES). */
export const NEIGHBORS: number[][] = topojson.neighbors(worldTopo.objects.countries.geometries);

const featureCountry = new Map<CountryFeature, Country | undefined>();
for (const f of WORLD_FEATURES) {
  featureCountry.set(f, countryForAtlasId(f.id, f.properties?.name));
}

export function countryOfFeature(f: CountryFeature): Country | undefined {
  return featureCountry.get(f);
}

export function featureName(f: CountryFeature): string {
  return countryOfFeature(f)?.name ?? f.properties?.name ?? 'Unknown territory';
}
