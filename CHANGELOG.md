# Changelog

All notable project progress should be recorded here. The product specification in `wwvb_emulator_spec.md` remains the source of truth for requirements, while this file tracks implementation state and released milestones.

## v0.3 - 2026-04-23

### Status
- The validated WWVB transmission path remains preserved as the only live transmission mode.
- The product has been restructured into a protocol-aware architecture for future global expansion.

### Implemented
- Added a dedicated `Signal Mode` panel with explicit `Stable` and `Planned` protocol states.
- Reworked the `Signal Mode` UI from an always-expanded protocol card grid into a compact selector plus single-detail layout to reduce wasted space.
- Replaced the old audible monitor checkbox with mutually exclusive `Radio Reception Mode` and `Audible Monitor Tone Mode` controls in the hero section.
- Introduced a protocol registry covering `WWVB`, `MSF`, `JJY 60`, `JJY 40`, `DCF77`, and `BPC`.
- Refactored the client logic so the live transmission path now runs through an active-protocol abstraction instead of direct WWVB-only wiring.
- Preserved `WWVB` as the sole transmissible protocol while clearly blocking planned protocols from starting fake transmissions.
- Expanded the status panel with `Selected Signal`, `Protocol Status`, and `Carrier Strategy`.
- Updated the protected `60-Bit Frame` area so it remains present while clearly acting as a WWVB reference when planned protocols are selected.
- Preserved the existing graph and audible monitor behavior for `WWVB` while preventing misleading live-signal behavior for planned protocols.
- Split the output behavior so radio mode drives the real WWVB carrier path while audible mode plays a human-audible monitor pattern with an explicit watch-sync warning.

### Documentation
- Expanded `wwvb_emulator_spec.md` with detailed `v0.3` global expansion architecture requirements and acceptance criteria.
- Updated `README.md` to describe `v0.3`, the current support boundary, and the public GitHub Pages deployment.

## v0.2 - 2026-04-22

### Status
- Core WWVB transmission path remains preserved and unchanged.
- Audible monitoring and live graph features have been refined into a more interpretable user-facing monitoring layer.

### Implemented
- Added a separate `Live Signal Graph` panel without modifying the existing 60-bit frame display.
- Reworked the output waveform graph into a readable WWVB step waveform style.
- Smoothed the waveform graph motion so it scrolls continuously instead of jumping once per second.
- Flipped the waveform graph semantics so the visual low/high direction matches the audible monitor behavior.
- Reworked the audible monitor away from a single constant beep.
- Changed the audible monitor so timing differences are heard at the real WWVB pulse boundary.
- Simplified the audible monitor into a true two-state system so signal differences are communicated by duration, not by multiple note identities.
- Changed the audible monitor to silence during the low state and emit a slightly higher monitor-style beep only during the restored high state.

### Documentation
- Updated the specification to reflect the current audible monitor behavior: low state silent, restored high state monitor beep.
- Kept the specification aligned with the requirement that the 60-bit frame remains preserved as a separate stable core view.
- Updated the specification to reflect the continuously scrolling step waveform and the aligned low/high graph semantics.
- Added a repository `README.md` with project summary, usage notes, and the public GitHub Pages URL.
- Expanded `.gitignore` to exclude common desktop metadata files from future commits.

## v0.1 - 2026-04-22

### Status
- MVP validated with successful reception judgment on a Casio G-Shock GW-5600J.
- Core WWVB transmission path is considered stable and must be preserved.

### Implemented
- Created the core single-page application with `index.html`, `style.css`, and `app.js`.
- Implemented a 60-bit WWVB frame encoder based on current device time.
- Implemented 20 kHz square-wave carrier generation for WWVB emulation.
- Implemented hardware-timed WWVB amplitude modulation using `AudioContext.currentTime` and gain automation.
- Added `Start Transmit` and `Stop Transmit` controls with browser autoplay-safe startup behavior.
- Added live status displays for local time, frame start, current bit, and pulse width.
- Added the 60-bit frame visualization and kept it as a stable core UI component.
- Added optional audible monitoring tone support.

### Documentation
- Created `wwvb_emulator_spec.md` from the master specification.
- Updated the specification with MVP validation notes and core preservation requirements.

### Notes
- The specification document should remain focused on product behavior and requirements.
- Version history, implementation milestones, and release-state summaries should be documented in this changelog rather than merged directly into the specification.
