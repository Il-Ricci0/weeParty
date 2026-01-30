import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SignalingService, WebRTCService, OfferMessage, IceCandidateMessage, TiltInput } from 'shared';

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
  private hostConnectionId = '';
  private tiltEnabled = false;

  connected = signal<boolean>(false);
  gameStarted = signal<boolean>(false);
  tiltCalibrated = signal<boolean>(false);
  currentTilt = signal<TiltInput>({ x: 0, y: 0 });

  // D-Pad state
  private readonly VELOCITY = 0.5; // adjust movement speed

  constructor(
    private signaling: SignalingService,
    private webrtc: WebRTCService,
    private router: Router
  ) {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;
    if (!state?.playerId) {
      this.router.navigate(['/']);
      return;
    }
    this.playerId = state.playerId;
    this.playerIndex = state.playerIndex;
  }

  ngOnInit(): void {
    this.setupSignalingHandlers();
    this.enableTilt();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signaling.disconnect();
  }

  private setupSignalingHandlers(): void {
    // Handle host offer
    this.signaling.onMessage<OfferMessage>('offer')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async msg => {
        this.hostConnectionId = msg.fromId;
        await this.webrtc.createPeerForHost(msg.fromId, candidate => this.signaling.sendIceCandidate(msg.fromId, candidate));
        const answer = await this.webrtc.handleOffer(msg.fromId, msg.sdp);
        this.signaling.sendAnswer(msg.fromId, answer.sdp!);
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
        this.tiltCalibrated.set(true);
        this.tiltEnabled = true;
      });
  }

  /** D-Pad Handlers **/
  onDpadDown(direction: 'up' | 'down'): void {
    if (!this.connected()) return;
    const dx = direction === 'up' ? -this.VELOCITY : this.VELOCITY;
    this.sendTilt(dx, 0);
    this.vibrate(10);
  }

  onDpadUp(): void {
    if (!this.connected()) return;
    this.sendTilt(0, 0);
  }

  /** Button Handlers **/
  onButtonDown(button: string): void {
    if (!this.connected()) return;
    this.webrtc.sendInput({
      type: 'button',
      playerId: this.playerId,
      playerIndex: this.playerIndex,
      data: { button, pressed: true }
    });
    this.vibrate(10);
  }

  onButtonUp(button: string): void {
    if (!this.connected()) return;
    this.webrtc.sendInput({
      type: 'button',
      playerId: this.playerId,
      playerIndex: this.playerIndex,
      data: { button, pressed: false }
    });
  }

  /** Tilt Handling **/
  private enableTilt(): void {
    if (!this.tiltEnabled) return;

    let lastSentX = 0;
    let lastSentY = 0;
    const DEADZONE = 0.05;

    window.addEventListener('deviceorientation', event => {
      const gamma = event.gamma ?? 0;
      const x = Math.max(-1, Math.min(1, gamma / 45)); // normalize
      const y = 0;

      // Only send if significant change
      if (Math.abs(x - lastSentX) > DEADZONE || Math.abs(y - lastSentY) > DEADZONE) {
        this.sendTilt(x, y);
        lastSentX = x;
        lastSentY = y;
      }

      this.currentTilt.set({ x, y });
    });
  }

  private sendTilt(x: number, y: number): void {
    this.webrtc.sendInput({
      type: 'tilt',
      playerId: this.playerId,
      playerIndex: this.playerIndex,
      data: { x, y }
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
