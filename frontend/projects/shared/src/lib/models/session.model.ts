export interface Session {
  id: string;
  code: string;
  gameId: string;
  state: SessionState;
  playerCount: number;
}

export enum SessionState {
  Lobby = 0,
  Playing = 1,
  Ended = 2
}

export interface Player {
  id: string;
  name: string;
  playerIndex: number;
  connectionId: string;
}
