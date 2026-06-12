import type { Card, CardType, GameState, Team } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function opponent(team: Team): Team {
  return team === "red" ? "blue" : "red";
}

function allRevealed(board: Card[], team: Team): boolean {
  return board.filter((c) => c.type === team).every((c) => c.revealed);
}

function endTurnState(state: GameState): GameState {
  return {
    ...state,
    currentTurn: opponent(state.currentTurn),
    phase: "clue",
    currentClue: null,
    guessesLeft: 0,
  };
}

export function initializeGame(words: string[]): GameState {
  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";

  const types: CardType[] = [
    ...Array<CardType>(9).fill(startingTeam),
    ...Array<CardType>(8).fill(opponent(startingTeam)),
    ...Array<CardType>(7).fill("neutral"),
    "assassin",
  ];

  const selectedWords = shuffle(words).slice(0, 25);
  const shuffledTypes = shuffle(types);

  const board: Card[] = selectedWords.map((word, i) => ({
    word,
    type: shuffledTypes[i],
    revealed: false,
  }));

  return {
    board,
    currentTurn: startingTeam,
    phase: "clue",
    currentClue: null,
    guessesLeft: 0,
    winner: null,
  };
}

export function submitClue(
  state: GameState,
  clueWord: string,
  count: number
): GameState {
  if (state.phase !== "clue" || state.winner) return state;
  return {
    ...state,
    phase: "guess",
    currentClue: { word: clueWord, count },
    guessesLeft: count + 1,
  };
}

export function guessCard(state: GameState, cardIndex: number): GameState {
  if (state.phase !== "guess" || state.winner) return state;

  const card = state.board[cardIndex];
  if (card.revealed) return state;

  const newBoard = state.board.map((c, i) =>
    i === cardIndex ? { ...c, revealed: true } : c
  );

  // Assassin: guessing team loses immediately
  if (card.type === "assassin") {
    return { ...state, board: newBoard, winner: opponent(state.currentTurn) };
  }

  // Opponent's card or neutral: end the turn
  if (card.type !== state.currentTurn) {
    // Check if revealing this card completes the opponent's set
    if (card.type !== "neutral" && allRevealed(newBoard, card.type as Team)) {
      return { ...state, board: newBoard, winner: card.type as Team };
    }
    return endTurnState({ ...state, board: newBoard });
  }

  // Own card: check win, then decrement guesses
  if (allRevealed(newBoard, state.currentTurn)) {
    return { ...state, board: newBoard, winner: state.currentTurn };
  }

  const guessesLeft = state.guessesLeft - 1;
  if (guessesLeft === 0) {
    return endTurnState({ ...state, board: newBoard });
  }

  return { ...state, board: newBoard, guessesLeft };
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "guess" || state.winner) return state;
  return endTurnState(state);
}
