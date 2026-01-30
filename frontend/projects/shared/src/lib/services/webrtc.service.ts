import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { InputEvent } from '../models/input.model';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export interface PeerConnection {
  connectionId: string;
  playerId?: string;
  playerIndex?: number;
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService implements OnDestroy {
  private peers = new Map<string, PeerConnection>();
  private inputSubject = new Subject<InputEvent>();
  private connectionStateSubject = new BehaviorSubject<Map<string, RTCPeerConnectionState>>(new Map());

  readonly input$ = this.inputSubject.asObservable();
  readonly connectionStates$ = this.connectionStateSubject.asObservable();

  // For PC (host) - create peer connection when player joins
  async createPeerForPlayer(
    connectionId: string,
    playerId: string,
    playerIndex: number,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateConnectionState(connectionId, pc.connectionState);
    };

    // Create data channel for receiving input
    const dataChannel = pc.createDataChannel('input', {
      ordered: false,
      maxRetransmits: 0
    });

    dataChannel.onmessage = (event) => {
      this.handleInputMessage(event.data, playerId, playerIndex);
    };

    dataChannel.onopen = () => {
      console.log(`Data channel open for player ${playerIndex}`);
    };

    const peer: PeerConnection = {
      connectionId,
      playerId,
      playerIndex,
      pc,
      dataChannel
    };

    this.peers.set(connectionId, peer);

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return offer;
  }

  // For Phone (controller) - create peer connection to join host
  async createPeerForHost(
    hostConnectionId: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateConnectionState(hostConnectionId, pc.connectionState);
    };

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const peer = this.peers.get(hostConnectionId);
      if (peer) {
        peer.dataChannel = event.channel;
        event.channel.onopen = () => {
          console.log('Data channel open to host');
        };
      }
    };

    const peer: PeerConnection = {
      connectionId: hostConnectionId,
      pc
    };

    this.peers.set(hostConnectionId, peer);
  }

  async handleOffer(fromId: string, sdp: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peers.get(fromId);
    if (!peer) {
      throw new Error(`No peer found for ${fromId}`);
    }

    await peer.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(fromId: string, sdp: string): Promise<void> {
    const peer = this.peers.get(fromId);
    if (!peer) {
      throw new Error(`No peer found for ${fromId}`);
    }

    await peer.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  async handleIceCandidate(fromId: string, candidate: string, sdpMid: string | null, sdpMLineIndex: number | null): Promise<void> {
    const peer = this.peers.get(fromId);
    if (!peer) return;

    await peer.pc.addIceCandidate({
      candidate,
      sdpMid,
      sdpMLineIndex
    });
  }

  // Send input from phone controller
  sendInput(input: Omit<InputEvent, 'timestamp'>): void {
    // Find the host peer (should only be one for phone)
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === 'open') {
        const event: InputEvent = {
          ...input,
          timestamp: Date.now()
        };
        peer.dataChannel.send(JSON.stringify(event));
      }
    }
  }

  removePeer(connectionId: string): void {
    const peer = this.peers.get(connectionId);
    if (peer) {
      peer.dataChannel?.close();
      peer.pc.close();
      this.peers.delete(connectionId);
      this.updateConnectionState(connectionId, 'closed');
    }
  }

  private handleInputMessage(data: string, playerId: string, playerIndex: number): void {
    try {
      const input = JSON.parse(data) as InputEvent;
      // Override with server-known player info for security
      input.playerId = playerId;
      input.playerIndex = playerIndex;
      this.inputSubject.next(input);
    } catch (e) {
      console.error('Failed to parse input:', e);
    }
  }

  private updateConnectionState(connectionId: string, state: RTCPeerConnectionState): void {
    const states = new Map(this.connectionStateSubject.value);
    if (state === 'closed') {
      states.delete(connectionId);
    } else {
      states.set(connectionId, state);
    }
    this.connectionStateSubject.next(states);
  }

  ngOnDestroy(): void {
    for (const peer of this.peers.values()) {
      peer.dataChannel?.close();
      peer.pc.close();
    }
    this.peers.clear();
  }
}
