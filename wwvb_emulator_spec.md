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
- The monitor tone must be optional
- The monitor tone must be disabled by default
- The monitor tone must be generated using the Web Audio API
- The monitor tone must be routed in parallel with the WWVB transmission path
- The monitor tone must not replace the 20 kHz carrier path

### Preferred Audible Monitor Tuning
Use a monitor style that is easy to perceive and reminiscent of a medical monitor or telemetry beep without being painfully sharp.

The audible monitor should still reflect the signal as a two-state system:
- low state -> silence
- restored high state -> short monitor beep

Distinction between `0`, `1`, and `Marker` must come from pulse duration and the moment the beep begins, not from using multiple note identities.

A preferred restored-state beep may use a moderately higher tone such as `F5`, provided it remains tolerable to hear repeatedly.

The audible transition timing must follow the real `0`, `1`, and `Marker` pulse widths.

The audible monitor must remain strictly parallel to the validated WWVB path and must not replace the real transmission logic.

### Audible Monitoring UI
The UI must show:
- Whether the WWVB transmission engine is running
- Whether the audible monitor tone is enabled or disabled

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
