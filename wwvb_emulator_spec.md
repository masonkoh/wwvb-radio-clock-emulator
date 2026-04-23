# WWVB Radio Clock Emulator Specification

## 1. Project Overview

### Objective
Develop a web application that emulates the 60 kHz longwave radio signal of the Colorado WWVB transmitter using a smartphone or PC speaker. The intended use case is synchronization of Wave Ceptor / Atomic Timekeeping watches such as the Casio G-Shock GW-5600J.

### Target Devices
- Smartphones
- Tablets
- PCs with modern HTML5 browsers and Web Audio API support

### Tech Stack
- Pure Vanilla JavaScript
- HTML
- CSS

This application must remain a single-page application with no external frameworks, no external libraries, and no backend servers.

## 2. Core Scientific Principles

The implementation must reflect the following physical and mathematical principles:

### Harmonic Generation
Because typical speakers cannot directly output a 60 kHz signal, the application generates a 20 kHz square wave. By Fourier analysis, the 3rd harmonic of a 20 kHz square wave contributes a 60 kHz electromagnetic component.

### Near-Field Magnetic Induction
The speaker voice coil vibrating at 20 kHz generates a localized electromagnetic field that may be readable by a watch's internal ferrite antenna.

### Pulse Width Modulation
The WWVB protocol transmits 1 bit per second by temporarily dropping signal amplitude to distinguish between:
- `0`
- `1`
- `Marker`

## 3. System Pipeline

### Step 1: Time Acquisition
Do not contact external NTP servers. Use the local device system time via JavaScript `Date`.

### Step 2: WWVB 60-Bit Timecode Encoding
Implement a robust helper that converts the current time into a 60-element WWVB frame for seconds `0` through `59`.

The encoder must map the following fields into their designated NIST WWVB positions:
- Minute
- Hour
- Day of Year
- Year
- Leap Year indicator
- Daylight Saving Time status

### Step 3: Web Audio API Output
Create an `AudioContext`.

Create a carrier `OscillatorNode` with:
- `type = "square"`
- `frequency = 20000`

Route the oscillator through a `GainNode` for WWVB amplitude modulation and then to the audio destination.

## 4. Critical Constraints

These constraints are mandatory.

### Precision Scheduling
Do not use `setTimeout` or `setInterval` for WWVB pulse timing.

Use `AudioContext.currentTime` and scheduled gain automation to pre-schedule precise pulse transitions.

### WWVB Pulse Width Rules
- Data `0`: low for `0.2s`, high for `0.8s`
- Data `1`: low for `0.5s`, high for `0.5s`
- Marker: low for `0.8s`, high for `0.2s`

Markers are placed at seconds:
- `0`
- `9`
- `19`
- `29`
- `39`
- `49`
- `59`

### Browser Autoplay Policy
Audio graph initialization or `AudioContext.resume()` must occur strictly inside the user's click event listener.

The UI must include a large `Start Transmit` control.

### Transition Smoothing
Abrupt gain transitions must be avoided because they cause audible pops and waveform corruption.

Use very short ramping such as `linearRampToValueAtTime` or `setTargetAtTime` around each gain transition.

## 5. UI/UX Requirements

### Visual Design
Use a clean dark-mode aesthetic with a dashboard or terminal feel.

### Controls
Provide prominent and intuitive:
- `Start Transmit`
- `Stop Transmit`

### Status Display
Show real-time transmission information including:
- Local time currently being transmitted
- Current bit being sent
- Current pulse width
- Audio engine status

## 6. Core Preservation Requirements

### MVP Validation
The implementation has already been validated as an MVP by successfully causing a Casio G-Shock GW-5600J to judge the transmitted signal as valid WWVB reception.

### Protected Core Function
The validated WWVB transmission path is the core product function and must remain intact.

Future work must not replace, weaken, or substantially rework the validated transmission path unless explicitly approved by the user.

Protected core areas include:
- 20 kHz square-wave carrier generation
- WWVB frame encoding
- Precision gain scheduling
- Existing 60-bit frame UI

## 7. Audible Monitoring Requirements

Because the 20 kHz carrier may be inaudible or difficult to perceive, the application must support an optional human-audible monitoring mode.

### Audible Monitor Rules
- The application must expose a user-selectable output mode for `Radio Reception Mode` and `Audible Monitor Tone Mode`
- These two output modes must be mutually exclusive
- `Radio Reception Mode` must preserve the validated 20 kHz WWVB transmission path
- `Audible Monitor Tone Mode` must be generated using the Web Audio API
- `Audible Monitor Tone Mode` is for human listening only and must not be presented as a real watch-synchronization mode

### Preferred Audible Monitor Tuning
Use a monitor style that is easy to perceive and reminiscent of a medical monitor or telemetry beep without being painfully sharp.

The audible monitor should still reflect the signal as a two-state system:
- low state -> silence
- restored high state -> short monitor beep

Distinction between `0`, `1`, and `Marker` must come from pulse duration and the moment the beep begins, not from using multiple note identities.

A preferred restored-state beep may use a moderately higher tone such as `F5`, provided it remains tolerable to hear repeatedly.

The audible transition timing must follow the real `0`, `1`, and `Marker` pulse widths.

The UI must clearly warn that actual watch synchronization requires `Radio Reception Mode`.

### Audible Monitoring UI
The UI must show:
- Whether the WWVB transmission engine is running
- Which output mode is currently selected
- That `Audible Monitor Tone Mode` is not the correct mode for real watch synchronization

## 8. Graph Visualization Requirements

The application should provide a separate graph visualization area inspired by the usability goals of the reference site [timestation.pages.dev](https://timestation.pages.dev/), while preserving the existing protocol-oriented frame display.

### Preserve Existing 60-Bit Frame
The current 60-bit frame UI is considered successful and must not be modified, replaced, removed, or reinterpreted as a different visualization system.

### Separate Graph Panel
Any waveform or live signal graph must be implemented as a separate graph panel.

The graph layer must not reuse or mutate the existing 60-bit frame component.

### Purpose of the Graph
The graph should help users understand live signal activity in real time, especially when audible monitoring is enabled.

The graph is an explanation and monitoring layer, not a replacement for the WWVB frame display.

### Preferred Graph Content
The graph panel may include:
- A readable live step waveform that reflects the current WWVB pulse structure
- A visual representation of the current 1-second PWM envelope
- Optional short-duration recent signal history

The waveform style should prioritize readability over raw high-frequency carrier visualization.

The live waveform should move continuously across the panel rather than snapping only at 1-second boundaries.

The waveform direction should remain semantically aligned with the audible monitor:
- low pulse state -> visually dropped / depressed segment
- restored high state -> visually elevated / active segment

### Graph Constraints
The graph must remain a passive visualization layer only.

It must not alter:
- The validated WWVB transmission path
- The 20 kHz carrier generation logic
- The gain scheduling logic
- The existing 60-bit frame UI

## 9. Deliverables

The application is implemented in:
- `index.html`
- `style.css`
- `app.js`

Supporting documentation should be maintained separately:
- `wwvb_emulator_spec.md` for requirements
- `CHANGELOG.md` for version history and implementation milestones

## 10. Global Expansion Architecture (`v0.3`)

### Goal
The next product phase must evolve the application from a `WWVB-only` emulator into a structured `radio-controlled watch signal emulator` architecture that can later support additional standards without destabilizing the validated WWVB implementation.

This version is an architecture and product-structure release, not a full multi-protocol implementation release.

### Required Outcome
`v0.3` must achieve all of the following:
- Preserve the current validated WWVB transmission path without regression
- Introduce a protocol-selection architecture in the UI and codebase
- Make the current support boundary explicit to users
- Prepare the application to add `MSF`, `JJY`, `DCF77`, and `BPC` in later versions

### Explicit Non-Goals
`v0.3` must not:
- Replace or redesign the validated WWVB transmission path
- Claim working support for non-WWVB protocols
- Introduce a backend server
- Introduce external libraries or frameworks
- Remove or reinterpret the existing 60-bit frame UI

## 11. Product Positioning

### Current Stable Position
The current product is a stable `WWVB` speaker-based emulator.

### Expanded Product Direction
The product direction for `v0.3` and beyond is:
- `Radio-Controlled Watch Signal Emulator`

This means the application should present `WWVB` as the current stable mode while making clear that support for other radio time standards is planned through a modular expansion path.

### Supported vs Planned Messaging
The application must distinguish between:
- `Stable` protocols
- `Experimental` protocols
- `Planned` protocols

At the `v0.3` stage, only `WWVB` may be labeled `Stable`.

## 12. Target Users

The application should be structured for the following user groups:
- Users with `WWVB-compatible` watches
- Users with `Casio Multiband 6` watches
- Users in Japan, the UK, Europe, or China evaluating future compatibility
- Radio-controlled watch collectors and hobbyists

## 13. User Experience Requirements For Global Expansion

### Clarity of Compatibility
The application must not imply that all radio-controlled watches are already supported.

The UI must explicitly communicate:
- The currently selected signal standard
- Whether that standard is `Stable`, `Experimental`, or `Planned`
- That watch compatibility depends on support for that signal standard

### Required Compatibility Warnings
The interface must include clear product messaging equivalent to the following:
- `Stable today: WWVB-compatible watches`
- `Other radio time standards are planned, not active yet`
- `Your watch must support the selected signal standard`
- `WWVB mode will not synchronize JJY-only, DCF77-only, MSF-only, or BPC-only watches`

## 14. Signal Mode UI Requirements

### New Signal Mode Section
The application must introduce a dedicated `Signal Mode` or equivalent selector area.

This section should display:
- The selected protocol name
- The nominal target frequency
- The protocol support state
- A short description or region hint

### Initial Protocol Catalog
The architecture must support the following initial registry entries:
- `WWVB 60 kHz` — `Stable`
- `MSF 60 kHz` — `Planned`
- `JJY 60 kHz` — `Planned`
- `JJY 40 kHz` — `Planned`
- `DCF77 77.5 kHz` — `Planned`
- `BPC 68.5 kHz` — `Planned`

### Interaction Rules
For `v0.3`:
- Users may be allowed to view planned protocol entries
- Only `WWVB` may be transmissible
- Planned modes must not start a fake transmission
- If unsupported modes are selectable, the UI must clearly block transmission and explain why

## 15. Status Panel Expansion

The transmission status area should be extended to support multi-protocol operation.

Additional status fields should include:
- `Selected Signal`
- `Protocol Status`
- `Carrier Strategy`

The existing fields for local time, current bit, pulse width, audio engine state, and monitor state must remain intact unless a change is explicitly approved.

## 16. Protocol Registry Requirements

The codebase must define a protocol registry or equivalent data structure so protocol-specific configuration is not hard-coded into the transmission engine.

Each protocol definition should support fields such as:
- `id`
- `label`
- `carrierFrequency`
- `status`
- `region`
- `description`
- `frameType`
- `encoderAvailable`
- `audibleMonitorProfile`
- `graphProfile`

The registry must be the single source of truth for protocol metadata used by the UI.

## 17. Encoder Architecture Requirements

### Encoder Isolation
The current `WWVB` encoder logic must be isolated behind a protocol-aware interface.

The design should move toward an abstraction equivalent to:
- `encodeFrame(date, protocol)`
- or `activeProtocol.encodeFrame(date)`

### WWVB Reference Implementation
`WWVB` must remain the reference implementation for the architecture.

At `v0.3`:
- `WWVB` must have a real encoder
- Other protocols may remain placeholders with metadata only

### Unsupported Protocol Behavior
If a protocol does not yet have a real encoder:
- The application must not fabricate a frame
- The application must not pretend transmission is active
- The application must present a planned-state explanation instead

## 18. Carrier Strategy Architecture

The codebase must separate protocol rules from carrier-generation strategy.

This should support a model where:
- A protocol defines signal semantics
- A carrier profile defines frequency, waveform, and harmonic strategy
- The scheduler executes timing using those definitions

### Required Separation
The architecture should distinguish:
- `protocol layer`
- `carrier layer`
- `scheduler layer`

### WWVB Carrier Baseline
For `WWVB`, the current carrier strategy remains the required stable baseline:
- `20 kHz` square-wave carrier
- Harmonic-based WWVB emulation
- Gain automation for WWVB pulse widths

This baseline must not be weakened during refactoring.

## 19. Scheduler Requirements For Multi-Protocol Growth

Even after protocol abstraction is introduced:
- Pulse timing must still be scheduled with `AudioContext.currentTime`
- Gain automation must remain pre-scheduled
- Main-thread timers must not become the source of pulse timing

Architecture refactoring must not reintroduce timing drift risk.

## 20. Audible Monitor And Graph Extensibility

The audible monitor and graph systems should be refactored to read from protocol metadata where practical, while preserving their existing `WWVB` behavior.

At `v0.3`:
- `WWVB` monitor behavior must remain intact
- `WWVB` graph behavior must remain intact
- Other protocols may define placeholder monitor or graph profiles
- Unsupported protocols must not display misleading active-signal visuals

## 21. Preservation Of Existing Core UI

The following components are protected and must remain present:
- `Start Transmit`
- `Stop Transmit`
- `Transmission Status`
- `60-Bit Frame`
- `Live Signal Graph`

### 60-Bit Frame Protection
The existing `60-Bit Frame` is a successful protocol-facing visualization and must not be removed or substantially altered during `v0.3`.

If protocol-specific visualization expansion is needed later, it must be added alongside the existing WWVB frame view unless explicitly approved otherwise.

## 22. Documentation Requirements For `v0.3`

The following documents must be updated when `v0.3` is implemented:
- `wwvb_emulator_spec.md`
- `CHANGELOG.md`
- `README.md` when public-facing support scope changes

Documentation must accurately distinguish:
- currently working behavior
- planned future behavior
- protected core behavior

## 23. Release Acceptance Criteria For `v0.3`

`v0.3` is complete only if all of the following are true:
- The validated WWVB path still works as before
- The codebase can express protocol definitions through a registry or equivalent abstraction
- The UI exposes `WWVB` as the current stable mode
- The UI exposes other standards as planned rather than falsely active
- The user can understand that compatibility depends on watch signal support
- Existing graph and frame components remain intact
- No backend or external framework is introduced

`v0.3` is not acceptable if any of the following occur:
- WWVB transmission behavior regresses
- The application appears to support non-WWVB transmission when it does not
- The protected 60-bit frame view is removed or compromised
- Timing precision is weakened by the refactor

## 24. Forward Roadmap Guidance

The intended follow-on path after `v0.3` is:
- `v0.4`: add one real non-WWVB protocol such as `MSF 60 kHz` or `JJY 60 kHz`
- `v0.5`: add a second real non-WWVB protocol
- `v0.6`: expand carrier strategy experiments for more difficult frequency targets
- `v0.7`: add watch-model-oriented recommendations or presets

These later versions must continue to preserve the validated WWVB path as the product's stable reference implementation.
