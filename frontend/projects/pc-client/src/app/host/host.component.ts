import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import * as QRCode from 'qrcode';
import {
  SignalingService,
  WebRTCService,
  Player,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  InputEvent
} from 'shared';
import { GameFrameComponent } from '../game-frame/game-frame.component';

interface ConnectedPlayer extends Player {
  connected: boolean;
}

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CommonModule, GameFrameComponent],
  templateUrl: './host.component.html',
  styleUrl: './host.component.scss'
})
export class HostComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sessionCode = signal<string>('');
  qrCodeUrl = signal<string>('');
  players = signal<ConnectedPlayer[]>([]);
  gameStarted = signal<boolean>(false);
  connectionId = signal<string>('');

  canStartGame = computed(() => this.players().length > 0 && !this.gameStarted());

  constructor(
    private signaling: SignalingService,
    private webrtc: WebRTCService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.initSession();
    this.setupSignalingHandlers();
    this.setupWebRTCHandlers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signaling.disconnect();
  }

  private async initSession(): Promise<void> {
    const connId = await this.signaling.connect();
    this.connectionId.set(connId);

    this.signaling.onMessage<{ type: 'session-created'; sessionId: string; code: string }>('session-created')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        this.sessionCode.set(msg.code);
        await this.generateQRCode(msg.code);
      });

    this.signaling.createSession('pong');
  }

  private setupSignalingHandlers(): void {
    // Player joined - initiate WebRTC connection
    this.signaling.onMessage<PlayerJoinedMessage>('player-joined')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        const player: ConnectedPlayer = {
          id: msg.playerId,
          name: msg.playerName,
          playerIndex: msg.playerIndex,
          connectionId: msg.connectionId,
          connected: false
        };
        this.players.update(p => [...p, player]);

        // Small delay to let phone navigate to controller and set up handlers
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create WebRTC peer and send offer
        const offer = await this.webrtc.createPeerForPlayer(
          msg.connectionId,
          msg.playerId,
          msg.playerIndex,
          (candidate) => this.signaling.sendIceCandidate(msg.connectionId, candidate)
        );

        this.signaling.sendOffer(msg.connectionId, offer.sdp!);
      });

    // Player left
    this.signaling.onMessage<PlayerLeftMessage>('player-left')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const player = this.players().find(p => p.id === msg.playerId);
        if (player) {
          this.webrtc.removePeer(player.connectionId);
        }
        this.players.update(p => p.filter(pl => pl.id !== msg.playerId));
      });

    // Handle WebRTC answer from phone
    this.signaling.onMessage<AnswerMessage>('answer')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        await this.webrtc.handleAnswer(msg.fromId, msg.sdp);
      });

    // Handle ICE candidates from phone
    this.signaling.onMessage<IceCandidateMessage>('ice-candidate')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg) => {
        await this.webrtc.handleIceCandidate(msg.fromId, msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
      });
  }

  private setupWebRTCHandlers(): void {
    // Track connection states
    this.webrtc.connectionStates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((states) => {
        this.players.update(players =>
          players.map(p => ({
            ...p,
            connected: states.get(p.connectionId) === 'connected'
          }))
        );
      });
  }

  private async generateQRCode(code: string): Promise<void> {
    // Generate URL for phone to join
    // Replace port with phone client port (4201)
    const origin = window.location.origin.replace(/:4200\b/, ':4201');
    const joinUrl = `${origin}/join/${code}`;
    const qrUrl = await QRCode.toDataURL(joinUrl, { width: 256 });
    this.qrCodeUrl.set(qrUrl);
  }

  startGame(): void {
    this.signaling.startGame();
    this.gameStarted.set(true);
  }

  onInputFromGame(input: InputEvent): void {
    // Game iframe might send back events (not used in Pong, but available)
    console.log('Input from game:', input);
  }
}
