# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceStone is a Hearthstone audio guessing game. Each round plays a modified voiceline (pitch-shifted or otherwise altered) from a Hearthstone card. The player must guess the card name, with progressive hints revealed (class, mana cost, card type).

Spiritual successor to [HearthDoku](../HearthDoku/) — same tech stack, same design system, same API source.

## Tech Stack

- **Pure vanilla HTML/CSS/JS** — no framework, no build step, no bundler
- **Design** — Clay Design System (dark mode), DM Sans + Space Mono typography, identical to HearthDoku
- **Card data** — `https://api.hearthstonejson.com/v1/latest/{locale}/cards.json`
- **Card audio** — `https://audio.hearthstonejson.com/v1/` (voiceline OGG files)
- **Audio manipulation** — Web Audio API (pitch shift, playback rate, reverb, etc.)
- **Bilingual** — French / English (same i18n pattern as HearthDoku)

## Running Locally

No build step. Open `index.html` directly or use a local server:

```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Architecture

### File Layout (planned, mirror HearthDoku)

```
VoiceStone/
├── index.html          # Main game page
├── css/
│   └── style.css       # Clay dark theme (copy base from HearthDoku)
├── js/
│   ├── app.js          # Init & game loop
│   ├── api.js          # Card data fetch & cache (reuse HearthDoku logic)
│   ├── audio.js        # Voiceline fetch, Web Audio API effects, playback
│   ├── game.js         # Round logic, hint progression, scoring, win/lose
│   ├── card-search.js  # Autocomplete guess input
│   ├── ui.js           # DOM rendering & interactions
│   └── i18n.js         # FR/EN translations
└── logo/               # Shared assets (copy from HearthDoku)
```

### Key Design Decisions

**Audio pipeline** (`audio.js`):
- Fetch OGG from HearthstoneJSON audio CDN using card `id`
- Decode with `AudioContext.decodeAudioData()`
- Apply effects via Web Audio API nodes (e.g. `BiquadFilterNode`, custom pitch shift via `AudioBufferSourceNode.playbackRate` + resampling, `ConvolverNode` for reverb)
- Pitch shift without changing speed requires a phase vocoder approach or a library like Soundtouch.js

**Card filtering** (`api.js`):
- Reuse HearthDoku's `EXCLUDED_SET_PREFIXES` and `processCards()` logic verbatim
- Only collectible cards with a valid voiceline should enter the pool
- Cards are pre-filtered client-side; no backend needed

**Hint progression** (`game.js`):
- Each failed/skipped guess reveals one more hint: class → mana cost → card type → rarity
- Track guesses per round; reveal card on loss

**Guess input** (`card-search.js`):
- Autocomplete against full collectible card name list (same fuzzy search pattern as HearthDoku)
- Match is case-insensitive, accent-insensitive

### Data Flow

```
API fetch (cards.json)
  → filter collectible, non-excluded sets
  → pick random card with a known voiceline
  → fetch OGG from audio CDN
  → decode + apply audio effect (pitch/reverb/speed)
  → play via AudioContext
  → player guesses → compare card name → reveal hints on fail
```

## Design System (Clay — Dark Mode)

Same tokens as HearthDoku:

| Token | Value |
|-------|-------|
| Canvas | `#1c1917` |
| Surface | `#292524` |
| Gold accent | `#fbbd41` |
| Green | `#22c55e` |
| Cyan | `#3bd3fd` |
| Purple | `#a78bfa` |
| Pink | `#fc7981` |
| Body font | DM Sans |
| Mono font | Space Mono |

## HearthstoneJSON Audio Notes

- Card data field `id` (e.g. `"EX1_001"`) is used to construct audio URLs
- The audio CDN base is `https://audio.hearthstonejson.com/v1/`
- Not all collectible cards have voicelines (tokens, uncollectible cards, some spells) — filter by verifying the audio URL responds with 200 before adding to the pool, or maintain an explicit allowlist
- OGG format; use `<audio>` element for simple playback or `AudioContext` for effects

## Locale & i18n

- Card names displayed in the player's chosen language (FR or EN)
- Audio is locale-independent (voicelines exist per language on the CDN — prefer `enUS` for broader compatibility unless the user is FR)
- Follow HearthDoku's `I18n` module pattern exactly for language switching

## Reuse from HearthDoku

Copy these verbatim and adapt minimally:
- `api.js` — card fetch, cache, filtering, icons, `EXCLUDED_SET_PREFIXES`
- `i18n.js` — full translation module
- `css/style.css` — full Clay design system base
- `logo/` — all class icons, mana/attack/health icons
