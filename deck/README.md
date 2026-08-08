# NestUp × Tel Aviv-Yafo — Municipal Pilot Deck

18 slides. Built for a room containing the Mayor, Municipality CEO, Head of
Innovation and Head of Community. The ask is a six-month pilot in one
neighbourhood — not funding.

## Deliverables

| File | What it is |
|---|---|
| `NestUp_TelAviv_Municipal_Pilot.pptx` | The deck. Fully editable — every headline, label, card and diagram is a real PowerPoint shape or text box. |
| `NestUp_TelAviv_Municipal_Pilot.pdf` | Print/share export, 192 DPI. |
| `slides_png/slide_01…18.png` | Every slide as a 2560×1440 PNG. |
| `SPEAKER_NOTES.md` | Standalone notes. Also embedded in the PPTX notes pane. |
| `assets/screen_*.png` | The five device mockups at 1179×2556. |
| `fonts/` | Plus Jakarta Sans — install for exact fidelity. |

## Fonts

The deck is set in **Plus Jakarta Sans**, the product's own typeface. Install the
four TTFs in `fonts/` before opening the PPTX, or PowerPoint will substitute and
the line breaks will shift. The PDF and PNGs already have it embedded.

## Provenance of the app imagery — read this before presenting

The five device mockups are **faithful reconstructions rendered from the
shipping codebase**, not live screen captures.

Why: the app is React Native/iOS, and this machine has no iOS simulator.
`expo start --web` fails because `react-native-maps` has no web build
(`codegenNativeComponent is not a function`), and the auth gate would block the
inner screens regardless.

What that means in practice:

* Every **colour** comes from `src/theme/colors.ts`
* Every **type size** from `src/theme/typography.ts`, set in the real typeface
* Every **string** from `src/i18n/en.ts`
* Every **photograph** is the real category artwork in `assets/activity-art/`
* Layout follows the shipping components — the 168pt card-media ceiling, the
  116pt place row, the sticky Search/Filters/Sort in the sheet header

**No mockup depicts a feature that does not ship.** Discovery, the mixed feed,
Event RSVP with "Who's going", the twelve forums and the public-profile privacy
model are all live in build 29.

The map behind Discovery is a stylised stand-in — the product uses Apple Maps,
which cannot be redistributed in a deck.

Before presenting, replace these with real captures from a device running
TestFlight build 29. Same five screens, same order.

## Data honesty

There are **no invented statistics anywhere in this deck.** That is deliberate —
a fabricated figure about Tel Aviv parents is the fastest way to lose a room of
municipal decision makers.

Numbers that do appear are verifiable from the production database:
44 verified Tel Aviv places · 12 community forums · 21 activity categories.

Slide 15 presents the measurement framework with every baseline marked
"set in month 1", and says so out loud in the footer. If you are pushed for
projections in the room, offer to model them jointly once the baseline exists.
Do not improvise a number.

## Rebuilding

```bash
python deck/build_mockups.py    # device mockups -> assets/
python deck/build_deck.py       # -> .pptx
python deck/render_exports.py   # -> slides_png/ + .pdf
python deck/export_notes.py     # -> SPEAKER_NOTES.md
```

`render_exports.py` reads geometry back out of the built PPTX rather than
re-declaring the layout, so an export can never drift from the file the client
opens.
