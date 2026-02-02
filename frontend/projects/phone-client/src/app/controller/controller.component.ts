import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SignalingService, WebRTCService, OfferMessage, IceCandidateMessage, SessionRejoinedMessage } from 'shared';

interface SavedSession {
  sessionId: string;
  playerId: string;
  playerIndex: number;
  playerName: string;
}

@Component({
  selector: 'app-controller',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controller.component.html',
  styleUrl: './controller.component.scss'
})
export class ControllerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private playerId = '';
  private playerIndex = 0;
  private playerName = '';
  private sessionId = '';
  private hostConnectionId = '';
  private isRejoining = false;

  connected = signal<boolean>(false);
  gameStarted = signal<boolean>(false);
  reconnecting = signal<boolean>(false);
  isLandscape = signal<boolean>(false);

  private readonly VELOCITY = 0.5;

  constructor(
    private signaling: SignalingService,
    private webrtc: WebRTCService,
    private router: Router
  ) {
    // Check if we have an active signaling connection (indicates fresh navigation, not reload)
    const hasActiveConnection = this.signaling.isConnected();

    // Try to get state from router navigation first
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;

    if (state?.playerId && hasActiveConnection) {
      // Fresh navigation with active connection
      this.playerId = state.playerId;
      this.playerIndex = state.playerIndex;
      this.sessionId = state.sessionId;
      return;
    }

    // Check sessionStorage for saved session (page reload case or lost connection)
    const savedSession = this.getSavedSession();
    if (savedSession) {
      this.playerId = savedSession.playerId;
      this.playerIndex = savedSession.playerIndex;
      this.playerName = savedSession.playerName;
      this.sessionId = savedSession.sessionId;
      this.isRejoining = true;
      return;
    }

    // Fallback: if we have state but no connection, use state data for rejoin
    if (state?.playerId) {
      this.playerId = state.playerId;
      this.playerIndex = state.playerIndex;
      this.sessionId = state.sessionId;
      this.isRejoining = true;
      return;
    }

    // No session data available - redirect to join
    this.router.navigate(['/']);
  }

  async ngOnInit(): Promise<void> {
    this.setupSignalingHandlers();
    this.updateOrientation();

    if (this.isRejoining) {
      await this.rejoinSession();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateOrientation();
  }

  private updateOrientation(): void {
    this.isLandscape.set(window.innerWidth > window.innerHeight);
  }

  private getSavedSession(): SavedSession | null {
    const saved = sessionStorage.getItem('weeParty-session');
    if (!saved) return null;
    try {
      return JSON.parse(saved) as SavedSession;
    } catch {
      return null;
    }
  }

  private async rejoinSession(): Promise<void> {
    this.reconnecting.set(true);
    try {
      await this.signaling.connect();
      this.signaling.rejoinSession(this.sessionId, this.playerId, this.playerIndex, this.playerName);
    } catch (e) {
      console.error('Failed to reconnect:', e);
      sessionStorage.removeItem('weeParty-session');
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signaling.disconnect();
  }

  private setupSignalingHandlers(): void {
    // Handle successful rejoin
    this.signaling.onMessage<SessionRejoinedMessage>('session-rejoined')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        this.reconnecting.set(false);
        if (msg.gameStarted) {
          this.gameStarted.set(true);
        }
        // Host will send a new offer after receiving player-rejoined
      });

    // Handle rejoin/connection errors
    this.signaling.onMessage<{ type: 'error'; message: string }>('error')
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => {
        console.error('Session error:', msg.message);
        sessionStorage.removeItem('weeParty-session');
        this.router.navigate(['/']);
      });

    // Handle session ended (host disconnected)
    this.signaling.onMessage<{ type: 'session-ended' }>('session-ended')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        sessionStorage.removeItem('weeParty-session');
        this.router.navigate(['/']);
      });

    // Handle host offer
    this.signaling.onMessage<OfferMessage>('offer')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async msg => {
        this.hostConnectionId = msg.fromId;
        await this.webrtc.createPeerForHost(msg.fromId, candidate => this.signaling.sendIceCandidate(msg.fromId, candidate));
        const answer = await this.webrtc.handleOffer(msg.fromId, msg.sdp);
        this.signaling.sendAnswer(msg.fromId, answer.sdp!);
        this.reconnecting.set(false);
      });

    // Handle ICE candidates
    this.signaling.onMessage<IceCandidateMessage>('ice-candidate')
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => this.webrtc.handleIceCandidate(msg.fromId, msg.candidate, msg.sdpMid, msg.sdpMLineIndex));

    // Connection state
    this.webrtc.connectionStates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(states => this.connected.set(states.get(this.hostConnectionId) === 'connected'));

    // Game started
    this.signaling.onMessage<{ type: 'game-started' }>('game-started')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.gameStarted.set(true);
      });
  }

  onZoneDown(direction: 'up' | 'down'): void {
    if (!this.connected()) return;
    const x = direction === 'up' ? -this.VELOCITY : this.VELOCITY;
    this.sendInput(x);
    this.vibrate(10);
  }

  onZoneUp(): void {
    if (!this.connected()) return;
    this.sendInput(0);
  }

  private sendInput(x: number): void {
    this.webrtc.sendInput({
      type: 'tilt',
      playerId: this.playerId,
      playerIndex: this.playerIndex,
      data: { x, y: 0 }
    });
  }

  private vibrate(duration: number): void {
    if (navigator.vibrate) navigator.vibrate(duration);
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event): void {
    event.preventDefault();
  }
}
