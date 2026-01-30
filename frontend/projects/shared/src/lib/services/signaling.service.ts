import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { SignalingMessage } from '../models/signaling.model';

@Injectable({
  providedIn: 'root'
})
export class SignalingService implements OnDestroy {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<SignalingMessage>();
  private connectionIdSubject = new BehaviorSubject<string | null>(null);
  private connectedSubject = new BehaviorSubject<boolean>(false);

  readonly messages$ = this.messageSubject.asObservable();
  readonly connectionId$ = this.connectionIdSubject.asObservable();
  readonly connected$ = this.connectedSubject.asObservable();

  connect(url?: string): Promise<string> {
    // Default to same host as the page, using WebSocket protocol
    if (!url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      url = `${protocol}//${host}:5000/ws`;
    }
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const currentId = this.connectionIdSubject.value;
        if (currentId) {
          resolve(currentId);
          return;
        }
      }

      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.connectedSubject.next(true);
      };

      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as SignalingMessage;

        if (message.type === 'connected') {
          const connectionId = (message as unknown as { connectionId: string }).connectionId;
          this.connectionIdSubject.next(connectionId);
          resolve(connectionId);
        }

        this.messageSubject.next(message);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.socket.onclose = () => {
        this.connectedSubject.next(false);
        this.connectionIdSubject.next(null);
      };
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(message: SignalingMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  onMessage<T extends SignalingMessage>(type: string): Observable<T> {
    return this.messages$.pipe(
      filter(msg => msg.type === type),
      map(msg => msg as T)
    );
  }

  createSession(gameId: string = 'pong'): void {
    this.send({ type: 'create-session', gameId });
  }

  joinSession(code: string, playerName: string): void {
    this.send({ type: 'join-session', code, playerName });
  }

  sendOffer(targetId: string, sdp: string): void {
    this.send({ type: 'offer', targetId, sdp });
  }

  sendAnswer(targetId: string, sdp: string): void {
    this.send({ type: 'answer', targetId, sdp });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    this.send({
      type: 'ice-candidate',
      targetId,
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    });
  }

  startGame(): void {
    this.send({ type: 'start-game' });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
