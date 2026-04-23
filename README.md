# WWVB Radio Clock Emulator

Web-based radio-controlled watch signal emulator built with vanilla HTML, CSS, and JavaScript.

Live deployment:
- [https://masonkoh.github.io/wwvb-radio-clock-emulator/](https://masonkoh.github.io/wwvb-radio-clock-emulator/)

## Purpose

This project uses a device speaker to emit a `20 kHz` square-wave carrier and WWVB-style amplitude modulation so a nearby Wave Ceptor / Atomic watch can attempt synchronization through near-field coupling.

The implementation has been validated at MVP level by successful reception judgment on a Casio G-Shock `GW-5600J`.

## Current Version

- `v0.3`

## Features

- 60-bit WWVB frame encoder based on local device time
- `20 kHz` square-wave carrier for WWVB emulation
- Hardware-timed gain automation using `AudioContext.currentTime`
- Start / stop transmission controls with autoplay-safe startup
- Stable 60-bit frame visualization
- Exclusive output modes for `Radio Reception` and `Audible Monitor Tone`
- Separate live signal graph panel with readable step waveform and PWM envelope
- `Signal Mode` architecture with `WWVB` as the current stable protocol
- Planned protocol registry entries for `MSF`, `JJY 60`, `JJY 40`, `DCF77`, and `BPC`

## Project Structure

- `index.html`
- `style.css`
- `app.js`
- `wwvb_emulator_spec.md`
- `CHANGELOG.md`

## Local Use

Because this is a static client-side application, it can be opened directly in a browser or hosted on a static site platform such as GitHub Pages.

Recommended usage:
1. Open the site.
2. Keep `WWVB 60 kHz` selected for live transmission.
3. Choose `Radio Reception Mode` for real watch synchronization or `Audible Monitor Tone Mode` for human listening.
4. Press `Start Transmit`.
5. Place the watch close to the phone or laptop speaker when using `Radio Reception Mode`.

## Deployment

This repository is compatible with GitHub Pages static hosting.

Published site:
- [https://masonkoh.github.io/wwvb-radio-clock-emulator/](https://masonkoh.github.io/wwvb-radio-clock-emulator/)

## Notes

- The validated WWVB transmission path is the protected core behavior.
- `WWVB` is the only live protocol in `v0.3`.
- `Audible Monitor Tone Mode` is for human listening only and not for actual watch synchronization.
- The existing 60-bit frame UI should remain unchanged unless explicitly approved.
- Requirements live in `wwvb_emulator_spec.md`.
- Version history lives in `CHANGELOG.md`.
