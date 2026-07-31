# Activity category artwork — final asset drop-in

This folder is where the **final** category artwork files go. It's empty
today — see `src/constants/activityArtManifest.ts` for the full 21-category
list and `src/constants/activityArtAssets.ts` for how a file gets wired in
once it exists.

## Spec (every file)

| | |
|---|---|
| Dimensions | 1200 × 900 px |
| Aspect ratio | 4:3 |
| Format | JPEG |
| Color space | sRGB |
| Max file size | 220 KB |

One master image per category. 4:3 is wide enough to center-crop cleanly at
every size it's shown at in the app (Activity Detail hero ~16:9, Discovery/
Create-Activity card hero, and the square Chats thumbnail), so no per-surface
crops are needed — every screen renders the same source through
`resizeMode: "cover"`.

## Content direction (from product brief)

Premium, warm, social — every image shows **multiple mothers together**,
never one isolated figure. Soft natural light, diverse but natural-looking
mothers and children, consistent visual language across all 21 images. No
emoji, no flat vector clipart, no childish cartoons, no stock-photo
composition, no copyrighted third-party artwork.

## Filenames (must match exactly)

stroller_walk.jpg · coffee_meetup.jpg · baby_playtime.jpg ·
playground_meetup.jpg · picnic.jpg · breakfast_meetup.jpg ·
lunch_meetup.jpg · beach.jpg · indoor_playground.jpg · story_time.jpg ·
music_activity.jpg · swimming.jpg · fitness.jpg · yoga.jpg · workshop.jpg ·
museum.jpg · zoo.jpg · shopping_together.jpg · moms_night_out.jpg ·
support_circle.jpg · other.jpg (fallback for any category without its own
distinct image)
