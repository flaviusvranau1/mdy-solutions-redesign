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
