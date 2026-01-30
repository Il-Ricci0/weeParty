# Wee Party

A browser-based party game platform where phones act as controllers and a PC acts as the main game screen, powered by WebRTC.

## Quick Start

### Prerequisites
- Node.js 20+
- .NET 8 SDK

### Running the Development Environment

1. **Start the Backend** (Terminal 1):
   ```bash
   cd backend/WeeParty.Api
   dotnet run
   ```
   Backend runs on `http://localhost:5000`

2. **Start the PC Client** (Terminal 2):
   ```bash
   cd frontend
   npm run start:pc
   ```
   PC client runs on `http://localhost:4200`

3. **Start the Phone Client** (Terminal 3):
   ```bash
   cd frontend
   npm run start:phone
   ```
   Phone client runs on `http://localhost:4201`

### How to Play

1. Open the PC client at `http://localhost:4200` on your computer
2. A session code and QR code will be displayed
3. On your phone, navigate to `http://localhost:4201` (or scan the QR code)
4. Enter the session code and your name
5. Once connected, click "Start Game" on the PC
6. Calibrate your phone controller when prompted
7. Tilt your phone to move your paddle!

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Backend   │◄──── Signaling ────│  PC Client  │
│  (ASP.NET)  │                    │  (Angular)  │
└─────────────┘                    └──────┬──────┘
                                          │
                                   WebRTC DataChannel
                                   (peer-to-peer input)
                                          │
                                   ┌──────┴──────┐
                                   │Phone Client │
                                   │  (Angular)  │
                                   └─────────────┘
```

- **Backend**: Handles session management and WebRTC signaling only
- **PC Client**: Hosts the game, displays QR code, receives controller input via WebRTC
- **Phone Client**: Sends tilt/button input directly to PC via WebRTC

## Project Structure

```
weeParty/
├── backend/
│   └── WeeParty.Api/         # ASP.NET Web API
│       ├── Models/           # Session, Player, SignalingMessage
│       ├── Services/         # SessionService
│       └── Hubs/             # WebSocket signaling
├── frontend/
│   └── projects/
│       ├── shared/           # Shared Angular library
│       │   └── src/lib/
│       │       ├── models/   # TypeScript interfaces
│       │       └── services/ # SignalingService, WebRTCService
│       ├── pc-client/        # PC Angular app
│       │   └── src/
│       │       ├── app/      # Host, GameFrame components
│       │       └── assets/   # Games (Pong), WeeParty runtime
│       └── phone-client/     # Phone Angular app
│           └── src/app/      # Join, Controller components
└── docs/
    └── wee_party_platform_specification.md
```

## Games

Games are standard web apps that run in a sandboxed iframe. They communicate with the platform via the `WeeParty` runtime API:

```javascript
// Receive input from controllers
WeeParty.onInput((input) => {
  if (input.type === 'tilt') {
    // input.data = { x: -1 to 1, y: -1 to 1 }
  }
  if (input.type === 'button') {
    // input.data = { button: 'A', pressed: true }
  }
});

// Know when game starts
WeeParty.onGameStart((players) => {
  // players = [{ id, name, playerIndex }, ...]
});

// Send haptic feedback
WeeParty.vibrate(playerId, durationMs);
```

## License

MIT
