# MDY Solutions — project context

## Overview

Public redesign proposal for MDY Solutions. Keep the existing Romanian content,
teal/navy identity, four service categories, products, industries and contact flow.
The user requested more realistic 3D and smoother motion, with an easy undo.

## Stack and publishing

Static HTML/CSS/JavaScript, Three.js r128, GSAP 3.13 + ScrollTrigger + SplitText,
Lenis 1.1.18; versions are pinned in index.html. No bundler or server API.
Personal repository: https://github.com/flaviusvranau1/mdy-solutions-redesign
GitHub Pages publishes the root of main:
https://flaviusvranau1.github.io/mdy-solutions-redesign/

## Journal — newest first

### 2026-09-15 — feedback: smaller, clearer, more dynamic hero

- User feedback on the 3D ecosystem: too big, parts felt rigid, wanted more
  motion and a stronger hover response ("să se mai învârtă").
- Object now fits at 80% of the stage (`FIT`), the stage bleed shrank from 7vw
  to 3vw and the hero grid is 1:1, so the ribbon has air around it.
- Motion: larger continuous sway/float and a slow breathing scale; pointer yaw
  gain rises from 0.3 to 0.55 while the cursor is over the stage; the hovered
  panel pulls the object toward itself (yaw ±0.42, pitch ±0.26); edge pulses
  and icon animations run up to 3× faster under the cursor; a click on empty
  stage space does one full eased spin (1.15 s); a click on a panel still
  scrolls to Soluții. Damping stays frame-rate independent.

### 2026-09-15 — MDY feedback: 3D ecosystem hero, client photos, client fonts

- Client (MDY) feedback relayed by the user: replace the globe with their hexagon
  ecosystem graphic (Soluții Software · Arhitectură & Integrare · Date & Tehnologie),
  keep our cards and background, put their photos into the cards at smaller sizes,
  use their text font. The user asked for the hexagon "in a 3D way, powerful, unexpected".
- Source: the client's WordPress theme archive "MDY Web .zip" (theme v111). Fonts
  confirmed in its functions.php: Barlow Condensed 500–800 + Inter 400–700.
- Hero: the hexagon is rebuilt as real geometry, not an image. A triangular Möbius
  ribbon with three rolled 60° folds is generated from material coordinates by
  successive reflections across the fold lines (C3 symmetric; closes exactly with
  L = 6√3, verified numerically). Custom shader: per-panel gradients, neon edges,
  data pulses travelling along the edges, glossy sweep, dithered dissolve.
  Each panel has canvas-drawn text in the client fonts and a procedural 3D icon
  (monitor + gear + cloud, server stack + cloud + nodes, database + shield + chart).
  The MDY logo is cut from the client's transparent PNG (flood fill removes the
  ribbon) into emblem and wordmark layers at different depths.
- Motion: light-front intro draws the ribbon, then logo, text and icons; continuous
  idle sway and float (text stays readable); pointer tilt; hovered panel lifts and
  shows a cursor label; click scrolls to Soluții; on scroll the ribbon tilts back
  and the panels separate. Full-page particles kept (1,600 / 850 compact).
- Ported the 2026-09-13 lifecycle work into the new scene: pixel-ratio budget,
  adaptive quality after sustained slow frames, loop stops when the document is
  hidden, context loss/restore, reduced-motion static render.
- Cards: solution, product and industry cards show the client photos (resized to
  760 px WebP, 14–49 KB, lazy-loaded) with a parallax window driven by the smoothed tilt.
  Real MDY logo in nav and footer; favicon from the emblem.
- Kept the 2026-09-13 main.js improvements unchanged and added a small `window.mdy`
  API (scrollTo, cursor label) used by the scene. The globe caption and legend were
  removed with the globe. `/original/` untouched.
- Validation: `node --check`, `git diff --check`; desktop 1440×900 and 375×812 in the
  in-app browser (no horizontal overflow, WebGL on, compact panel text on mobile,
  12/12 card photos load). In-app screenshots below the fold were unreliable while
  the pane was not painting; those sections were checked by forcing reveal states.

### 2026-09-13 — restore atmosphere and expressive motion

- User feedback: removing the full-page glowing dots lost an important part of
  the design, and the nearly stationary front-facing sculpture felt too rigid.
  Preserve the star field and visibly continuous motion in future iterations.
- Restored the original layered particle shader across the entire page, including
  subtle twinkle, depth, pointer parallax and scroll drift. 1,600 particles on
  desktop / 850 on mobile, in one GPU draw call. The canvas shares one WebGL
  renderer with the physical sculpture, using a viewport/scissor for its stage.
- Restored continuous 0.11 rad/s core rotation. Added gentle floating/rolling,
  independent counter-rotating orbits, moving rail accents and faster satellites.
  Pointer input is page-wide again, with time-based damping and stronger response.
  Thinner solid rails keep the new materials while making the composition lighter.
- The background intentionally continues below the hero. The heavier sculpture
  is skipped outside its stage; everything stops while the page is hidden. Reduced
  motion renders the static stars and sculpture without an animation loop or
  scroll parallax. The original comparison directory remains frozen.

### 2026-09-13 — separate public comparison links

- User explicitly requested both variants on distinct GitHub-hosted links.
- The improved version remains at the existing root URL. `/original/` contains
  the four original static assets exported from `before-3d-upgrade-2026-09-13`.
- Verified each original file's raw Git blob hash against the saved baseline;
  the original is an exact source copy, with its own relative CSS/JS assets.
- Both original JavaScript files pass `node --check`. No site code was changed.
- Keep `/original/` frozen for comparison. Future improvements belong at the root.
- Improved: https://flaviusvranau1.github.io/mdy-solutions-redesign/
- Original: https://flaviusvranau1.github.io/mdy-solutions-redesign/original/

### 2026-09-13 — realistic materials and smoother motion

- Preserved the original at commit `2898d43794038063d94787ae751f94df05b04112`
  and tag `before-3d-upgrade-2026-09-13`. Feature: `feat/realistic-smooth-3d`.
- Rebuilt the hero as a studio-lit kinetic sculpture: clear coated metal, baked
  procedural environment reflections, machined grooves, raised MDY badge, solid
  orbital rails with emissive inlays, instanced nodes and short signal trails.
- Corrected the old satellite geometry offset. Rotation and damping now use
  elapsed time instead of assuming a particular monitor refresh rate.
- Scoped WebGL to the hero stage; stop rendering offscreen and when the document
  is hidden. Reduced decorative particles from 1,600 to 140 desktop / 60 mobile.
  Bound the pixel budget and adapt resolution after sustained slow rendering.
  Replaced the animated four-viewport grain layer with a small static texture.
- Reuse GSAP quickTo tweens for buttons. Smooth tilt once per animation frame;
  cursor and tilt loops settle and stop. Remove reveal transforms after completion
  so they do not override CSS tilt. Remove competing CSS button transforms.
- Mobile has its own 3D stage, compact headline and a corrected menu close icon.
  Resize closes an open mobile menu when returning to desktop.
- Added a CSS orb fallback, nonzero demo values in HTML and a readable process
  grid when motion or animation libraries are unavailable. Process step numbers
  stay visible when arriving directly at #proces instead of waiting for entry triggers.
- Restricted KPI label styling to direct children; nested animated numbers keep
  their intended large type instead of inheriting the small muted label style.

## Validation

- Current atmosphere/motion correction: syntax and whitespace checks; desktop and
  390 x 844 mobile browser QA; no horizontal overflow or console errors.
- Local-only renderer instrumentation: background = 1 draw call; hero = 22 draw
  calls. Recorded continuous core yaw changing from 0.023 to 1.367 radians.
  Reduced-motion QA: zero animation callbacks, static background still visible.
  Temporary instrumentation is outside the repository and is not deployed.

### Earlier upgrade checks (before restoring persistent particles)

- `node --check main.js`, `node --check scene.js`, `git diff --check` passed.
  No build or TypeScript check applies to these four static assets.
- In-app browser: desktop at the default viewport and mobile at 390 x 844;
  no horizontal page overflow on mobile; WebGL visible at both layouts.
- Four service panels each opened exactly one matching panel and closed again.
  Mobile menu opened/closed and navigated to Contact. Courier demo CTA selected
  the correct form subject. No email was sent.
- Local QA server (outside this repository) counted scene animation callbacks:
  381 after scrolling away; still 381 after exercising all four service panels.
  This confirms that the offscreen rendering loop stops, not an FPS benchmark.
- Simulated reduced-motion media query: static WebGL, zero animation callbacks,
  correct demo values and all four process steps in a grid.
- CDN-library omission test: CSS fallback visible, readable content and all four
  process steps within the viewport width. Fresh QA tab console: no warnings/errors.
- Live deployment verification is recorded in the task handoff; GitHub Pages is
  sourced from main. Recheck after subsequent pushes.

## Run and undo

Run any static HTTP server from this directory, for example:
`npx --yes http-server . -p 8765 -c-1`.

Merge the feature with `--no-ff` so undo is one revert:
`git revert -m 1 <merge-commit>` then `git push origin main`.
For reference, inspect the saved original with
`git show before-3d-upgrade-2026-09-13:scene.js`.
Never reset or force-push published history.

## Status and limitations

Done: visual upgrade, interactions, responsive layout and local browser QA.
Next: user visual feedback; keep subsequent preferences as small separate commits.
The contact form intentionally opens a mail client. Product numbers are labeled
demonstration data. CDN/fonts still need internet. The renderer's context-loss
recovery is implemented but not fault-injected in this session. No numerical
performance promise across devices; compare on the actual target hardware.

## Conventions

Use the personal `flaviusvranau1` remote and GitHub no-reply author identity.
Keep changes on feature branches and update this journal in the same commit.
Preserve content, accessibility fallbacks and easy rollback. Do not modify the
company-account copy or the original mdysolutions.ro website.
