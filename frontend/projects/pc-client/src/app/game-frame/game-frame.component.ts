import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { WebRTCService, InputEvent, Player } from 'shared';

@Component({
  selector: 'app-game-frame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-frame.component.html',
  styleUrl: './game-frame.component.scss'
})
export class GameFrameComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() gameId: string = 'pong';
  @Input() players: Player[] = [];

  @ViewChild('gameFrame') gameFrame!: ElementRef<HTMLIFrameElement>;

  private destroy$ = new Subject<void>();

  constructor(
    private webrtc: WebRTCService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Listen for input from WebRTC and forward to game
    this.webrtc.input$
      .pipe(takeUntil(this.destroy$))
      .subscribe((input) => {
        this.sendToGame('input', input);
      });
  }

  ngAfterViewInit(): void {
    // Wait for iframe to load, then initialize game
    this.gameFrame.nativeElement.onload = () => {
      this.initializeGame();
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeGame(): void {
    // Send initial game state
    this.sendToGame('init', {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        playerIndex: p.playerIndex
      }))
    });
  }

  private sendToGame(type: string, data: unknown): void {
    const iframe = this.gameFrame?.nativeElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type, data }, '*');
    }
  }

  get gameUrl(): SafeResourceUrl {
    // For PoC, serve game from assets
    const url = `/assets/games/${this.gameId}/index.html`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
