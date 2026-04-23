# Changelog

All notable project progress should be recorded here. The product specification in `wwvb_emulator_spec.md` remains the source of truth for requirements, while this file tracks implementation state and released milestones.

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
