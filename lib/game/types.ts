export type Team = "red" | "blue";
// 'hidden' is used only in client-side filtered views — never in master state
export type CardType = "red" | "blue" | "neutral" | "assassin" | "hidden";
export type GamePhase = "clue" | "guess";
export type Role = "spymaster" | "operative";

export interface Card {
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface Clue {
  word: string;
  count: number;
}

export interface GameState {
  board: Card[];
  currentTurn: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  guessesLeft: number;
  winner: Team | null;
  // Included in server broadcasts so operatives can see the score
  // even though they can't see individual card types
  redRemaining?: number;
  blueRemaining?: number;
}

export interface PlayerInfo {
  playerId: string;
  socketId: string;
  name: string;
  team: Team | null;
  role: Role | null;
}
