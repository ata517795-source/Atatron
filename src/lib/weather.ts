/** Live weather from Open-Meteo (no API key required). */

export interface Weather {
  tempC: number;
  feelsC: number;
  humidity: number;
  windKmh: number;
  code: number;
  description: string;
  emoji: string;
  tmaxC: number | null;
  tminC: number | null;
  timezone: string;
}

/** Standard WMO weather interpretation codes (as documented by Open-Meteo). */
const WMO: Record<number, { d: string; e: string }> = {
  0: { d: 'Clear sky', e: '☀️' },
  1: { d: 'Mainly clear', e: '🌤️' },
  2: { d: 'Partly cloudy', e: '⛅' },
  3: { d: 'Overcast', e: '☁️' },
  45: { d: 'Fog', e: '🌫️' },
  48: { d: 'Depositing rime fog', e: '🌫️' },
  51: { d: 'Light drizzle', e: '🌦️' },
  53: { d: 'Drizzle', e: '🌦️' },
  55: { d: 'Dense drizzle', e: '🌧️' },
  56: { d: 'Freezing drizzle', e: '🌧️' },
  57: { d: 'Dense freezing drizzle', e: '🌧️' },
  61: { d: 'Slight rain', e: '🌧️' },
  63: { d: 'Rain', e: '🌧️' },
  65: { d: 'Heavy rain', e: '🌧️' },
  66: { d: 'Freezing rain', e: '🌧️' },
  67: { d: 'Heavy freezing rain', e: '🌧️' },
  71: { d: 'Slight snowfall', e: '🌨️' },
  73: { d: 'Snowfall', e: '🌨️' },
  75: { d: 'Heavy snowfall', e: '❄️' },
  77: { d: 'Snow grains', e: '❄️' },
  80: { d: 'Slight rain showers', e: '🌦️' },
  81: { d: 'Rain showers', e: '🌧️' },
  82: { d: 'Violent rain showers', e: '⛈️' },
  85: { d: 'Slight snow showers', e: '🌨️' },
  86: { d: 'Heavy snow showers', e: '🌨️' },
  95: { d: 'Thunderstorm', e: '⛈️' },
  96: { d: 'Thunderstorm with hail', e: '⛈️' },
  99: { d: 'Thunderstorm with heavy hail', e: '⛈️' },
};

export async function fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const cur = data.current;
  const wmo = WMO[cur.weather_code] ?? { d: 'Unknown conditions', e: '🌍' };
  return {
    tempC: cur.temperature_2m,
    feelsC: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m,
    windKmh: cur.wind_speed_10m,
    code: cur.weather_code,
    description: wmo.d,
    emoji: wmo.e,
    tmaxC: data.daily?.temperature_2m_max?.[0] ?? null,
    tminC: data.daily?.temperature_2m_min?.[0] ?? null,
    timezone: data.timezone ?? 'UTC',
  };
}

export interface SeasonInfo {
  hemisphere: 'Northern' | 'Southern';
  season: string;
  emoji: string;
  note: string;
}

/** Derive the astronomical-ish season from today's date + latitude (hemisphere). */
export function seasonFor(lat: number, date = new Date()): SeasonInfo {
  const hemisphere = lat >= 0 ? 'Northern' : 'Southern';
  const m = date.getUTCMonth(); // 0..11
  const northern = [
    'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer',
    'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter',
  ][m];
  const flip: Record<string, string> = { Winter: 'Summer', Spring: 'Autumn', Summer: 'Winter', Autumn: 'Spring' };
  const season = hemisphere === 'Northern' ? northern : flip[northern];
  const emojiMap: Record<string, string> = { Winter: '⛄', Spring: '🌸', Summer: '🌞', Autumn: '🍂' };
  const tropical = Math.abs(lat) <= 12;
  return {
    hemisphere,
    season,
    emoji: tropical ? '🌴' : emojiMap[season],
    note: tropical
      ? `Near the equator — tropical climate, seasons change little (${hemisphere} Hemisphere)`
      : `It's ${season.toLowerCase()} in the ${hemisphere} Hemisphere right now`,
  };
}
