export interface SignalingMessage {
  type: string;
  [key: string]: unknown;
}

export interface ConnectedMessage extends SignalingMessage {
  type: 'connected';
  connectionId: string;
}

export interface SessionCreatedMessage extends SignalingMessage {
  type: 'session-created';
  sessionId: string;
  code: string;
}

export interface SessionJoinedMessage extends SignalingMessage {
  type: 'session-joined';
  sessionId: string;
  playerId: string;
  playerIndex: number;
}

export interface PlayerJoinedMessage extends SignalingMessage {
  type: 'player-joined';
  playerId: string;
  playerName: string;
  playerIndex: number;
  connectionId: string;
}

export interface PlayerLeftMessage extends SignalingMessage {
  type: 'player-left';
  playerId: string;
  playerIndex: number;
}

export interface OfferMessage extends SignalingMessage {
  type: 'offer';
  sdp: string;
  fromId: string;
}

export interface AnswerMessage extends SignalingMessage {
  type: 'answer';
  sdp: string;
  fromId: string;
}

export interface IceCandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  fromId: string;
}

export interface ErrorMessage extends SignalingMessage {
  type: 'error';
  message: string;
}
