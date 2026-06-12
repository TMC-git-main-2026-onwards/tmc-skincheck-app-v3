# TMC SkinCheck — design system

Source of truth for the re-skin (matched to `design-target-results-screen.html`).
Tokens live in the `:root` block of `index.html` (moving to `src/styles.css` in
the Vite refactor). It is a **re-skin, not a redesign**: structure, flow,
information density and content are the pilot-tested baseline — only the visual
layer uses this system.

## Typography — Inter only

One humanist sans (Inter, Google Fonts, weights 400/500/600/700). No serif;
hierarchy comes from size and weight. Fraunces and DM Sans are retired.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| display | 30 / 36, −0.02em | 700 | Welcome H1 only (`.title-xl`) |
| title-1 | 24 / 30, −0.01em | 600 | Screen headings (`.title-lg`) |
| title-2 | 20 / 26 | 600 | Section headings (`.title-md`) |
| title-3 | 17 / 24 | 600 | Card titles (`.svc-rec-title`) |
| body-lg | 17 / 26 | 400 | Primary body (`.subtitle`) |
| body | 15 / 23 | 400 | Default body (`.subtitle-sm`, options) |
| subhead | 14 / 20 | 400–500 | Secondary text |
| footnote | 13 / 18 | 400 | Fine print only |
| overline | 12 / 16, +0.06em, UPPERCASE | 600 | Section labels (`.label`, `.hp-section-label`) |

Body never below 15px; 13px only for true fine print; 11–12px only for
overlines/captions (e.g. band labels, lockup).

## Colour — the real TMC palette (sampled from themoleclinic.co.uk)

| Token | Hex | Role |
|---|---|---|
| `--tmc-navy` | `#395171` | Brand navy — brand bands, headings, brand moments |
| `--tmc-blue` | `#006F96` | Primary actions / links |
| `--tmc-cyan` | `#05B1C0` | Highlights / selected / active accents (sparingly) |
| `--tmc-tint` | `#F0F6FC` | App background, tint boxes |
| `--tmc-tint-teal` | `#D5EAED` | Secondary fills |

Ramps: `--navy-50/100/300/700/800`, `--blue-50/100/700/800`. Neutrals (ink):
`--ink-900 #1F2A37`, `--ink-700 #3A4654`, `--ink-500 #55606B` (minimum for
secondary text on white, ≥ 4.5:1), `--ink-400 #7C8AA0` and `--ink-300 #9AA4B0`
(captions/disabled only), `--line #E1E8F0` (hairlines), `--track #E3E9F0`.

**Discipline:** navy = brand presence (deliberate, not everywhere); teal-blue =
actions/links; cyan = highlights only. The old `#1a2332` navy, `#2ec4b6` candy
teal, gold and coral are retired.

### Status ramp (the ONLY use of green/amber/orange/red)

Used exclusively for UV bands and the risk meter. Each step has `fg` (text),
`bg` (tint fill) and `arc` (meter/gauge stroke):

| Step | fg | bg | arc |
|---|---|---|---|
| Low | `#3B6D11` | `#EAF3DE` | `#639922` |
| Moderate | `#854F0B` | `#FBF3DC` | `#D99A21` |
| High | `#B4400F` | `#FDE8DC` | `#E06A2B` |
| Very high | `#A32D2D` | `#FBE3E3` | `#C84040` |
| Extreme (UV only) | `#7C1D1D` | `#F6DADA` | `#8E2424` |

The off-brand purple "very high" is gone; UV EXTREME is dark red.

## Logo

TMC wordmark only, using the white/reversed `MoleClinic-Ver-White2.png` —
always on a `--tmc-navy` brand band (welcome hero, flow header, results
header, loading band). Never CSS-filtered onto light surfaces. If a light
header ever needs the wordmark, source a navy-on-transparent asset (flagged
to Mike).

## Iconography

Lucide v0.453.0 (ISC), **inlined** in `icons.js` as `TMC_ICONS` + an
`icon(name, size, style, label)` helper — no runtime CDN, works offline and
under Capacitor. 20–24px in context, stroke 2, `currentColor` in ink or brand.
Meaningful icons pass a `label` (renders `role="img"` + `aria-label`);
decorative ones are `aria-hidden`. No emoji anywhere in the UI (enforced by a
grep in the build checks). The arm-framing diagram and UV gauge are drawn in
the same line/colour language (navy strokes, cyan dashed guide, status-colour
arc).

## Spacing & layout — 4pt grid

Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Screen gutters 20; section gaps
24–32; card padding 16–20; element gaps 8–12. Content flows from the top; the
CTA is `position:sticky; bottom:0; margin-top:auto` so it pins to the bottom
on short screens and follows the content on tall ones (no dead gap).
`env(safe-area-inset-*)` respected on all brand bands and the CTA
(`viewport-fit=cover`).

## Components

- **Buttons** — primary: solid `--tmc-blue`, min-height 52, radius 12, weight
  600, chevron **icon** (never a text arrow); hover `--blue-700`, active
  `--blue-800`, disabled 45% opacity. Secondary: 1.5px `--tmc-blue` outline.
  Tertiary: `.btn-ghost` text button. No pulsing animation.
- **Cards** — hairline elevation language only: white surface, 1px `--line`
  border, radius 16, padding 16–20. No shadows.
- **Option/answer rows** — min-height 56, 1.5px border; selected =
  `--tmc-blue` border + `--blue-50` tint + filled radio/check.
- **Inputs** — height 48, 1.5px border, label above, focus = blue border +
  3px `rgba(0,111,150,.15)` ring.
- **Callouts** — one restrained note treatment (white, hairline, tinted
  icon); **filled tints are reserved for status** (UV/peak/urgent/nudge use
  the status ramp).
- **Risk meter** — slim 4-segment bars (6px, radius 3), active segment filled
  in the band's arc colour, labels beneath, coloured band heading, italic
  "category, not probability" note, Melanoma / Lifetime UV pathway tiles on
  `--tmc-tint`.
- **UV gauge** — compact half-arc (grey track, band-coloured progress arc,
  navy needle) beside the value + band pill.
- **Progress** — overline step label + 3px bar (`--tmc-cyan` fill on navy
  header band).
- **Partner sponsor lockup** — "Offered by {Partner}" (11px, `#AEBED2`,
  partner name white 600) beside the TMC wordmark on the navy band (welcome +
  results). Resolved from the campaign code or `?partner=` deep link via the
  `PARTNERS` registry → `{displayName, logoUrl?, type:'employer'|'insurer'}`;
  unknown code → "Offered through your provider"; consumer → no lockup. TMC
  stays the clinical brand — no partner re-colouring (white-label deferred).

## Motion & accessibility

One transition system: 150–250ms ease, no bounce; `prefers-reduced-motion`
disables all animation. Text contrast ≥ 4.5:1 (≥ 3:1 large); touch targets
≥ 44px; `:focus-visible` 2px cyan ring; dynamic-type tolerant (rem-free but
no fixed heights on text containers); every meaningful icon labelled.

## Benchmarks applied

Headspace/Calm restraint (one accent, generous whitespace); Ada/Zoe
clinical-trust hierarchy and plain-language results; Apple Health/Oura
dashboard cards (overline + card rhythm); SkinVision/Miiskin capture UX
(guide overlay, framing diagram, confirmation step).
