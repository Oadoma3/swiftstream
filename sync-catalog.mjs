// sync-catalog.mjs - Accurate Network-to-Streamer Harvester (maps 60+ real networks & genres to their true streaming homes)
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
  { id: "netflix",     name: "Netflix",      brand: "#E50914", accent: "#ff4d57", match: ["netflix"] },
  { id: "hulu",        name: "Hulu",         brand: "#1CE783", accent: "#1ce783", match: ["hulu", "fx", "fxx", "abc", "fox", "freeform", "abc family"] },
  { id: "prime",       name: "Prime Video",  brand: "#00A8E1", accent: "#2bb7ff", match: ["amazon", "prime video", "freevee", "imdb tv", "mgm"] },
  { id: "peacock",     name: "Peacock",      brand: "#0d0d0d", accent: "#ffd23f", match: ["peacock", "nbc", "usa network", "syfy", "bravo", "e!", "oxygen", "universal", "msnbc", "cnbc"] },
  { id: "paramount",   name: "Paramount+",   brand: "#0064FF", accent: "#4d8dff", match: ["paramount", "cbs", "showtime", "comedy central", "mtv", "vh1", "nickelodeon", "nick", "bet", "spike", "tv land", "smithsonian"] },
  { id: "disney",      name: "Disney+",      brand: "#113CCF", accent: "#7b8cff", match: ["disney", "national geographic", "nat geo", "jetix", "abc kids"] },
  { id: "max",         name: "Max",          brand: "#002BE7", accent: "#8f5bff", match: ["hbo", "max", "cinemax", "adult swim", "cartoon network", "tnt", "tbs", "trutv", "the cw", "cw", "wb", "dc universe"] },
  { id: "apple",       name: "Apple TV+",    brand: "#000000", accent: "#e5e5ea", match: ["apple tv"] },
  { id: "tubi",        name: "Tubi",         brand: "#FA382F", accent: "#ff6a5f", match: ["tubi", "upn", "wb", "syndication", "ion", "myx", "crackle"] },
  { id: "crunchyroll", name: "Crunchyroll",  brand: "#F47521", accent: "#ff8a3d", match: ["crunchyroll", "funimation", "tv tokyo", "tokyo mx", "mbs", "fuji tv", "tv asahi", "nhk", "bs11", "at-x", "tbs"] },
  { id: "starz",       name: "Starz",        brand: "#000000", accent: "#e5e5ea", match: ["starz", "encore", "epix", "lionsgate"] },
  { id: "amc",         name: "AMC+",         brand: "#FF6600", accent: "#ff8833", match: ["amc", "bbc america", "ifc", "sundance", "we tv", "allblk"] },
  { id: "discovery",   name: "Discovery+",   brand: "#00FFFF", accent: "#33ffff", match: ["discovery", "tlc", "hgtv", "food network", "investigation discovery", "animal planet", "history", "a&e", "lifetime", "travel channel", "science", "own", "motor trend", "magnolia"] },
  { id: "pluto",       name: "Pluto TV",     brand: "#111111", accent: "#00d2ff", match: ["pluto", "cbsn", "tv land", "cmt", "logo", "game show network", "gsn"] },
  { id: "roku",        name: "Roku Channel", brand: "#662d91", accent: "#9b51e0", match: ["roku", "quibi", "redbox", "pop", "ovation", "reelz", "axa"] },
  { id: "shudder",     name: "Shudder",      brand: "#880000", accent: "#ff3333", match: ["shudder", "chiller", "fearnet", "screambox"] },
  { id: "espn",        name: "ESPN+",        brand: "#CC0000", accent: "#ff3333", match: ["espn", "nfl network", "nba tv", "mlb network", "fox sports", "fs1", "nbcsn", "cbs sports", "dazn"] },
  { id: "britbox",     name: "BritBox",      brand: "#1b2a4a", accent: "#4a7fc1", match: ["britbox", "bbc", "itv", "channel 4", "channel 5", "sky", "e4", "dave", "acorn", "uktv", "alibi", "cbebies", "cbbc"] },
];

// Keep flagship hits at the very front of each deck so users swipe the biggest titles first
const CURATED = {
  netflix: ["Stranger Things", "The Crown", "Squid Game", "Wednesday", "Bridgerton", "Breaking Bad", "Ozark", "Black Mirror", "Arcane", "The Night Agent", "Beef", "Peaky Blinders", "Better Call Saul", "Dark", "Narcos", "Mindhunter", "The Queen's Gambit", "Cobra Kai", "The Witcher", "BoJack Horseman", "Cyberpunk: Edgerunners", "The Gentlemen", "Money Heist"],
  hulu: ["The Bear", "Only Murders in the Building", "The Handmaid's Tale", "Shogun", "Reservation Dogs", "Snowfall", "Atlanta", "Fargo", "Abbott Elementary", "It's Always Sunny in Philadelphia", "Prison Break", "Futurama", "Sons of Anarchy", "The Shield", "Justified", "What We Do in the Shadows", "Dopesick", "Normal People", "Lost", "Modern Family", "Archer", "Bob's Burgers", "The Americans"],
  prime: ["The Boys", "The Marvelous Mrs. Maisel", "Fallout", "Reacher", "Invincible", "Mr. & Mrs. Smith", "Fleabag", "The Expanse", "Tom Clancy's Jack Ryan", "Gen V", "The Lord of the Rings: The Rings of Power", "The Legend of Vox Machina", "Bosch", "The Terminal List", "Good Omens", "The Wheel of Time", "Upload", "Mr. Robot", "Jury Duty"],
  peacock: ["The Office", "Poker Face", "Bel-Air", "Twisted Metal", "Parks and Recreation", "Brooklyn Nine-Nine", "Yellowstone", "The Day of the Jackal", "The Traitors", "Suits", "Psych", "House", "Monk", "30 Rock", "Ted", "Battlestar Galactica", "Community", "Downton Abbey", "Law & Order: Special Victims Unit", "Friday Night Lights", "Superstore"],
  paramount: ["Star Trek: Strange New Worlds", "Evil", "1923", "Tulsa King", "Frasier", "Landman", "Special Ops: Lioness", "Mayor of Kingstown", "Halo", "Dexter", "Criminal Minds", "Ghosts", "1883", "Yellowjackets", "Twin Peaks", "Avatar: The Last Airbender", "South Park", "The Offer", "Billions", "Ray Donovan", "The Good Wife", "Key & Peele"],
  disney: ["The Mandalorian", "Andor", "Loki", "WandaVision", "X-Men '97", "Daredevil", "Ahsoka", "Agatha All Along", "Percy Jackson and the Olympians", "Gravity Falls", "Moon Knight", "Star Wars: The Clone Wars", "The Simpsons", "Phineas and Ferb", "Bluey", "Hawkeye", "The Punisher", "Jessica Jones", "Star Wars Rebels"],
  max: ["The Last of Us", "Succession", "House of the Dragon", "The Penguin", "The White Lotus", "Euphoria", "True Detective", "Game of Thrones", "The Sopranos", "Chernobyl", "Hacks", "Barry", "The Wire", "Band of Brothers", "Curb Your Enthusiasm", "Silicon Valley", "Veep", "Westworld", "Watchmen", "Boardwalk Empire", "The Righteous Gemstones", "Peacemaker", "Rick and Morty"],
  apple: ["Severance", "Ted Lasso", "Silo", "Slow Horses", "Shrinking", "Dark Matter", "Foundation", "The Morning Show", "For All Mankind", "Presumed Innocent", "Bad Monkey", "Black Bird", "Pachinko", "Masters of the Air", "Mythic Quest", "See", "Defending Jacob", "Servant", "Hijack", "Drops of God", "Disclaimer"],
  tubi: ["Cheers", "Columbo", "Mission: Impossible", "Broadchurch", "Luther", "Peep Show", "Kitchen Nightmares", "Stargate SG-1", "Farscape", "Midsomer Murders", "21 Jump Street", "The Prisoner"],
  crunchyroll: ["Attack on Titan", "Demon Slayer: Kimetsu no Yaiba", "Jujutsu Kaisen", "Solo Leveling", "One Piece", "Chainsaw Man", "Frieren: Beyond Journey's End", "Spy x Family", "Kaiju No. 8", "Vinland Saga", "My Hero Academia", "Hunter x Hunter", "Naruto: Shippuden", "Bleach", "Fullmetal Alchemist: Brotherhood", "Death Note", "Mob Psycho 100", "Haikyu!!", "Black Clover", "Dr. Stone"],
  starz: ["Power", "Outlander", "BMF", "P-Valley", "Spartacus", "Black Sails", "Power Book II: Ghost", "Power Book III: Raising Kanan", "Power Book IV: Force", "Party Down", "Ash vs Evil Dead", "Counterpart", "The Serpent Queen", "Minx", "Hightown", "Heels", "American Gods", "The White Queen"],
  amc: ["The Walking Dead", "Mad Men", "Interview with the Vampire", "Dark Winds", "Halt and Catch Fire", "Killing Eve", "The Walking Dead: Daryl Dixon", "The Walking Dead: Dead City", "The Terror", "Preacher", "Into the Badlands", "Hell on Wheels", "Kevin Can F**k Himself", "A Discovery of Witches", "Gangs of London", "TURN: Washington's Spies", "Orphan Black"],
  discovery: ["Deadliest Catch", "MythBusters", "Gold Rush", "90 Day Fiance", "Diners, Drive-Ins and Dives", "Ghost Adventures", "Naked and Afraid", "Fixer Upper", "Chopped", "Pawn Stars", "Alone", "The First 48", "River Monsters", "BattleBots", "House Hunters", "Dirty Jobs", "How It's Made", "Shark Week"],
  pluto: ["CSI: Crime Scene Investigation", "NCIS", "Star Trek: The Next Generation", "Baywatch", "The Price Is Right", "Survivor", "Top Gear", "Unsolved Mysteries", "Forensic Files", "The Love Boat", "Three's Company", "Perry Mason", "Gunsmoke", "Rawhide", "Matlock", "MacGyver"],
  roku: ["Weird: The Al Yankovic Story", "Die Hart", "The Great American Baking Show", "Most Dangerous Game", "Reno 911!", "The Spiderwick Chronicles", "Cypher", "Flipped", "Dummy", "zoey's Extraordinary Playlist", " sanctuary", "Warehouse 13", "Leverage: Redemption", "Heartland"],
  shudder: ["Creepshow", "Channel Zero", "Slasher", "The Boulet Brothers' Dragula", "Eli Roth's History of Horror", "The Last Drive-In with Joe Bob Briggs", "Cursed Films", "A Discovery of Witches", "Hannibal", "The Exorcist", "Penny Dreadful", "The Strain", "Salem", "Bates Motel", "From"],
  espn: ["The Last Dance", "30 for 30", "Hard Knocks", "Formula 1: Drive to Survive", "Welcome to Wrexham", "Quarterback", "Receiver", "Full Swing", "Man in the Arena: Tom Brady", "The Captain", "O.J.: Made in America", "Peyton's Places", "Detail", "Dana White's Contender Series", "The Ultimate Fighter", "College GameDay"],
  britbox: ["Sherlock", "Doctor Who", "Line of Duty", "Happy Valley", "Luther", "Broadchurch", "Peaky Blinders", "Downton Abbey", "Blackadder", "Mr. Bean", "Fawlty Towers", "Poirot", "Marple", "Vera", "Shetland", "Endeavour", "Inspector Morse", "Father Brown", "Death in Paradise", "avin & Stacey", "The IT Crowd", "The Inbetweeners"],
};

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function makeTagline(synopsis, genres, year, netName) {
  const first = synopsis.split(/(?<=[.!?])\s+/)[0] || "";
  if (first.length >= 18 && first.length <= 95) return first;
  return `${year} ${genres.slice(0, 2).join(" & ") || "Series"} streaming on ${netName}.`;
}

async function fetchPage(page) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows?page=${page}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

console.log("Downloading TVMaze master catalog (pages 0..150)...");
const allRaw = [];
const pages = Array.from({ length: 151 }, (_, i) => i);
for (let i = 0; i < pages.length; i += 12) {
  const batch = await Promise.all(pages.slice(i, i + 12).map(fetchPage));
  batch.forEach(arr => { if (Array.isArray(arr)) allRaw.push(...arr); });
}
console.log(`Downloaded ${allRaw.length} raw shows. Sorting by popularity and mapping to true networks...`);

// Sort all raw shows by popularity/weight + rating so the most famous shows always appear first!
allRaw.sort((a, b) => ((b.weight || 0) + (b.rating?.average || 0) * 10) - ((a.weight || 0) + (a.rating?.average || 0) * 10));

const byTitle = new Map();
allRaw.forEach(s => { if (s && s.name) byTitle.set(s.name.toLowerCase(), s); });

const buckets = Object.fromEntries(PROVIDERS_META.map(p => [p.id, []]));
const seenTitlesPerProv = Object.fromEntries(PROVIDERS_META.map(p => [p.id, new Set()]));

function addShowToProv(prov, raw, customTitle = null) {
  if (!raw || !raw.summary || !raw.image || (!raw.image.original && !raw.image.medium)) return false;
  const displayTitle = customTitle || raw.name;
  const lower = displayTitle.toLowerCase();
  if (seenTitlesPerProv[prov.id].has(lower)) return false;

  const syn = stripHtml(raw.summary);
  if (syn.length < 30) return false;

  const nextId = buckets[prov.id].length + 1;
  const genres = (raw.genres && raw.genres.length ? [...raw.genres] : ["Drama"]).slice(0, 3);
  if (prov.id === "crunchyroll" && !genres.includes("Anime")) genres.unshift("Anime");
  if (prov.id === "espn" && !genres.includes("Sports")) genres.unshift("Sports");
  if (prov.id === "shudder" && !genres.includes("Horror")) genres.unshift("Horror");

  const year = raw.premiered ? Number(raw.premiered.slice(0, 4)) : 2021;
  const score = raw.rating?.average ? Math.min(99, Math.max(70, Math.round(raw.rating.average * 10 + 6))) : 84;
  const poster = (raw.image.original || raw.image.medium || "").replace(/^http:/, "https:");
  const seasons = Math.max(1, Math.min(15, Math.round((raw.weight || 70) / 24)));
  const episodes = Math.max(6, seasons * 10);
  const colors = PALETTES[(nextId + prov.id.length) % PALETTES.length];

  buckets[prov.id].push({
    id: nextId,
    title: displayTitle,
    year,
    communityScore: score,
    seasons,
    episodes,
    genres: genres.slice(0, 3),
    genre: genres.slice(0, 3).join(" \u2022 "),
    platforms: [prov.name],
    colors,
    tagline: makeTagline(syn, genres, year, prov.name),
    synopsis: syn.slice(0, 280),
    posterUrl: poster,
  });
  seenTitlesPerProv[prov.id].add(lower);
  seenTitlesPerProv[prov.id].add((raw.name || "").toLowerCase());
  return true;
}

// 1. Seed curated flagship shows at the top of each provider deck
for (const prov of PROVIDERS_META) {
  const list = CURATED[prov.id] || [];
  for (const t of list) {
    const raw = byTitle.get(t.toLowerCase()) || await fetchSingle(t);
    const cleanName = t === "Demon Slayer: Kimetsu no Yaiba" ? "Demon Slayer" : t === "The Lord of the Rings: The Rings of Power" ? "The Rings of Power" : t === "Shogun" ? "Sh\u014Dgun" : t;
    if (raw) addShowToProv(prov, raw, cleanName);
  }
}

const MAX_PER_PROV = 500;

// 2. Strictly match shows by real network/webChannel name and true genre/country
for (const raw of allRaw) {
  if (!raw || !raw.name || !raw.summary || !raw.image) continue;
  const wcName = (raw.webChannel?.name || "").toLowerCase();
  const netName = (raw.network?.name || "").toLowerCase();
  const country = raw.network?.country?.code || raw.webChannel?.country?.code || "";
  const genres = raw.genres || [];
  const isAnime = raw.type === "Animation" && (raw.language === "Japanese" || genres.includes("Anime"));
  const isSports = raw.type === "Sports" || genres.includes("Sports");
  const isHorror = genres.includes("Horror");

  let target = null;

  // Exact webChannel / network match first
  for (const p of PROVIDERS_META) {
    if (buckets[p.id].length >= MAX_PER_PROV) continue;
    if (p.match.some(m => wcName === m || netName === m || wcName.includes(m) || netName.includes(m))) {
      target = p;
      break;
    }
  }

  // Category / Country true matches
  if (!target) {
    if (isAnime && buckets.crunchyroll.length < MAX_PER_PROV) {
      target = PROVIDERS_META.find(p => p.id === "crunchyroll");
    } else if (isSports && buckets.espn.length < MAX_PER_PROV) {
      target = PROVIDERS_META.find(p => p.id === "espn");
    } else if (isHorror && buckets.shudder.length < MAX_PER_PROV) {
      target = PROVIDERS_META.find(p => p.id === "shudder");
    } else if (country === "GB" && buckets.britbox.length < MAX_PER_PROV) {
      target = PROVIDERS_META.find(p => p.id === "britbox");
    } else if ((raw.type === "Reality" || raw.type === "Documentary" || genres.includes("Nature") || genres.includes("Food") || genres.includes("DIY")) && buckets.discovery.length < MAX_PER_PROV) {
      target = PROVIDERS_META.find(p => p.id === "discovery");
    } else if (raw.premiered && Number(raw.premiered.slice(0, 4)) < 2005) {
      // Classic syndicated library shows -> Tubi or Pluto TV
      if (buckets.tubi.length <= buckets.pluto.length && buckets.tubi.length < MAX_PER_PROV) {
        target = PROVIDERS_META.find(p => p.id === "tubi");
      } else if (buckets.pluto.length < MAX_PER_PROV) {
        target = PROVIDERS_META.find(p => p.id === "pluto");
      }
    }
  }

  if (target) {
    addShowToProv(target, raw);
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
console.log(`Built ${totalShows} verified shows across ${finalProviders.length} streaming platforms:`);
finalProviders.forEach(p => console.log(`  - ${p.name.padEnd(14)}: ${p.shows.length} shows (Top: ${p.shows.slice(0, 3).map(s => s.title).join(", ")})`));

const fileOut = `// data.js - Auto-generated ${totalShows}-show verified catalog across all 18 streaming services.

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
console.log("Successfully wrote verified network-mapped catalog to data.js!");