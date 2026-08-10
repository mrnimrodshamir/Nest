# NestUp — 30" Launch Film · v2 FINAL
### Supersedes the v1 timeline. Prompts, grade and sound notes in v1 still stand.

The brief changed one thing and it changes everything: **the hero is the
connection, not the app.** v1 gave the interface 7 seconds. That was a product
demo wearing a commercial's clothes. v2 gives it **3 seconds** and spends the
reclaimed time where the film actually pays off — after they meet.

---

## The structural change

| | v1 | v2 |
|---|---|---|
| Setup (they don't know) | 10s | 9s |
| App on screen | 7s | **3s** |
| Transition | 5s | 4s |
| **Payoff (they meet)** | **6s** | **11s** |
| End card | 2s | 3s |

Eleven seconds of payoff is the whole bet. It is long enough for a real moment to
breathe — an introduction, the children finding each other, a second beat where the
two of them are simply *talking* and the camera stays on it. Six seconds could only
summarise that. Eleven can let it happen.

---

## Revised timeline (24fps)

| In | Out | Dur | Shot | Model |
|---|---|---|---|---|
| 00:00 | 00:05 | 5.0 | **Two doors.** Static wide, two buildings, both leave, neither looks up | Veo 3 `preview` |
| 00:05 | 00:07 | 2.0 | **Playground.** Mother A, stroller, glances up at nothing | Seedance 2.0 |
| 00:07 | 00:09 | 2.0 | **Café.** Mother B, Rothschild side street, same glance | Seedance 2.0 |
| 00:09 | 00:12 | 3.0 | **The app.** Real Discovery screen, Playground Meetup, tap Join | Screen recording |
| 00:12 | 00:16 | 4.0 | **Pin becomes park.** Continuous push-in, no cut | Kling v3.0 `pro` |
| 00:16 | 00:19 | 3.0 | **Arrival.** Both approach from opposite paths, recognise the moment | Seedance 2.0 |
| 00:19 | 00:22 | 3.0 | **The children.** Two toddlers find each other first. No adults in frame | Seedance 2.0 |
| 00:22 | 00:25 | 3.0 | **The parents.** Sitting, coffee, mid-conversation, a real laugh | Seedance 2.0 |
| 00:25 | 00:27 | 2.0 | **Wide.** Playground, late light, four people who now know each other | Veo 3 `preview` |
| 00:27 | 00:30 | 3.0 | **End card** | Composited |

**Note the order at 19s:** the *children* connect before the adults do. That is
true to how it actually happens, and it is a better piece of storytelling than
two women shaking hands — the kids do the introducing. It also removes the last
trace of "app makes friends" and replaces it with "app removes an obstacle."

---

## New prompts (shots not in v1)

**00:19 — The children** · Seedance 2.0, 3s, 1080p, `image_references` for wardrobe only
> Low camera at child height on a rubber playground surface. Two toddlers, roughly
> eighteen months, meet over a scattered pile of plastic buckets. One holds one out;
> the other takes it. No adults visible in frame. Late afternoon sun through ficus
> leaves, dust in the light, shallow depth of field. Documentary realism, natural
> skin, no performance, unposed. 35mm.

**00:25 — Wide, four people** · Veo 3 `veo-3-preview`, 3s trimmed to 2s
> Wide static shot, late afternoon in a Tel Aviv neighbourhood playground. Two women
> sit talking on a low wall at frame left, two toddlers play in the middle distance.
> Long golden shadows, ficus canopy, a cyclist passing on the path behind. Warm haze.
> Locked camera, no movement, cinematic, natural colour, documentary.

Everything else — the two doors, playground, café, pin-to-park, arrival,
conversation — uses the v1 prompts unchanged.

---

## The ending

The line you offered is good. I think there is a stronger one, and I'd shoot both.

**Recommended:**

> ### הם היו כאן כל הזמן.
> **NestUp**

*They were here all along.*

Four words. It doesn't describe the product, it resolves the film — the whole 27
seconds before it exist to set up that sentence. And in a municipal room it says the
thing you actually want said: **the community already exists in this city. It just
can't find itself.** That reframes NestUp as infrastructure the city is missing,
not an app the city might buy.

**Alternate (your line), also strong, warmer, more parent-facing:**

> ### הקהילה שלכם קרובה יותר ממה שחשבתם.

Generate both cards. They cost nothing — it's a type composite, not a generation.
Use "הם היו כאן כל הזמן" for the Municipality and investors, your line for parents.

Set in **Heebo** or **Assistant**, right-aligned, on `#FAF8F4`. Never let a Latin
font substitute Hebrew glyphs.

---

## Voiceover: no.

I considered it and I'm recommending against it, deliberately.

Every version I wrote made the film smaller. A voice explaining that the women don't
know each other is a voice telling you what you can already see — and the moment
someone narrates a feeling, the audience stops having it. The film's first human
sound should be the laugh at 00:23. That laugh is the entire product benefit, and
it only works if nothing has spoken before it.

The one Hebrew line arrives as type, at the end, in silence. That is the Apple move,
and it's the right one here.

**Sound plan stands as v1:** felt piano, street ambience, one soft haptic tick on the
Join tap as the only designed effect, ambience crossfading four frames *ahead* of the
match cut so sound arrives at the park before the picture does.

---

## Generation plan and what it costs

**11 finished clips.** Realistic attempt counts, because the failure modes are known:

| Shot | Model | Attempts | Why |
|---|---|---|---|
| Character refs ×2 | image model | 4–6 | Everything downstream depends on these faces |
| Two doors | Veo 3 preview | 2 | Low risk, no faces |
| Playground / Café | Seedance std 1080p | 2 each | Identity-locked, medium risk |
| Pin → park | Kling v3.0 pro | 3 | Camera moves are the hardest to get clean |
| Arrival | Seedance | 3 | Two faces, both must hold |
| **The children** | Seedance | **4** | Toddler hands and faces are where models fail worst |
| **The parents / the laugh** | Seedance | **4–5** | The emotional payload. Budget the most here |
| Wide four-people | Veo 3 preview | 2 | Low risk |
| 9:16 regenerations | mixed | 3 | Shots 1, 2 and 10 must be native vertical, not cropped |

**≈ 30–34 video generations plus ~6 stills.**

### Recommendation

Your balance is **0.35 credits on a free plan** — enough for nothing. The smallest
top-up pack is **500 credits**, which is comfortably above what this film needs and
leaves headroom for the extra attempts on the laugh, which is exactly where you want
headroom.

**If a 3-day $0 Plus trial is offered to your account, take that first** — it carries
MCP credits and may cover the whole production. It does auto-charge when the trial
ends unless cancelled, so set a reminder, or tell me to cancel auto-renewal and I'll
do it.

Spending in the $5–10 range materially changes the output, and here is precisely
where it goes: **`std` mode at 1080p instead of `fast` at 720p, and four attempts at
the laugh instead of one.** Those two decisions are the difference between a film
that looks like a real commercial and one that looks like an AI demo. Not the model
choice — the attempt count.

---

## Order of execution, the moment credits land

1. **Character reference stills.** Nothing else starts. Every shot with a face
   depends on them, and regenerating them later invalidates everything downstream.
2. **The laugh (00:22).** Second, not last. If that shot never looks real, the film
   needs restructuring and it is far cheaper to learn that on generation three than
   on generation thirty.
3. Two doors, wide four-people — no faces, establishes the grade.
4. Playground, café, arrival, children.
5. Pin → park.
6. Screen recording from the device.
7. Assembly · grade · mix · 16:9 master · 9:16 cut · SRTs.

I'll run all of it and come back with the MP4s, not with questions.
