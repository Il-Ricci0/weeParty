import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SignalingService, WebRTCService, OfferMessage, IceCandidateMessage } from 'shared';

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

  connected = signal<boolean>(false);
  gameStarted = signal<boolean>(false);

  // D-Pad velocity
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
      });
  }

  /** D-Pad Handlers **/
  onDpadDown(direction: 'up' | 'down'): void {
    if (!this.connected()) return;
    const x = direction === 'up' ? -this.VELOCITY : this.VELOCITY;
    this.sendDpadInput(x);
    this.vibrate(10);
  }

  onDpadUp(): void {
    if (!this.connected()) return;
    this.sendDpadInput(0);
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

  /** Helper to send D-Pad input **/
  private sendDpadInput(x: number): void {
    this.webrtc.sendInput({
      type: 'tilt', // keeping same type so game can process as movement
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
