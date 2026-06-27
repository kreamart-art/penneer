// Pen Neer — single WebSocket client + reducer mirroring server state (§6, §7).
// The server is authoritative; this file only mirrors snapshots and fires UI
// signals (spin animation, round-ended flush) off the typed event stream.

import { useEffect, useReducer, useRef } from "react";

// ---- types mirroring the server's public() shapes --------------------------

export interface Player {
  id: string;
  name: string;
  color: string;
  is_host: boolean;
  connected: boolean;
  is_spectator: boolean;
  is_bot: boolean;
}

export interface Settings {
  round_time: number; // 0 = no timer
  rounds: number;
  categories: string[];
  hard_letters: boolean;
  max_players: number;
  allow_spectators: boolean;
}

export interface AnswerView {
  text: string;
  valid: boolean;
  in_list: boolean; // false -> orange "?" (counts, but not found in the category list)
}

export interface RoundView {
  letter: string;
  answers: Record<string, Record<string, AnswerView>>;
  points: Record<string, Record<string, number>>;
}

export type Phase = "lobby" | "reveal" | "fill" | "results" | "final";

export interface RoomState {
  code: string;
  host_id: string;
  players: Player[];
  settings: Settings;
  phase: Phase;
  round_no: number;
  used_letters: string[];
  active_player_id: string | null;
  timer: { ends_at: number | null; duration: number | null };
  scores: Record<string, number>;
  ready_ids: string[];
  round: RoundView | null;
}

export interface ClientState {
  room: RoomState | null;
  playerId: string | null;
  status: "connecting" | "open" | "closed";
  spinning: boolean;
  error: string | null;
  // Increments each time the server ends the fill phase, so the Fill screen
  // can flush its final answers exactly once.
  roundEndedToken: number;
}

type Action =
  | { type: "status"; status: ClientState["status"] }
  | { type: "reset" }
  | { type: "clearError" }
  | { type: "msg"; msg: ServerMessage };

// ---- server -> client messages ---------------------------------------------

type ServerMessage =
  | { type: "joined"; code: string; player_id: string }
  | { type: "room_state"; room: RoomState }
  | { type: "player_joined"; player: Player }
  | { type: "player_left"; player_id: string }
  | { type: "game_started"; round_no: number; active_player_id: string }
  | { type: "turn_started"; round_no: number; active_player_id: string }
  | { type: "spin_started" }
  | { type: "letter_locked"; letter: string }
  | { type: "timer_started"; duration: number; ends_at: number }
  | { type: "round_ended" }
  | { type: "ready_updated"; ready_ids: string[] }
  | { type: "results"; round_no: number; answers: RoundView["answers"]; points: RoundView["points"]; scores: Record<string, number> }
  | { type: "results_updated"; points: RoundView["points"]; scores: Record<string, number>; answers: RoundView["answers"] }
  | { type: "game_over"; scores: Record<string, number>; winner_id: string | null }
  | { type: "error"; message: string };

const SESSION_KEY = "penneer.session";

function loadSession(): { code: string; player_id: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(code: string, player_id: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, player_id }));
  } catch {
    /* ignore */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const initialState: ClientState = {
  room: null,
  playerId: null,
  status: "connecting",
  spinning: false,
  error: null,
  roundEndedToken: 0,
};

function reducer(state: ClientState, action: Action): ClientState {
  if (action.type === "status") {
    return { ...state, status: action.status };
  }
  if (action.type === "reset") {
    return { ...initialState, status: state.status };
  }
  if (action.type === "clearError") {
    return { ...state, error: null };
  }
  const msg = action.msg;
  switch (msg.type) {
    case "joined":
      saveSession(msg.code, msg.player_id);
      return { ...state, playerId: msg.player_id, error: null };
    case "room_state":
      return { ...state, room: msg.room, error: null };
    case "player_joined":
    case "player_left":
      // room_state always follows these; nothing extra to do.
      return state;
    case "game_started":
    case "turn_started":
      // The reel resets at the start of every turn.
      return { ...state, spinning: false };
    case "spin_started":
      return { ...state, spinning: true };
    case "letter_locked": {
      // Snap the reel immediately. room_state follows after the lock beat, but
      // patch the letter now so the Reel can show it during that beat.
      if (!state.room) return { ...state, spinning: false };
      const round: RoundView = state.room.round
        ? { ...state.room.round, letter: msg.letter }
        : { letter: msg.letter, answers: {}, points: {} };
      return { ...state, spinning: false, room: { ...state.room, round } };
    }
    case "timer_started":
      return state; // room_state carries the timer
    case "round_ended":
      return { ...state, roundEndedToken: state.roundEndedToken + 1 };
    case "ready_updated":
      // room_state carries the authoritative ready list; nothing extra.
      return state;
    case "results":
    case "results_updated":
    case "game_over":
      return state; // room_state carries the authoritative snapshot
    case "error":
      return { ...state, error: msg.message };
    default:
      return state;
  }
}

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export interface GameApi {
  state: ClientState;
  me: Player | null;
  isHost: boolean;
  isActive: boolean;
  isSpectator: boolean;
  send: (msg: Record<string, unknown>) => void;
  clearError: () => void;
  // intents
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  startGame: () => void;
  spinStart: () => void;
  spinStop: () => void;
  updateAnswers: (answers: Record<string, string>) => void;
  setReady: (ready: boolean) => void;
  stopRound: () => void;
  challenge: (player_id: string, cat: string, valid?: boolean) => void;
  nextRound: () => void;
  readyNext: () => void;
  playAgain: () => void;
  addBot: () => void;
  removeBot: (bot_id: string) => void;
  leaveRoom: () => void;
}

export function useGame(): GameApi {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const lastSendRef = useRef<number>(0);
  const pendingAnswersRef = useRef<Record<string, string> | null>(null);

  // Persisted across renders; used to throttle update_answers.
  const send = useRef((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    const data = JSON.stringify(msg);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      queueRef.current.push(data);
    }
  }).current;

  useEffect(() => {
    let alive = true;
    let reconnectTimer: number | undefined;

    function connect() {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      dispatch({ type: "status", status: "connecting" });

      ws.onopen = () => {
        if (!alive) return;
        dispatch({ type: "status", status: "open" });
        // Flush any queued messages.
        for (const data of queueRef.current) ws.send(data);
        queueRef.current = [];
        // Attempt session reconnect.
        const sess = loadSession();
        if (sess) {
          ws.send(JSON.stringify({ type: "reconnect", ...sess }));
        }
      };

      ws.onmessage = (ev) => {
        if (!alive) return;
        try {
          const msg = JSON.parse(ev.data) as ServerMessage;
          dispatch({ type: "msg", msg });
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        dispatch({ type: "status", status: "closed" });
        // Auto-reconnect with a small delay.
        reconnectTimer = window.setTimeout(connect, 1200);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      alive = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const room = state.room;
  const me = room && state.playerId ? room.players.find((p) => p.id === state.playerId) ?? null : null;
  const isHost = !!(room && me && room.host_id === me.id);
  const isActive = !!(room && me && room.active_player_id === me.id);
  const isSpectator = !!(me && me.is_spectator);

  const api: GameApi = {
    state,
    me,
    isHost,
    isActive,
    isSpectator,
    send,
    clearError: () => dispatch({ type: "clearError" }),
    createRoom: (name) => send({ type: "create_room", name }),
    joinRoom: (code, name) => send({ type: "join_room", code, name }),
    updateSettings: (s) => send({ type: "update_settings", ...s }),
    startGame: () => send({ type: "start_game" }),
    spinStart: () => send({ type: "spin_start" }),
    spinStop: () => send({ type: "spin_stop" }),
    updateAnswers: (answers) => {
      // Throttle to ~1/300ms; always remember the latest for a final flush.
      pendingAnswersRef.current = answers;
      const now = Date.now();
      if (now - lastSendRef.current >= 300) {
        lastSendRef.current = now;
        send({ type: "update_answers", answers });
      }
    },
    setReady: (ready) => send({ type: "set_ready", ready }),
    stopRound: () => {
      // Flush latest before stopping.
      if (pendingAnswersRef.current) send({ type: "update_answers", answers: pendingAnswersRef.current });
      send({ type: "stop_round" });
    },
    challenge: (player_id, cat, valid) =>
      send({ type: "challenge_answer", player_id, cat, ...(valid === undefined ? {} : { valid }) }),
    nextRound: () => send({ type: "next_round" }),
    readyNext: () => send({ type: "ready_next" }),
    playAgain: () => send({ type: "play_again" }),
    addBot: () => send({ type: "add_bot" }),
    removeBot: (bot_id) => send({ type: "remove_bot", bot_id }),
    leaveRoom: () => {
      send({ type: "leave_room" });
      clearSession();
      dispatch({ type: "reset" });
    },
  };

  // Expose the pending-answers flush via the api object for the Fill screen.
  (api as GameApi & { flushAnswers: () => void }).flushAnswers = () => {
    if (pendingAnswersRef.current) send({ type: "update_answers", answers: pendingAnswersRef.current });
  };

  return api;
}
