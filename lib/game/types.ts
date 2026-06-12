export type Team = "red" | "blue";
export type CardType = "red" | "blue" | "neutral" | "assassin";
export type GamePhase = "clue" | "guess";

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
}
