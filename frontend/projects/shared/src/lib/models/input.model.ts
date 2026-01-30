export interface InputEvent {
  type: 'button' | 'axis' | 'tilt';
  playerId: string;
  playerIndex: number;
  timestamp: number;
  data: ButtonInput | AxisInput | TiltInput;
}

export interface ButtonInput {
  button: string;
  pressed: boolean;
}

export interface AxisInput {
  axis: string;
  value: number; // -1 to 1
}

export interface TiltInput {
  x: number; // -1 to 1 (left/right tilt)
  y: number; // -1 to 1 (forward/back tilt)
}
