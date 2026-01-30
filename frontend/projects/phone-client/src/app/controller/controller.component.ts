import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import {
  SignalingService,
  WebRTCService,
  OfferMessage,
  IceCandidateMessage,
  TiltInput
} from 'shared';

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
  private baseTilt = { beta: 0, gamma: 0 };

  connected = signal<boolean>(false);
  gameStarted = signal<boolean>(false);
  tiltCalibrated = signal<boolean>(false);
  currentTilt = signal<TiltInput>({ x: 0, y: 0 });

  constructor(
    private signaling: SignalingService,
    private webrtc: WebRTCService,
    private router: Router
  ) {
    // Get state from navigation
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
    this.setupTiltSending();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signaling.disconnect();
  }

  private setupSignalingHandlers(): void {
    // Handle offer from host
    this.signaling.onMessage<OfferMessage>('offer')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        this.hostConnectionId = msg.fromId;

        // Create peer connection
        await this.webrtc.createPeerForHost(
          msg.fromId,
          (candidate) => this.signaling.sendIceCandidate(msg.fromId, candidate)
        );

        // Handle offer and send answer
        const answer = await this.webrtc.handleOffer(msg.fromId, msg.sdp);
        this.signaling.sendAnswer(msg.fromId, answer.sdp!);
      });

    // Handle ICE candidates from host
    this.signaling.onMessage<IceCandidateMessage>('ice-candidate')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        await this.webrtc.handleIceCandidate(msg.fromId, msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
      });

    // Track connection state
    this.webrtc.connectionStates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((states) => {
        const hostState = states.get(this.hostConnectionId);
        this.connected.set(hostState === 'connected');
      });

    // Game started
    this.signaling.onMessage<{ type: 'game-started' }>('game-started')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.gameStarted.set(true);
        this.tiltCalibrated.set(true);
        this.enableTilt();
      });
  }

  private async requestTiltPermission(): Promise<void> {
    // Request permission for DeviceOrientation on iOS
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          this.enableTilt();
        } else {
          // Permission denied, but still allow calibration to proceed
          this.tiltEnabled = true;
        }
      } catch (e) {
        console.error('Failed to get orientation permission:', e);
        // Still allow calibration to proceed
        this.tiltEnabled = true;
      }
    } else {
      // Non-iOS - just enable
      this.enableTilt();
    }
  }

  private enableTilt(): void {
    this.tiltEnabled = true;

    window.addEventListener('deviceorientation', (event) => {
      // beta: front-back tilt (-180 to 180)
      // gamma: left-right tilt (-90 to 90)
      const gamma = event.gamma ?? 0;

      // Use gamma directly for left/right control (phone held upright)
      // Normalize to -1 to 1 range (using ±45 degrees as full range)
      const x = Math.max(-1, Math.min(1, gamma / 45));

      this.currentTilt.set({ x, y: 0 });
    });
  }

  calibrateTilt(): void {
    // Listen for next orientation event to set base
    let calibrated = false;
    const handler = (event: DeviceOrientationEvent) => {
      if (calibrated) return;
      calibrated = true;
      this.baseTilt = {
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0
      };
      this.tiltCalibrated.set(true);
      window.removeEventListener('deviceorientation', handler);
    };

    if (this.tiltEnabled) {
      window.addEventListener('deviceorientation', handler);
      // Timeout - if no orientation event within 1 second, proceed without tilt
      setTimeout(() => {
        if (!calibrated) {
          calibrated = true;
          window.removeEventListener('deviceorientation', handler);
          this.tiltCalibrated.set(true);
        }
      }, 1000);
    } else {
      // If tilt not enabled, just mark as calibrated (will use buttons only)
      this.tiltCalibrated.set(true);
    }
  }

  private setupTiltSending(): void {
    // Send tilt data at 60fps
    interval(16)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.connected() && this.tiltCalibrated()) {
          this.webrtc.sendInput({
            type: 'tilt',
            playerId: this.playerId,
            playerIndex: this.playerIndex,
            data: this.currentTilt()
          });
        }
      });
  }

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

  private vibrate(duration: number): void {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  // Prevent context menu on long press
  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event): void {
    event.preventDefault();
  }
}
