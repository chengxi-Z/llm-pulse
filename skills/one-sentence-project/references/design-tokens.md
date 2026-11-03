<!--
Template: design tokens (light-luxe, multi-theme)
Used by: scripts/scaffold.mjs -> docs/DESIGN-TOKENS.md and site/assets/css/theme.css.
The first fenced css code block below is extracted verbatim as theme.css.
Placeholders are substituted by the scaffold. Keep this file English-only.
Rule: every color used by a component must come from a token. A hard-coded hex
value inside a component is a review reject: it breaks theme switching.
-->

# {{PROJECT_NAME}} — Design Tokens & Visual System

> Domain: {{DOMAIN}} ｜ Date: {{DATE}}
> Keywords: **paper white, ink, champagne gold, restrained motion, generous
> whitespace, thin hairlines, serif display + sans body**. "Light luxe" means
> calm and expensive-looking, not decorative: the data is the hero.

## 1. Themes

| id | Name | Mood | Background / surface | Ink | Accent |
| --- | --- | --- | --- | --- | --- |
| `ivory` | Paper & gold (default) | warm paper, serif, champagne | `#F6F1E9` / `#FFFDF9` | `#14100C` | gold `#B08A4F`, deep green `#12312A` |
| `noir` | Midnight gold (dark) | museum at night | `#0E0D0B` / `#171411` | `#F2ECE2` | gold `#C9A227` |
| `jade` | Celadon (light) | tea room, cool, quiet | `#F3F5F1` / `#FBFCF9` | `#17211B` | jade `#3F6B57`, gold `#A98C55` |
| `rose` | Dusk rose (light) | champagne pink, soft luxury | `#F7F1EF` / `#FFFCFB` | `#1D1517` | mauve `#9A6B74`, gold `#B08A4F` |
| `graphite` | Minimal graphite (neutral) | architectural, restrained | `#F3F2EF` / `#FAFAF8` | `#171717` | silver `#8C8A85`, ink `#2A2A28` |
| `auto` | Follow system | resolves to `ivory` / `noir` only | via `prefers-color-scheme` |

Rules:
- State lives on `<html data-theme="ivory|noir|jade|rose|graphite">`; persist in
  `localStorage` under a namespaced key (e.g. `aipulse.theme`), allow `?theme=`
  deep links, and set the theme in an inline `<head>` script before CSS to avoid
  a flash of the wrong theme.
- `auto` is a 6th picker option; it only maps to `ivory`/`noir`. Every other
  theme is fixed when manually selected.
- Body text contrast >= 4.5:1 in all 5 themes. Gold as decorative large display
  text may be < 4.5:1 only if a readable ink version is also provided.
- No external fonts, no CDN, no remote images. System font stacks only.
- Buttons: never large solid pure-black fills. Primary = theme accent fill with
  dark ink text; secondary = transparent with a hairline accent border. All
  buttons need hover / active / focus-visible / disabled states.

## 2. Token stylesheet (extracted verbatim into `site/assets/css/theme.css`)

```css
/* Design tokens for {{PROJECT_NAME}} — generated from references/design-tokens.md. */
:root {
  color-scheme: light;
  --bg: #F6F1E9;
  --surface: #FFFDF9;
  --ink: #14100C;
  --muted: #6B6257;
  --gold: #B08A4F;
  --gold-soft: #D9C39A;
  --line: #E4D9C6;
  --accent: #12312A;
  --btn-primary-bg: var(--gold);
  --btn-primary-fg: var(--ink);
  --btn-primary-border: var(--gold-soft);
  --btn-primary-bg-hover: #C49A5C;
  --btn-secondary-bg: transparent;
  --btn-secondary-border: var(--gold-soft);
  --btn-secondary-fg: var(--ink);
  --font-serif: "Cormorant Garamond", "Noto Serif SC", "Songti SC", Georgia, serif;
  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --max-width: 1180px;
  --radius-sm: 2px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 40px;
  --space-6: 64px;
  --line-hair: 1px solid var(--line);
  --shadow-card: 0 1px 2px rgba(20, 16, 12, 0.04);
  --motion-fast: 160ms;
  --motion-base: 300ms;
}

[data-theme="noir"] {
  color-scheme: dark;
  --bg: #0E0D0B;
  --surface: #171411;
  --ink: #F2ECE2;
  --muted: #A79B8A;
  --gold: #C9A227;
  --gold-soft: #6E5B2A;
  --line: #2A251E;
  --accent: #5E8B74;
  --btn-primary-bg: #C9A227;
  --btn-primary-fg: #14100C;
  --btn-primary-border: #C9A227;
  --btn-secondary-fg: #F2ECE2;
}

[data-theme="jade"] {
  color-scheme: light;
  --bg: #F3F5F1;
  --surface: #FBFCF9;
  --ink: #17211B;
  --muted: #5E6B62;
  --gold: #A98C55;
  --gold-soft: #D6C8A6;
  --line: #DCE4DC;
  --accent: #3F6B57;
  --btn-primary-bg: #3F6B57;
  --btn-primary-fg: #FBFCF9;
  --btn-secondary-fg: #17211B;
}

[data-theme="rose"] {
  color-scheme: light;
  --bg: #F7F1EF;
  --surface: #FFFCFB;
  --ink: #1D1517;
  --muted: #6F5D61;
  --gold: #B08A4F;
  --gold-soft: #DFC9B4;
  --line: #E8DBD6;
  --accent: #9A6B74;
  --btn-primary-bg: #9A6B74;
  --btn-primary-fg: #FFFCFB;
  --btn-secondary-fg: #1D1517;
}

[data-theme="graphite"] {
  color-scheme: light;
  --bg: #F3F2EF;
  --surface: #FAFAF8;
  --ink: #171717;
  --muted: #5F5D59;
  --gold: #8C8A85;
  --gold-soft: #CBC8C0;
  --line: #E0DED8;
  --accent: #2A2A28;
  --btn-primary-bg: #2A2A28;
  --btn-primary-fg: #FAFAF8;
  --btn-secondary-fg: #171717;
}

@media (prefers-color-scheme: dark) {
  html:not([data-theme]) {
    color-scheme: dark;
    --bg: #0E0D0B;
    --surface: #171411;
    --ink: #F2ECE2;
    --muted: #A79B8A;
    --gold: #C9A227;
    --gold-soft: #6E5B2A;
    --line: #2A251E;
    --accent: #5E8B74;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.25;
}

a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--gold); }

.site-header {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--line-hair);
}

.brand { font-family: var(--font-serif); font-size: 1.25rem; letter-spacing: 0.02em; }

main { max-width: var(--max-width); margin: 0 auto; padding: var(--space-5) var(--space-4); }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }
.card { background: var(--surface); border: var(--line-hair); border-radius: var(--radius-md); padding: var(--space-4); box-shadow: var(--shadow-card); }
.stat-value { font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 2.75rem); }
.muted { color: var(--muted); }
.eyebrow { font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); }
.empty-state { border: 1px dashed var(--line); border-radius: var(--radius-md); padding: var(--space-5); text-align: center; color: var(--muted); }

.btn {
  font: inherit;
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--btn-primary-border);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  transition: background var(--motion-fast) ease, border-color var(--motion-fast) ease;
}
.btn:hover { background: var(--btn-primary-bg-hover); }
.btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.btn[disabled] { opacity: 0.5; cursor: not-allowed; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gold-soft); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--gold); }
* { scrollbar-width: thin; scrollbar-color: var(--gold-soft) transparent; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 3. Typography and layout

- Display type: serif stack, `clamp(2.4rem, 5vw, 4.2rem)`; body 16-18 px,
  line-height 1.75; small labels uppercase, letter-spacing 0.14em, accent color.
- Content width 1180 px; 4 pt spacing scale; radii 2 / 8 / 14 px.
- Cards: 1 px hairline + surface fill; hover raises 2 px and warms the border.
- Breakpoints: 360 / 768 / 1024 / 1440; mobile navigation collapses; tables
  scroll inside their container without overflowing the page.

## 4. Interaction details

- Back-to-top button: created by the shared app script on every page, appears
  after 600 px, smooth scroll (auto with `prefers-reduced-motion`), focusable,
  localizable aria-label.
- Theme picker: keyboard operable popover with `role="menu"`, `aria-expanded`,
  `aria-checked`; swatch previews; mobile-friendly. No third-party library.
- Scrollbars: themed thumb on the page; table-internal scrollbars stay usable.
- Motion: 300 ms fade-up on first view via IntersectionObserver; disabled with
  reduced motion; no parallax, no video, no autoplay.

## 5. Accessibility

- Contrast >= 4.5:1 for text; >= 3:1 for large text and UI boundaries.
- Semantic landmarks, one `h1` per page, skip-to-content link, visible
  `:focus-visible` ring, `aria-*` on dynamic widgets, labels tied to inputs.
- No information conveyed by color alone: status = dot + text label.
- Works with keyboard only and at 200% zoom.

## 6. Performance budget

| Item | Budget | Check |
| --- | --- | --- |
| CSS raw | <= 120 KB | record both raw and gzip |
| JS raw | <= 200 KB | excluding data JSON |
| External requests | 0 third-party | no CDN, fonts, analytics |
| Data JSON | keep under ~1.5 MB total | lazy-load secondary data if needed |
| First render | no layout shift warning | fixed aspect ratios / no late fonts |
| Images | local, compressed, width/height set | no hotlinked images |

Measure before release and record the numbers in the acceptance report. Budgets
are guardrails, not vanity metrics: raising one requires a recorded reason.
