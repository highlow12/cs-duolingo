# CS DUO design system

## Visual Theme & Atmosphere

CS DUO is a quiet computer-science study desk: clear paper-like surfaces, a
small amount of terminal notation, and an interface that gets more energetic
only when a learner earns something. The visual language is flat modernism with
thin technical rules, compact square-ish controls, and a very light touch of
soft brutalism on the currently actionable item. Learning content always has
more contrast and area than decoration.

The memorable motif is a small system prompt (`>_`) and a lesson path made of
nodes and connectors. These motifs communicate structure; they are not a
background pattern. Never add decorative code labels that do not identify a
track, lesson, state, or piece of content.

## Light Theme Palette

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#f5f7f4` | quiet page background |
| `--surface` | `#ffffff` | readable content and interactive surfaces |
| `--surface-raised` | `#ffffff` | selected/raised surface, paired with a small shadow |
| `--surface-muted` | `#edf1ee` | secondary regions, code and disabled surfaces |
| `--text` | `#17211d` | primary text |
| `--text-muted` | `#5d6a63` | supporting copy and metadata |
| `--border` | `#d5ded8` | thin structural rule |
| `--border-strong` | `#aab8ae` | focused/pressed structural rule |
| `--primary` | `#176b52` | primary action and neutral progress |
| `--primary-strong` | `#0f503d` | primary action pressed state |
| `--primary-soft` | `#e2f1e9` | selected/quiet primary tint |
| `--success` | `#16734b` | correct/completed state |
| `--success-soft` | `#e1f3e9` | correct state surface |
| `--danger` | `#b7473c` | destructive/wrong state |
| `--danger-soft` | `#fbe9e7` | wrong/destructive state surface |
| `--warning` | `#9b681e` | caution and pending state |
| `--warning-soft` | `#fff2d8` | caution surface |
| `--focus` | `#3c83c6` | accessible focus ring |
| `--heart` | `#c64b55` | heart status only |

## Dark Theme Palette

Dark mode is a separate hierarchy, not an inverted light theme. The page is
deep green-black, surfaces are only slightly lighter, and borders are quieter.
Text remains warm-neutral and accents are softened so long sessions do not feel
neon.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#111714` | page background |
| `--surface` | `#18211d` | content surface |
| `--surface-raised` | `#202b25` | selected/raised surface |
| `--surface-muted` | `#202a25` | secondary region and code background |
| `--text` | `#edf3ee` | primary text |
| `--text-muted` | `#a8b8ae` | supporting copy and metadata |
| `--border` | `#2c3b33` | quiet structural rule |
| `--border-strong` | `#557064` | focused/pressed structural rule |
| `--primary` | `#73c6a1` | primary action and neutral progress |
| `--primary-strong` | `#9be0be` | primary action pressed state |
| `--primary-soft` | `#1f3d31` | selected/quiet primary tint |
| `--success` | `#7bd6a5` | correct/completed state |
| `--success-soft` | `#1d3b2d` | correct state surface |
| `--danger` | `#f08b82` | destructive/wrong state |
| `--danger-soft` | `#452725` | wrong/destructive state surface |
| `--warning` | `#e5b86b` | caution and pending state |
| `--warning-soft` | `#403521` | caution surface |
| `--focus` | `#79b7eb` | accessible focus ring |
| `--heart` | `#ed8991` | heart status only |

## Track Colors

Track identity is carried by a small accent rule, node outline, icon, progress
fill, or selected tab. It must not flood the page background or body copy.

| Track id | Accent | Motif |
| --- | --- | --- |
| `python` | `#2e8b70` light / `#82d7af` dark | `>_` |
| `computer-architecture` / `architecture` | `#b36a25` / `#e6ad69` | CPU chip |
| `discrete-math` / `math` | `#6653a8` / `#aaa0ec` | `Σ` |
| `data-structures` | `#1c7390` / `#73c1d9` | linked node |
| `algorithms` | `#b64f71` / `#e38ba8` | graph path |
| `network` | `#2f6eac` / `#7fb8ee` | connected nodes |
| `graphics` | `#a24f91` / `#df91c8` | triangle/pixel |
| `computer-systems` / `systems` | `#58704f` / `#a8cf99` | `0101` |

Unknown future track IDs use `--primary` until metadata supplies a signature
color. Track accents must meet contrast requirements for text and controls.

## Typography

Use a readable system sans stack for Korean and prose:
`Pretendard, SUIT, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`.
Use `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` only for XP,
IDs, code, status, prompts, and compact CS labels. Body is 16px with 1.65 line
height. Page titles are 32px maximum on desktop and 28px on narrow screens.
Supporting headings use 20px and 16px; avoid decorative all-caps labels and
large type jumps. Use weights 400, 500, and 650 only.

## Spacing Scale

Use a 4px base: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`,
`--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`,
`--space-10: 40px`, `--space-12: 48px`, `--space-16: 64px`. Major sections
start at 32px apart; related controls use 8 ~ 16px. Page gutters are 16px on
mobile and 24px on desktop.

## Radius

Use `--radius-sm: 6px`, `--radius-md: 10px`, and `--radius-lg: 14px`.
Containers are normally 10px or 14px; do not make every item a pill. A pill
is reserved for compact status text. Lesson nodes are 14px rounded squares,
not repeated circular buttons.

## Borders

Default borders are 1px solid `--border`. Use `--border-strong` only for
focus, selection, or an intentional primary action. The selected lesson node
may use a 2px accent border. Avoid thick black outlines except the pressed
state of a primary CTA or a highlighted achievement.

## Elevation

The default is flat (`--shadow-none`). Use `--shadow-sm` only for a floating
popover, modal, or selected CTA: `0 5px 16px rgb(14 31 22 / 10%)` in light
mode and the same low-opacity black in dark mode. Never use tinted shadows,
large card lifts, or hover elevation.

## Buttons

Buttons have a minimum 44px hit area, sentence-case labels, and one clear
primary action per context. Primary buttons use `--primary` with `--text-on-
accent`; secondary buttons use a thin border and surface background; tertiary
actions are text links. Hover changes color only. Press uses a 1px translate and
stronger border for immediate feedback. Disabled buttons keep their shape but
use `--surface-muted` and `--text-muted` with no pointer affordance.

## Cards / Surfaces

Use open sections and dividers first. A card is justified for a clickable
lesson, question answer area, modal, or a visually distinct start/completion
surface. Cards use one border, a quiet surface, and 16 ~ 24px padding. Never
nest cards only to create a dashboard grid. Stats are compact open metrics with
one bottom rule or a subtle surface, not a collection of colorful tiles.

## Lesson Nodes

Every lesson node uses the same anatomy: a 52px signature icon block, title,
one-line description, status text, and one action. The icon comes from the
track motif (`>_`, `CPU`, `Σ`, `node`, graph, pixel) and receives the track
accent through `--track-accent`. `available` is a quiet outlined node;
`in-progress` has an accent edge and progress cue; `completed` uses the success
mark plus the track accent; `locked` is muted and shows its prerequisite text.
The node action is always in the same place and remains at least 44px tall.

## Question Cards

Question content sits on a calm surface with a single content column capped at
720px. Prompt text and code are primary; choices are equal-width interactive
surfaces with explicit selected/focus/submitted/canonical states. Choice cards
use 10px radius, 1px border, and 12 ~ 16px padding. Do not use color alone:
include text markers, checkmarks, or labels for final feedback. Matching keeps
two columns down to 320px with compact cards; ordering always has keyboard
move buttons alongside drag handles.

## Progress

Progress bars are 8px tall, neutral track plus a semantic accent fill, and use
linear motion only. Do not animate width on page entry. XP is monospace and
compact; achievement emphasis is reserved for the completion event.

## Navigation

Desktop has a compact top header with the `>_` brand mark, four labeled routes,
theme control, and heart status. Mobile keeps the brand and heart in the top
bar and moves route navigation into a fixed bottom bar with safe-area padding.
Active navigation is a single accent marker and text weight, never a filled
pill plus an icon. Bottom targets are at least 44px high.

## Feedback States

Use `--success-soft`, `--danger-soft`, and `--warning-soft` for state regions;
pair each color with text and an icon/marker. First wrong feedback is short and
quiet, revealing neither answer nor explanation. Final feedback may use a
slightly stronger accent, a short enter animation, and a clear answer
comparison. Toasts and errors state the next action.

## Correct / Wrong

Correct: success border, `정답입니다.` text, and check marker. Wrong: danger
border, `오답입니다.` text, and retry guidance. The first wrong answer must
never highlight the canonical answer. Final wrong answers show the canonical
answer and explanation. Keep these states accessible in grayscale.

## Unlock / Completion

Unlock and completion are rare achievement moments. Use a 300 ~ 500ms accent
sequence on the completion mark or node (scale from .96 to 1, opacity, and a
short highlight), then settle to the calm state. Do not add confetti,
continuous sparkle, or a page-wide animation.

## Motion

Motion has a job. Use 120ms for press/state color, 180ms for modal/popover and
small feedback entry, and 240ms for panel/layout transitions. Use
`--ease-out-quart` for entering surfaces, `--ease-in-out-cubic` for track
swipe/layout movement, and linear for progress. Swipe is spatial continuity:
the next track enters from the swipe direction and the track surface clips
overflow. Respect `prefers-reduced-motion` by reducing transforms and
transitions to near-zero while preserving state changes.

## Responsive Behavior

Design from 320px up. At 640px the header nav becomes a fixed bottom nav; page
content uses 16px gutters and bottom safe-area padding. Track tabs scroll
horizontally without forcing the page to scroll. Lesson and review columns
collapse to one column. Long Korean labels wrap naturally; code blocks scroll
horizontally. Matching remains two compact columns. All pointer controls and
icon controls are 44px or larger. Respect `env(safe-area-inset-top)` and
`env(safe-area-inset-bottom)`.

## Dark Theme Rules

Use semantic variables everywhere; no hardcoded white, black, gray, or light
surface colors in component styles. Dark surfaces are separated by lightness
and thin borders, not shadows. Lower border contrast in dark mode, keep primary
text near-white, and ensure muted text remains readable. Track accents are
softened versions of their light colors. Theme switches at runtime without a
reload and persists under `cs-duolingo:theme`; absent preference follows
`prefers-color-scheme`.

## Do / Don't

**Do:** let the prompt lead; use neutral surfaces; use track color as a small
identity cue; show system motifs where they carry meaning; make selected and
completed states explicit; keep motion short and purposeful; test 320px and
dark mode.

**Don't:** turn the whole app into an arcade game; use gradients or glass;
repeat eyebrows above every section; make every block a rounded card; use
monospace for prose; append arrows to every CTA; add hover lifts; rely on color
alone; hide locked tracks outside the existing curriculum rule; change learning
or persistence logic for visual convenience.
