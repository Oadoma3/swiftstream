# SwiftStream (Vite + React + Tailwind + Framer Motion)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## src layout
| File | What it holds |
| --- | --- |
| `main.jsx` | Entry point |
| `App.jsx` | Global state (logs, user, swipes, matches, toast), splash gate, tab routing, modals |
| `SplashScreen.jsx` | Loading screen shown on first mount (auto-dismisses after 1.8s, or tap Skip) |
| `DiscoverDeck.jsx` | Discover tab: provider tiles, Shuffle All, swipe deck, micro-ratings, streak/action bar |
| `Card.jsx` | Poster front, details back, 3D `FlipCard`, draggable `SwipeCard` |
| `Library.jsx` | Library + Watchlist grids, Streaming DNA, Top Genres, rating editing |
| `MatchModal.jsx` | Watch Match session and "It's a Match!" screen |
| `InviteModal.jsx`, `AuthModal.jsx` | Invite sheet, guest-gate signup/login (front-end mock) |
| `Nav.jsx` | Bottom bar (phones) / left sidebar (768px+) |
| `ui.jsx`, `data.js`, `utils.js` | Shared icons + provider tiles + modal shell + toast, mock data, helpers |
| `index.css` | Tailwind directives + the prototype's global styles |