import type { GameState, Role } from "./types";

/**
 * Returns a copy of the game state safe to send to a player of the given role.
 * Operatives (and unassigned players) have unrevealed card types replaced with
 * "hidden" so they cannot inspect the WebSocket payload to cheat.
 */
export function filterStateForPlayer(
  state: GameState,
  role: Role | null
): GameState {
  if (role === "spymaster") return state;

  return {
    ...state,
    board: state.board.map((card) =>
      card.revealed ? card : { ...card, type: "hidden" }
    ),
  };
}
