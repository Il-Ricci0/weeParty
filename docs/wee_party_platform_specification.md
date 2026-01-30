# Wee Party – Product & Technical Specification

---

## Quick Project Summary

### Project Overview
Wee Party is a **browser‑based party game platform** inspired by the Wii U.
- A **PC** hosts and displays the game.
- **Phones** act as controllers.
- Everything runs in the browser.
- Real‑time input is handled via **WebRTC**.
- Games and controllers are **user‑created** and framework‑agnostic.

The platform acts as a **runtime and coordinator**, not a game engine.

---

### Tech Stack
- **Frontend (PC & Phone):** Angular
- **Backend:** C# / ASP.NET
- **Real‑time Transport:** WebRTC (DataChannels)
- **Signaling & Sessions:** Backend (HTTP / WebSocket)
- **Database:** MongoDB
- **Game Runtime:** Sandboxed iframe + JavaScript contract

---

### Communication Explained
- Backend creates and manages game sessions.
- Backend performs **WebRTC signaling** only (SDP + ICE exchange).
- After connection:
  - Phone ↔ PC communicate **peer‑to‑peer**.
  - Controller input never goes through the backend.
- Backend remains a **referee**, not a participant.

---

### The Game Screen (PC)
- Runs in the browser (Angular shell).
- Loads the selected game inside a **sandboxed iframe**.
- Receives controller input via WebRTC.
- Forwards input to the game runtime using `postMessage`.
- Displays join QR / session code.

The game itself is a normal web app and controls its own rendering loop.

---

### The Controller Screen (Phone)
- Runs in the browser (Angular).
- UI is generated from a **controller schema**.
- Sends normalized input events (buttons, axes, gestures).
- Connects directly to the PC using WebRTC DataChannels.
- Supports haptics and visual feedback.

---

### Making Games and Controllers

**Games**
- Uploaded as static web apps (HTML, JS, assets).
- Can use any framework or engine (Three.js, Phaser, React, etc.).
- Interact with the platform via a small JavaScript runtime API.
- Run fully sandboxed in an iframe.

**Controllers**
- Defined by data schemas.
- Describe inputs and layout, not logic.
- Mapped dynamically to controller UIs.
- Reusable across multiple games.

---


> A browser‑based party gaming platform where **phones act as controllers** and a **PC acts as the main game screen**, powered by **WebRTC**. Games and controller types are **user‑created**, framework‑agnostic, and run as standard web apps.

---

## 1. Vision & Goals

### Core Vision
Wee Party is a **web‑native console**:
- No native apps
- No proprietary game engine
- No framework lock‑in

If it runs in a browser, it can be a game.

### Primary Goals
- Ultra‑low‑latency local multiplayer
- Phones as flexible, dynamic controllers
- Users can upload and share custom games & controller layouts
- Games can use **any JS framework or engine** (Three.js, Phaser, React, etc.)
- Backend stays out of the real‑time hot path

### Non‑Goals
- Server‑side game simulation
- Competitive esports‑grade determinism
- Native console parity

---

## 2. High‑Level Architecture

### Components

**Frontend (Angular)**
- PC Client (Game Host)
- Phone Client (Controller)

**Backend (C# / ASP.NET)**
- WebRTC signaling
- Session & lobby management
- Game & controller storage
- Permissions & moderation

**Networking**
- WebRTC DataChannels for real‑time input
- HTTP/WebSocket for signaling only

**Storage (MongoDB)**
- Games
- Controller definitions
- Sessions (metadata only)

---

## 3. Core User Flows

### 3.1 Hosting a Game (PC)
1. User opens Wee Party on PC
2. Selects a game
3. Backend creates a session
4. PC displays join QR / code
5. Game loads inside a sandboxed iframe

### 3.2 Joining as a Controller (Phone)
1. User scans QR or enters code
2. Phone loads controller UI
3. Backend associates phone with session
4. WebRTC signaling completes
5. Phone connects directly to PC via DataChannel

### 3.3 Gameplay
- Controller inputs flow **peer‑to‑peer** (Phone → PC)
- Backend is not involved in live input
- PC forwards inputs to game runtime

---

## 4. Games

### 4.1 What a Game Is
A game is a **static web app**:
- `index.html`
- JS bundles
- Assets (images, audio, shaders, etc.)

Games are uploaded, stored, and served by the platform.

### 4.2 Game Freedom
Games may use:
- Any JS framework or engine
- Canvas, WebGL, WebGPU
- WASM
- Custom build pipelines

Games must **not**:
- Access backend services directly
- Open arbitrary network connections
- Escape iframe sandbox

---

## 5. Game Runtime Contract

### 5.1 Core Principle
The platform provides a **minimal JavaScript API** injected into the game.

This is a *contract*, not a framework.

### 5.2 Runtime Object

The platform injects:
```
window.WeeParty
```

### 5.3 Responsibilities of the Runtime
- Deliver controller input to games
- Notify about player join/leave
- Allow feedback to controllers (vibration, messages)

### 5.4 Design Rules
- Small surface area
- Backward‑compatible
- Framework‑agnostic
- Event‑driven

---

## 6. Controllers

### 6.1 What a Controller Is
A controller is:
- A web UI (Angular)
- Driven by a **controller schema**
- Sends normalized input events

### 6.2 Controller Schema
Controller types are defined via data:
- Buttons
- Axes
- Gestures
- Layout metadata

Schemas allow dynamic controller UIs without hardcoding.

### 6.3 Input Model
- Inputs are serialized as small JSON payloads
- Sent via WebRTC DataChannels
- Unordered & unreliable (latency > reliability)

---

## 7. WebRTC Design

### 7.1 Transport Rules
- DataChannels only
- No audio/video streams
- One channel per controller

### 7.2 Backend Role
- SDP offer/answer exchange
- ICE candidate relay
- Session authentication

Backend disconnects after peer connection succeeds.

### 7.3 Failure Handling
- Graceful reconnect
- Controller drop‑out detection
- Session cleanup

---

## 8. Security Model

### 8.1 Game Sandboxing
Games run in iframes with:
- `sandbox` attributes
- Strict CSP headers
- No same‑origin access

### 8.2 Upload Restrictions
- File size limits
- Asset type validation
- Versioned uploads

### 8.3 Abuse Prevention
- Session timeouts
- Kill‑switch for games
- Moderation hooks

---

## 9. Backend Data Model (High Level)

### Games
- id
- name
- version
- asset manifest
- permissions

### Controllers
- id
- schema
- layout metadata

### Sessions
- id
- gameId
- players
- state

Live input is **never persisted**.

---

## 10. Optional SDK

### Purpose
Provide a lightweight helper library that:
- Wraps postMessage
- Adds typings
- Simplifies onboarding

### Rules
- Optional
- Tiny
- No lock‑in

---

## 11. Development Phases

### Phase 1 – Core Loop
- Single game
- Single controller type
- WebRTC input working

### Phase 2 – Uploads
- Game upload & hosting
- Controller schemas

### Phase 3 – Platform Polish
- Discovery
- Versioning
- Analytics

---

## 12. Guiding Principles (Non‑Negotiable)

- Familiar web tech over custom engines
- Backend never in the real‑time path
- Freedom for creators
- Safety by isolation, not restriction
- Ship early, iterate often

---

**Wee Party is not a game.
It is the place games happen.**

