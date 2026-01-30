import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SignalingService, SessionJoinedMessage, ErrorMessage } from 'shared';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent {
  code = signal<string>('');
  playerName = signal<string>('');
  error = signal<string>('');
  joining = signal<boolean>(false);

  constructor(
    private signaling: SignalingService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Check for code in route params
    const routeCode = this.route.snapshot.paramMap.get('code');
    if (routeCode) {
      this.code.set(routeCode);
    }
  }

  async join(): Promise<void> {
    const code = this.code().trim().toUpperCase();
    const name = this.playerName().trim() || 'Player';

    if (code.length !== 4) {
      this.error.set('Please enter a 4-character code');
      return;
    }

    this.joining.set(true);
    this.error.set('');

    try {
      await this.signaling.connect();

      // Listen for join response
      this.signaling.onMessage<SessionJoinedMessage>('session-joined')
        .subscribe((msg) => {
          // Navigate to controller with session info
          this.router.navigate(['/controller'], {
            state: {
              sessionId: msg.sessionId,
              playerId: msg.playerId,
              playerIndex: msg.playerIndex
            }
          });
        });

      this.signaling.onMessage<ErrorMessage>('error')
        .subscribe((msg) => {
          this.error.set(msg.message);
          this.joining.set(false);
        });

      this.signaling.joinSession(code, name);
    } catch (e) {
      this.error.set('Failed to connect to server');
      this.joining.set(false);
    }
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.code.set(input.value.toUpperCase().slice(0, 4));
  }
}
