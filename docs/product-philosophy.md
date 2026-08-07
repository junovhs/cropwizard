# What CropWizard is for

## Where it came from

Someone was putting a brochure together and getting deals onto a website, and
needed specific crops at specific sizes, quickly. The options were a web tool
that would quietly wreck the quality, or Photoshop — which is a great deal of
application to open in order to produce one 1200×628 banner.

That is the whole origin. It is worth keeping in view, because every good idea
that arrives later will be a reason to become something else.

## Who it is for

Someone who has to produce images at exact sizes as a regular part of the week,
and for whom that is not the interesting part of the job.

- Marketers cutting banners, brochure images, and promo tiles.
- Social media people taking one shot to five different aspect ratios.
- Graphic designers doing the small stuff in between the real work.
- Anyone who found an image online and needs it at 1080×1080 by this afternoon.

It is **not** for retouchers, or photographers working a shot properly, or
anyone whose job *is* the image. Those people already have Photoshop open, and
they should.

**One sentence:** the thing you reach for instead of opening Photoshop, for the
jobs that do not deserve Photoshop.

## What "good" means here

Four things, in this order.

### Fast

Measured honestly: from *I have an image and a size* to *the file is in my
downloads*. Everything between those two points is overhead, including anything
clever. A feature that makes the app more capable and that path longer is a bad
trade.

### Output-first

You know the size before you know the crop. That is the actual shape of the
work — nobody crops a picture and then wonders what it is for — and the app is
built the right way round because of it. You name the size, and the frame holds
you to it. The frame is drawn at the output's real pixel size, so a 32×64
favicon looks like a 32×64 favicon and its smallness is something you can see
rather than a number you have to imagine (`DEC-03`).

### Quality you never have to ask for

There is no quality dropdown, no "use better resampling" checkbox, no advanced
tab. The good path is the only path.

Downscaling happens in linear light with a Lanczos-3 filter whose support widens
as the image shrinks — which is to say it does the arithmetic on quantities of
light instead of on the codes that stand for them, and low-pass filters before
throwing pixels away. That is why a resize here does not come out muddier than
the original. See `src/resample.ts`, which explains itself at length.

None of that is a feature, because a feature is something the user has to know
about. It is just what happens.

### A joy under the hand

The springs, the ghost of the discarded image, the frame gliding home after a
drag. These are not decoration; they are how you can tell the app is doing what
you meant. Every action should feel immediate and deliberate. Nothing should
lurch, stick, or argue with the pointer.

## Simple on purpose

The ideas that come up, and are good, and are still no — for now:

- An MCP server so an agent could drive it.
- Becoming a general graphic design application.
- Anything that turns "in a pinch" into "open a session."

None of these are forbidden forever. But the app was made because opening a
large application for a small job is miserable, and the fastest way to lose that
is to become a large application. Each one has to survive the tests below on its
own merits, later, when it is actually wanted.

## How a feature earns its place

Four questions. A no to any of them is usually a no.

1. **Is it already reachable?** If the thing exists by another route, adding a
   second one is not a feature, it is a second thing to maintain and a second
   thing to explain.
2. **Can the user see why it happened?** Behaviour that fires for reasons
   invisible on screen reads as the app being twitchy, however correct the
   reasoning behind it.
3. **Does it need a setting?** If no default can be defended, the feature is not
   understood well enough to ship. A settings panel is where undecided design
   goes to hide.
4. **Is it something you'd do in a pinch?** If it belongs to a planned session
   at a desk, it belongs in a different application.

## What has already been rejected, and why

Kept because the reasons are more useful than the conclusions.

| Idea | Why not |
| --- | --- |
| **Magnetic centre snap** (removed, `UX-22`) | Dead centre was already reachable — double-click fills to the largest centred crop, and every zoom route works about the frame's centre, so a centred framing stays centred as you zoom in. That left the magnet buying only re-centring after an exploratory drag, which is not worth a pull the pointer has to fight. |
| **Snapping to the image edges** | The crop is already hard-clamped to the picture, so flush-to-edge is free — you shove the crop at the edge and it stops there. A magnet at a wall is redundant with the wall. |
| **Snapping to sharp integer ratios** (1×, 2×, 4× the output) | Proposed to keep exports sharp. It would have bought nothing: the resampler already handles this properly. A real-sounding problem that had already been solved. |
| **A configurable grid size** ("snap to 8px") | A layout tool's idea. Nothing in a photograph happens at 8px intervals, so there is no defensible default — see question 3. |
| **A persistent grid overlay** | The thirds guides already fade in only while you are dragging and vanish afterwards, which is the right instinct. A standing lattice is the app taking the photograph back. |

The pattern across all five is worth naming: **most rejected features were
solving a problem that the app's existing physics had already solved.** Check
that first.

## Where the standing decisions live

This document is the spirit. The binding decisions are ADRs, and they are the
ones to read before changing behaviour:

- `DEC-01` — zero runtime dependencies, no third-party requests, assets vendored.
- `DEC-03` — the frame previews at true output scale by default.
- `DEC-04` — one image is the default; a multi-image drop enters batch,
  announced and reversible.

If something here and an accepted ADR disagree, the ADR wins, and one of the two
needs updating.
