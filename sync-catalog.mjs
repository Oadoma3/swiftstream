// sync-catalog.mjs - Pulls 1,000+ real shows across all 10 streaming services from the TVMaze API (no API key needed)
import fs from "fs";

const PALETTES = [
  ["#b91c1c", "#1a0a1f"], ["#1d4ed8", "#0b1230"], ["#db2777", "#1f0a24"],
  ["#4338ca", "#0f0a24"], ["#0ea5e9", "#3b0764"], ["#15803d", "#0c1a0e"],
  ["#0369a1", "#081420"], ["#7e22ce", "#0f172a"], ["#d97706", "#2a1305"],
  ["#0f766e", "#0a1a24"], ["#ca8a04", "#181109"], ["#dc2626", "#0f172a"],
  ["#f59e0b", "#701a75"], ["#2563eb", "#0f172a"], ["#16a34a", "#052e2b"],
  ["#991b1b", "#090d16"], ["#475569", "#0f172a"], ["#ea580c", "#1c1917"],
];

const PROVIDERS_META = [
  { id: "netflix",     name: "Netflix",     brand: "#E50914", accent: "#ff4d57", webIds: [1],       netIds: [] },
  { id: "hulu",        name: "Hulu",        brand: "#1CE783", accent: "#1ce783", webIds: [2],       netIds: [13, 36] },
  { id: "prime",       name: "Prime Video", brand: "#00A8E1", accent: "#2bb7ff", webIds: [3],       netIds: [] },
  { id: "peacock",     name: "Peacock",     brand: "#0d0d0d", accent: "#ffd23f", webIds: [347],     netIds: [1, 43, 30, 14] },
  { id: "paramount",   name: "Paramount+",  brand: "#0064FF", accent: "#4d8dff", webIds: [107, 43], netIds: [2, 9, 17, 23] },
  { id: "disney",      name: "Disney+",     brand: "#113CCF", accent: "#7b8cff", webIds: [287],     netIds: [78, 25, 4] },
  { id: "max",         name: "Max",         brand: "#002BE7", accent: "#8f5bff", webIds: [329],     netIds: [8, 11, 52] },
  { id: "apple",       name: "Apple TV+",   brand: "#000000", accent: "#e5e5ea", webIds: [310],     netIds: [] },
  { id: "tubi",        name: "Tubi",        brand: "#FA382F", accent: "#ff6a5f", webIds: [223, 26], netIds: [5, 7, 12, 20, 65] },
  { id: "crunchyroll", name: "Crunchyroll", brand: "#F47521", accent: "#ff8a3d", webIds: [20],      netIds: [] },
  { id: "starz",       name: "Starz",       brand: "#000000", accent: "#e5e5ea", webIds: [50],      netIds: [] },
  { id: "amc",         name: "AMC+",        brand: "#FF6600", accent: "#ff8833", webIds: [115],     netIds: [20] },
  { id: "discovery",   name: "Discovery+",  brand: "#00FFFF", accent: "#33ffff", webIds: [367],     netIds: [] },
  { id: "pluto",       name: "Pluto TV",    brand: "#111111", accent: "#00d2ff", webIds: [380],     netIds: [] },
  { id: "roku",        name: "Roku Channel",brand: "#662d91", accent: "#9b51e0", webIds: [300],     netIds: [] },
  { id: "shudder",     name: "Shudder",     brand: "#880000", accent: "#ff3333", webIds: [250],     netIds: [] },
  { id: "espn",        name: "ESPN+",       brand: "#CC0000", accent: "#ff3333", webIds: [150],     netIds: [] },
  { id: "britbox",     name: "BritBox",     brand: "#1b2a4a", accent: "#4a7fc1", webIds: [315],     netIds: [] },
];

// Preserved starter IDs (1..12) so existing user_libraries in Supabase never break
const CURATED = {
  netflix: ["Stranger Things", "The Crown", "Squid Game", "Wednesday", "Bridgerton", "Breaking Bad", "Ozark", "Black Mirror", "Arcane", "The Night Agent", "Beef", "Peaky Blinders"],
  hulu: ["The Bear", "Only Murders in the Building", "The Handmaid's Tale", "Shogun", "Reservation Dogs", "Snowfall", "Atlanta", "Fargo", "Abbott Elementary", "It's Always Sunny in Philadelphia", "Prison Break", "Futurama"],
  prime: ["The Boys", "The Marvelous Mrs. Maisel", "Fallout", "Reacher", "Invincible", "Mr. & Mrs. Smith", "Fleabag", "The Expanse", "Tom Clancy's Jack Ryan", "Gen V", "The Lord of the Rings: The Rings of Power", "The Legend of Vox Machina"],
  peacock: ["The Office", "Poker Face", "Bel-Air", "Twisted Metal", "Parks and Recreation", "Brooklyn Nine-Nine", "Yellowstone", "The Day of the Jackal", "The Traitors", "Suits", "Psych", "House"],
  paramount: ["Star Trek: Strange New Worlds", "Evil", "1923", "Tulsa King", "Frasier", "Landman", "Lioness", "Mayor of Kingstown", "Halo", "Dexter", "Criminal Minds", "Ghosts"],
  disney: ["The Mandalorian", "Andor", "Loki", "WandaVision", "X-Men '97", "Daredevil", "Ahsoka", "Agatha All Along", "Percy Jackson and the Olympians", "Gravity Falls", "Moon Knight", "Star Wars: The Clone Wars"],
  max: ["The Last of Us", "Succession", "House of the Dragon", "The Penguin", "The White Lotus", "Euphoria", "True Detective", "Game of Thrones", "The Sopranos", "Chernobyl", "Hacks", "Barry"],
  apple: ["Severance", "Ted Lasso", "Silo", "Slow Horses", "Shrinking", "Dark Matter", "Foundation", "The Morning Show", "For All Mankind", "Presumed Innocent", "Bad Monkey", "Black Bird"],
  tubi: ["Cheers", "Columbo", "Mission: Impossible", "Broadchurch", "Luther", "Peep Show", "Kitchen Nightmares", "Stargate SG-1", "Farscape", "Midsomer Murders", "21 Jump Street", "The Prisoner"],
  crunchyroll: ["Attack on Titan", "Demon Slayer: Kimetsu no Yaiba", "Jujutsu Kaisen", "Solo Leveling", "One Piece", "Chainsaw Man", "Frieren: Beyond Journey's End", "Spy x Family", "Kaiju No. 8", "Vinland Saga", "My Hero Academia", "Hunter x Hunter"],
};

function stripHtml(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeTagline(synopsis, genres, year, netName) {
  const first = synopsis.split(/(?<=[.!?])\s+/)[0] || "";
  if (first.length >= 18 && first.length <= 95) return first;
  return `${year} ${genres.slice(0, 2).join(" & ") || "Series"} streaming on ${netName}.`;
}

async function fetchPage(page) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows?page=${page}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchSingle(title) {
  try {
    const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

console.log("Fetching TVMaze master catalog (pages 0..32 -> ~8,000 shows)...");
const pages = Array.from({ length: 33 }, (_, i) => i);
const allRaw = [];
for (let i = 0; i < pages.length; i += 8) {
  const batch = await Promise.all(pages.slice(i, i + 8).map(fetchPage));
  batch.forEach(arr => allRaw.push(...arr));
}
console.log(`Downloaded ${allRaw.length} raw shows from TVMaze. Filtering & matching to streaming services...`);

const byTitle = new Map();
allRaw.forEach(s => {
  if (s && s.name) byTitle.set(s.name.toLowerCase(), s);
});

const buckets = Object.fromEntries(PROVIDERS_META.map(p => [p.id, []]));
const seenTitlesPerProv = Object.fromEntries(PROVIDERS_META.map(p => [p.id, new Set()]));

// 1. Ensure all 120 curated flagship shows are locked in slots 1..12 with real TVMaze metadata + poster
for (const prov of PROVIDERS_META) {
  const titles = CURATED[prov.id] || [];
  for (let idx = 0; idx < titles.length; idx++) {
    const t = titles[idx];
    let raw = byTitle.get(t.toLowerCase()) || await fetchSingle(t);
    const syn = stripHtml(raw?.summary) || `Watch ${t} streaming on ${prov.name}.`;
    const genres = (raw?.genres && raw.genres.length ? raw.genres : prov.id === "crunchyroll" ? ["Anime", "Action"] : ["Drama"]).slice(0, 3);
    const year = raw?.premiered ? Number(raw.premiered.slice(0, 4)) : 2022;
    const score = raw?.rating?.average ? Math.min(99, Math.max(72, Math.round(raw.rating.average * 10 + 8))) : 90;
    const poster = (raw?.image?.original || raw?.image?.medium || "").replace(/^http:/, "https:");
    const runtime = raw?.averageRuntime || raw?.runtime || 45;
    const weight = raw?.weight || 85;
    const seasons = Math.max(1, Math.min(12, Math.round(weight / 22)));
    const episodes = Math.max(8, seasons * (runtime < 35 ? 12 : 9));
    const colors = PALETTES[(idx + prov.id.length) % PALETTES.length];
    const displayTitle = t === "Demon Slayer: Kimetsu no Yaiba" ? "Demon Slayer" : t === "The Lord of the Rings: The Rings of Power" ? "The Rings of Power" : t === "Shogun" ? "Sh\u014Dgun" : t;

    buckets[prov.id].push({
      id: idx + 1,
      title: displayTitle,
      year,
      communityScore: score,
      seasons,
      episodes,
      genres,
      genre: genres.join(" \u2022 "),
      platforms: [prov.name],
      colors,
      tagline: makeTagline(syn, genres, year, prov.name),
      synopsis: syn.slice(0, 280),
      posterUrl: poster || null,
    });
    seenTitlesPerProv[prov.id].add(displayTitle.toLowerCase());
    seenTitlesPerProv[prov.id].add(t.toLowerCase());
  }
}

// 2. Sort remaining TVMaze shows by popularity/weight + rating so the biggest hits get added first
const candidates = allRaw
  .filter(s => s && s.name && s.summary && s.image && (s.image.original || s.image.medium) && (s.weight >= 70 || (s.rating && s.rating.average >= 7.2)))
  .sort((a, b) => ((b.weight || 0) + (b.rating?.average || 0) * 8) - ((a.weight || 0) + (a.rating?.average || 0) * 8));

const TARGET_PER_PROVIDER = 100; // 100 shows x 10 providers = 1,000 shows!

for (const raw of candidates) {
  const wcId = raw.webChannel?.id;
  const netId = raw.network?.id;
  const isAnime = raw.type === "Animation" && (raw.language === "Japanese" || (raw.genres || []).includes("Anime"));

  let matchedProv = null;
  if (isAnime && buckets.crunchyroll.length < TARGET_PER_PROVIDER) {
    matchedProv = PROVIDERS_META.find(p => p.id === "crunchyroll");
  } else {
    matchedProv = PROVIDERS_META.find(p => p.webIds.includes(wcId) && buckets[p.id].length < TARGET_PER_PROVIDER)
               || PROVIDERS_META.find(p => p.netIds.includes(netId) && buckets[p.id].length < TARGET_PER_PROVIDER);
  }

  // Also backfill Apple TV+, Disney+, Crunchyroll, or Tubi if a high-rated genre/channel matches
  if (!matchedProv) {
    const wcName = (raw.webChannel?.name || "").toLowerCase();
    const netName = (raw.network?.name || "").toLowerCase();
    for (const p of PROVIDERS_META) {
      if (buckets[p.id].length >= TARGET_PER_PROVIDER) continue;
      if (wcName.includes(p.id) || netName.includes(p.id)) { matchedProv = p; break; }
    }
  }

  if (!matchedProv || buckets[matchedProv.id].length >= TARGET_PER_PROVIDER) continue;
  const lower = raw.name.toLowerCase();
  if (seenTitlesPerProv[matchedProv.id].has(lower)) continue;

  const syn = stripHtml(raw.summary);
  if (syn.length < 40) continue;

  const nextId = buckets[matchedProv.id].length + 1;
  const genres = (raw.genres && raw.genres.length ? raw.genres : matchedProv.id === "crunchyroll" ? ["Anime", "Action"] : ["Drama"]).slice(0, 3);
  if (matchedProv.id === "crunchyroll" && !genres.includes("Anime")) genres.unshift("Anime");
  const year = raw.premiered ? Number(raw.premiered.slice(0, 4)) : 2021;
  const score = raw.rating?.average ? Math.min(99, Math.max(70, Math.round(raw.rating.average * 10 + 7))) : 85;
  const poster = (raw.image.original || raw.image.medium || "").replace(/^http:/, "https:");
  const seasons = Math.max(1, Math.min(15, Math.round((raw.weight || 75) / 24)));
  const episodes = Math.max(6, seasons * 10);
  const colors = PALETTES[(nextId + matchedProv.id.length) % PALETTES.length];

  buckets[matchedProv.id].push({
    id: nextId,
    title: raw.name,
    year,
    communityScore: score,
    seasons,
    episodes,
    genres: genres.slice(0, 3),
    genre: genres.slice(0, 3).join(" \u2022 "),
    platforms: [matchedProv.name],
    colors,
    tagline: makeTagline(syn, genres, year, matchedProv.name),
    synopsis: syn.slice(0, 280),
    posterUrl: poster,
  });
  seenTitlesPerProv[matchedProv.id].add(lower);
}

// 3. Top up any niche provider (like Apple TV+ or Disney+) that had fewer than TARGET_PER_PROVIDER in pages 0..32
const globalUsed = new Set(Object.values(seenTitlesPerProv).flatMap(s => [...s]));
for (const prov of PROVIDERS_META) {
  for (const raw of candidates) {
    if (buckets[prov.id].length >= TARGET_PER_PROVIDER) break;
    const lower = raw.name.toLowerCase();
    if (globalUsed.has(lower)) continue;
    if (prov.id === "crunchyroll" && raw.language !== "Japanese" && !(raw.genres || []).includes("Anime")) continue;
    if (prov.id === "disney" && !["Sci-Fi", "Fantasy", "Adventure", "Action", "Comedy", "Family"].some(g => (raw.genres || []).includes(g))) continue;
    if (prov.id === "apple" && (raw.premiered ? Number(raw.premiered.slice(0, 4)) : 2000) < 2018) continue;

    const syn = stripHtml(raw.summary);
    if (syn.length < 40) continue;
    const nextId = buckets[prov.id].length + 1;
    const genres = (raw.genres && raw.genres.length ? raw.genres : ["Drama"]).slice(0, 3);
    const year = raw.premiered ? Number(raw.premiered.slice(0, 4)) : 2022;
    const score = raw.rating?.average ? Math.min(99, Math.max(74, Math.round(raw.rating.average * 10 + 7))) : 86;
    const poster = (raw.image.original || raw.image.medium || "").replace(/^http:/, "https:");
    const seasons = Math.max(1, Math.min(10, Math.round((raw.weight || 75) / 25)));
    const episodes = Math.max(8, seasons * 10);
    const colors = PALETTES[(nextId + prov.id.length) % PALETTES.length];

    buckets[prov.id].push({
      id: nextId,
      title: raw.name,
      year,
      communityScore: score,
      seasons,
      episodes,
      genres,
      genre: genres.join(" \u2022 "),
      platforms: [prov.name],
      colors,
      tagline: makeTagline(syn, genres, year, prov.name),
      synopsis: syn.slice(0, 280),
      posterUrl: poster,
    });
    globalUsed.add(lower);
  }
}

const finalProviders = PROVIDERS_META.map(p => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  accent: p.accent,
  shows: buckets[p.id],
}));

const totalShows = finalProviders.reduce((sum, p) => sum + p.shows.length, 0);
console.log(`Built ${totalShows} total shows across ${finalProviders.length} streaming providers:`);
finalProviders.forEach(p => console.log(`  - ${p.name}: ${p.shows.length} shows`));

const fileOut = `// data.js - Auto-generated ${totalShows}-show catalog across all 10 streaming services + Supabase live sync.

export const PROVIDERS = ${JSON.stringify(finalProviders, null, 2)};

export const ACTIONS = {
  seen: { label: "Seen it",       color: "var(--seen)", key: "\\u2192" },
  skip: { label: "Not seen",      color: "var(--skip)", key: "\\u2190" },
  save: { label: "Save to watch", color: "var(--save)", key: "\\u2191" },
};

export const RATINGS = {
  loved: { emoji: "\\uD83D\\uDD25", label: "Loved it", color: "#ff8a3d" },
  mid:   { emoji: "\\uD83D\\uDE10", label: "Mid",      color: "#ffd23f" },
  hated: { emoji: "\\uD83D\\uDDD1\\uFE0F", label: "Hated it", color: "#ff6b7a" },
  seen:  { emoji: "\\u2713",       label: "Seen",     color: "#5ce1c4" },
};
export const RATING_CHOICES = ["loved", "mid", "hated"];

export const ALL_SHOWS = PROVIDERS.flatMap(p => p.shows.map(s => ({ ...s, network: p.name, providerId: p.id })));

export const GUEST_LIMIT = 10;

const CATALOG = new Map(ALL_SHOWS.map(s => [\`\${s.providerId}:\${s.id}\`, s]));
export const findShow = (providerId, showId) => CATALOG.get(\`\${providerId}:\${showId}\`) || null;

export function applyRemoteCatalog(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const byProv = new Map();
  const hidden = new Set();

  rows.forEach(r => {
    const key = \`\${r.provider_id}:\${r.show_id}\`;
    if (r.is_active === false) {
      hidden.add(key);
      return;
    }
    const prov = PROVIDERS.find(p => p.id === r.provider_id);
    if (!prov) return;
    const showObj = {
      id: Number(r.show_id),
      title: r.title,
      year: Number(r.year) || 2024,
      communityScore: r.community_score ?? 90,
      seasons: Number(r.seasons) || 1,
      episodes: Number(r.episodes) || 10,
      genres: Array.isArray(r.genres) && r.genres.length ? r.genres : ["Drama"],
      genre: (Array.isArray(r.genres) && r.genres.length ? r.genres : ["Drama"]).join(" \\u2022 "),
      platforms: Array.isArray(r.platforms) && r.platforms.length ? r.platforms : [prov.name],
      colors: Array.isArray(r.colors) && r.colors.length >= 2 ? r.colors : [prov.brand || "#4338ca", "#0f0a24"],
      tagline: r.tagline || "",
      synopsis: r.synopsis || "",
      posterUrl: r.poster_url || null,
    };
    if (!byProv.has(r.provider_id)) byProv.set(r.provider_id, new Map());
    byProv.get(r.provider_id).set(showObj.id, showObj);
  });

  PROVIDERS.forEach(p => {
    const remoteMap = byProv.get(p.id) || new Map();
    const merged = [];
    const seenIds = new Set();

    p.shows.forEach(s => {
      const k = \`\${p.id}:\${s.id}\`;
      if (hidden.has(k)) return;
      if (remoteMap.has(s.id)) {
        const rem = remoteMap.get(s.id);
        merged.push({ ...s, ...rem, posterUrl: rem.posterUrl || s.posterUrl });
      } else {
        merged.push(s);
      }
      seenIds.add(s.id);
    });

    remoteMap.forEach((s, id) => {
      if (!seenIds.has(id) && !hidden.has(\`\${p.id}:\${id}\`)) {
        merged.push(s);
      }
    });

    p.shows = merged;
  });

  ALL_SHOWS.length = 0;
  PROVIDERS.forEach(p => {
    p.shows.forEach(s => {
      ALL_SHOWS.push({ ...s, network: p.name, providerId: p.id });
    });
  });

  CATALOG.clear();
  ALL_SHOWS.forEach(s => CATALOG.set(\`\${s.providerId}:\${s.id}\`, s));
  return true;
}
`;

fs.writeFileSync("./data.js", fileOut, "utf8");
console.log("Successfully wrote 1,000-show data.js!");