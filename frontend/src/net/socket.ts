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
  user_id: string | null;
  has_avatar: boolean;
  avatar_ver: number;
  level: number; // 0 for guests
  rank: string | null; // rank key for the avatar ring + title
  title?: string | null; // chosen cosmetic title key (shown instead of rank)
}

// ---- accounts + social ------------------------------------------------------

export interface AccountStats {
  games: number;
  wins: number;
  points: number;
  best: number;
  uniques: number;
  dubbels: number;
  streak: number;
}

export interface Badge {
  badge: string;
  earned_at: number;
}

export interface LevelInfo {
  level: number;
  xp: number;
  level_start: number;
  next_level: number;
  rank: string; // rank key, localized client-side (rank_<key>)
}

export interface DmMessage {
  id: string;
  from_user: string;
  to_user: string;
  text: string;
  created_at: number;
  voice_id?: string | null;
  voice_dur?: number;
}

export interface DmThreadSummary {
  partner: string;
  last_text: string;
  last_voice?: boolean;
  last_from_me: boolean;
  last_at: number;
  unread: number;
  user: PublicUser;
}

export interface Account {
  id: string;
  name: string;
  color: string;
  has_avatar: boolean;
  avatar_ver: number;
  email: string | null;
  avatar_preset: string | null; // chosen preset id (null = custom photo)
  ai_unlocked: boolean; // bought the AI referee for this account
  premium_avatars: boolean; // bought the premium avatar pack (av19..av36)
  buzzer_skins: boolean; // bought the buzzer-skin pack (bz01..bz05)
  buzzer_skin: string | null; // chosen skin id, null = default red buzzer
  stats: AccountStats;
  level: LevelInfo;
  badges: Badge[];
  title: string | null; // chosen title key (null = show rank)
  titles: { key: string; unlocked: boolean }[]; // catalog + unlock state
  club: ClubSummary | null; // the user's club (one per user), or null
  lenient_spelling: boolean; // forgives near-miss spellings in Oefenen + Dagronde
  inbox_count: number;
  dm_unread: number;
}

export interface PublicUser {
  id: string;
  name: string;
  color: string;
  has_avatar: boolean;
  avatar_ver: number;
  online: boolean;
}

export interface ClubSummary {
  id: string;
  name: string;
  code: string;
  member_count: number;
  is_owner: boolean;
}

export interface ClubMember extends PublicUser {
  points: number;
  games: number;
  wins: number;
  is_owner: boolean;
}

export interface ClubBoard {
  club: ClubSummary | null;
  period: "month" | "all";
  members: ClubMember[];
}

export interface Friend extends PublicUser {
  status: "pending" | "accepted";
  requested_by: string;
}

export interface InboxItem {
  type: "invite" | "challenge" | "friend_request";
  id?: string; // invite id
  room_code?: string;
  from_id: string;
  from_name: string;
  from_color: string;
  has_avatar: boolean;
  avatar_ver: number;
  created_at: number;
}

export interface LeaderboardRow extends PublicUser {
  points: number;
  games: number;
  wins: number;
}

export interface PublicProfile extends PublicUser {
  stats: AccountStats;
  level: LevelInfo;
  badges: Badge[];
  is_friend: boolean;
  // Viewer vs this profile: shared games + wins on both sides (null if none).
  h2h: { games: number; my_wins: number; their_wins: number } | null;
}

export interface HistoryPlayer {
  user_id: string;
  score: number;
  name: string;
  color: string;
  avatar_ver: number;
  has_avatar: boolean;
}

export interface HistoryGame {
  finished_at: number;
  rounds: number;
  score: number;
  is_winner: boolean;
  place: number;
  player_count: number;
  players: HistoryPlayer[];
}

export interface Settings {
  round_time: number; // 0 = no timer
  rounds: number;
  categories: string[];
  hard_letters: boolean;
  max_players: number;
  allow_spectators: boolean;
  lenient_spelling: boolean; // soepele spelling (dyslexie): near-miss spellings count
}

export interface AnswerView {
  text: string;
  valid: boolean;
  in_list: boolean; // false -> orange "?" (counts, but not found in the category list)
  canon: string; // duplicate-detection key; differs from the own word when paired
}

export interface RoundView {
  letter: string;
  answers: Record<string, Record<string, AnswerView>>;
  points: Record<string, Record<string, number>>;
}

export type Phase = "lobby" | "rules" | "reveal" | "fill" | "results" | "final";

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
  sat_out: string[]; // left mid-round: sit out the current round, back next round
  ai_referee: boolean; // AI scheidsrechter active on the "?" answers
  round: RoundView | null;
}

export interface AdminAi {
  available: boolean;
  provider: string;
  model: string;
  enabled: boolean;
}

export interface RecoveryCode {
  code: string;
  used: boolean;
}

export interface AiCodeInfo {
  total: number;
  redeemed: number;
  open: number;
  new: string[]; // freshly generated codes, shown once
}

export interface ShopResult {
  ok: boolean;
  reason: string; // ok | already | used | invalid | auth
}

export interface ChatMessage {
  id: number;
  player_id: string;
  name: string;
  color: string;
  text: string;
  ts: number;
  voice_id?: string;
  voice_dur?: number;
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
  // Admin (owner) state.
  isAdmin: boolean;
  adminAi: AdminAi | null;
  recoveryCodes: RecoveryCode[];
  aiCodes: AiCodeInfo | null; // AI-referee unlock-code stats + freshly generated codes
  avatarCodes: AiCodeInfo | null; // premium-avatar unlock-code stats
  buzzerCodes: AiCodeInfo | null; // buzzer-skin unlock-code stats
  // Shop: result of the last code redeem (null until one happens).
  shopResult: ShopResult | null;
  // In-room chat (so players can ask what a word means without leaving).
  chat: ChatMessage[];
  chatSeen: number; // messages considered read (drives the unread badge)
  chatOpen: boolean; // panel open — kept here so it survives screen changes
  // Account + social state (all null/empty for guests).
  account: Account | null;
  friends: Friend[];
  blocked: PublicUser[];
  inbox: InboxItem[];
  searchResults: PublicUser[];
  leaderboard: { period: "all" | "week" | "month"; rows: LeaderboardRow[] } | null;
  club: ClubBoard | null; // the club board for the open club view
  viewedProfile: PublicProfile | null;
  history: HistoryGame[];
  // Direct messages (profile-to-profile): thread list + the open conversation.
  dmThreads: DmThreadSummary[];
  dmOpenWith: string | null; // partner user_id of the open thread
  dmMessages: DmMessage[];
  loginLinkSent: boolean;
  // Set when the server accepted an invite: the app auto-joins this room.
  joinRoomCode: string | null;
  // Newly earned badges to toast (drained by the UI).
  badgeToasts: { player_id: string | null; name: string; badge: string }[];
  chatTyping: Record<string, { name: string; ts: number }>; // who is typing now
  // Post-match ceremony data (accounts only), sent by the server at game over.
  matchSummary: MatchSummary | null;
}

export interface MatchSummary {
  won: boolean;
  xp_gained: number;
  level_before: LevelInfo;
  level_after: LevelInfo;
  badges: string[];
  missions_done: { key: string; reward: number }[];
}

type Action =
  | { type: "status"; status: ClientState["status"] }
  | { type: "reset" }
  | { type: "clearError" }
  | { type: "adminLogout" }
  | { type: "chatOpen"; open: boolean }
  | { type: "accountLogout" }
  | { type: "clearJoin" }
  | { type: "drainToasts" }
  | { type: "clearLoginSent" }
  | { type: "clearShopResult" }
  | { type: "dmClose" }
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
  | { type: "admin_ok"; is_admin: boolean; ai: AdminAi; recovery_codes: RecoveryCode[]; ai_codes: AiCodeInfo; avatar_codes?: AiCodeInfo; buzzer_codes?: AiCodeInfo }
  | { type: "shop_result"; ok: boolean; reason: string }
  | { type: "chat"; message: ChatMessage }
  | { type: "chat_history"; messages: ChatMessage[] }
  | { type: "account"; account: Account | null; token?: string; deleted?: boolean }
  | { type: "friends"; friends: Friend[] }
  | { type: "blocked"; users: PublicUser[] }
  | { type: "inbox"; items: InboxItem[] }
  | { type: "user_search"; users: PublicUser[] }
  | { type: "profile"; profile: PublicProfile }
  | { type: "history"; games: HistoryGame[] }
  | { type: "dm"; message: DmMessage }
  | { type: "dm_thread"; user_id: string; messages: DmMessage[] }
  | { type: "dm_threads"; threads: DmThreadSummary[] }
  | { type: "leaderboard"; period: "all" | "week" | "month"; rows: LeaderboardRow[] }
  | { type: "club"; club: ClubSummary | null; period: "month" | "all"; members: ClubMember[] }
  | { type: "presence"; user_id: string; online: boolean }
  | { type: "login_link_sent" }
  | { type: "invite_sent"; to_user: string }
  | { type: "invite_accepted"; room_code: string }
  | { type: "badge_earned"; player_id: string | null; name: string; badge: string }
  | { type: "match_summary"; won: boolean; xp_gained: number; level_before: LevelInfo; level_after: LevelInfo; badges: string[]; missions_done: { key: string; reward: number }[] }
  | { type: "chat_typing"; player_id: string; name: string; typing: boolean }
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

const ADMIN_KEY = "penneer.adminSecret";
function loadAdminSecret(): string | null {
  try {
    return localStorage.getItem(ADMIN_KEY);
  } catch {
    return null;
  }
}

const ACCOUNT_KEY = "penneer.accountToken";
function loadAccountToken(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}
export function saveAccountToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ACCOUNT_KEY, token);
    else localStorage.removeItem(ACCOUNT_KEY);
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
  isAdmin: false,
  adminAi: null,
  recoveryCodes: [],
  aiCodes: null,
  avatarCodes: null,
  buzzerCodes: null,
  shopResult: null,
  chat: [],
  chatSeen: 0,
  chatOpen: false,
  chatTyping: {},
  account: null,
  friends: [],
  blocked: [],
  inbox: [],
  searchResults: [],
  leaderboard: null,
  club: null,
  viewedProfile: null,
  history: [],
  dmThreads: [],
  dmOpenWith: null,
  dmMessages: [],
  loginLinkSent: false,
  joinRoomCode: null,
  badgeToasts: [],
  matchSummary: null,
};

function reducer(state: ClientState, action: Action): ClientState {
  if (action.type === "status") {
    return { ...state, status: action.status };
  }
  if (action.type === "reset") {
    // Leaving a room must not log the account out: carry the social state.
    return {
      ...initialState,
      status: state.status,
      account: state.account,
      friends: state.friends,
      blocked: state.blocked,
      inbox: state.inbox,
      isAdmin: state.isAdmin,
      adminAi: state.adminAi,
      recoveryCodes: state.recoveryCodes,
      aiCodes: state.aiCodes,
      avatarCodes: state.avatarCodes,
      buzzerCodes: state.buzzerCodes,
    };
  }
  if (action.type === "clearError") {
    return { ...state, error: null };
  }
  if (action.type === "adminLogout") {
    return { ...state, isAdmin: false, adminAi: null, recoveryCodes: [], aiCodes: null, avatarCodes: null, buzzerCodes: null };
  }
  if (action.type === "clearShopResult") {
    return { ...state, shopResult: null };
  }
  if (action.type === "dmClose") {
    return { ...state, dmOpenWith: null, dmMessages: [] };
  }
  if (action.type === "chatOpen") {
    // Opening marks everything read.
    return { ...state, chatOpen: action.open, chatSeen: action.open ? state.chat.length : state.chatSeen };
  }
  if (action.type === "accountLogout") {
    return { ...state, account: null, friends: [], inbox: [], searchResults: [], viewedProfile: null };
  }
  if (action.type === "clearJoin") {
    return { ...state, joinRoomCode: null };
  }
  if (action.type === "drainToasts") {
    return { ...state, badgeToasts: state.badgeToasts.slice(1) };
  }
  if (action.type === "clearLoginSent") {
    return { ...state, loginLinkSent: false };
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
      // New game: the reel resets and last game's ceremony data is stale.
      return { ...state, spinning: false, matchSummary: null };
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
    case "admin_ok":
      return { ...state, isAdmin: msg.is_admin, adminAi: msg.ai, recoveryCodes: msg.recovery_codes, aiCodes: msg.ai_codes, avatarCodes: msg.avatar_codes ?? state.avatarCodes, buzzerCodes: msg.buzzer_codes ?? state.buzzerCodes };
    case "shop_result":
      return { ...state, shopResult: { ok: msg.ok, reason: msg.reason } };
    case "account": {
      if (msg.token) saveAccountToken(msg.token);
      if (msg.deleted) saveAccountToken(null);
      return { ...state, account: msg.account };
    }
    case "friends":
      return { ...state, friends: msg.friends };
    case "blocked":
      return { ...state, blocked: msg.users };
    case "inbox": {
      const account = state.account ? { ...state.account, inbox_count: msg.items.length } : null;
      return { ...state, inbox: msg.items, account };
    }
    case "user_search":
      return { ...state, searchResults: msg.users };
    case "profile":
      return { ...state, viewedProfile: msg.profile };
    case "history":
      return { ...state, history: msg.games };
    case "dm": {
      const m = msg.message;
      const me = state.account?.id;
      const partner = m.from_user === me ? m.to_user : m.from_user;
      const openMatches = state.dmOpenWith === partner;
      const dmMessages = openMatches && !state.dmMessages.some((x) => x.id === m.id)
        ? [...state.dmMessages, m]
        : state.dmMessages;
      // Keep the thread list roughly current without a round-trip.
      const incoming = m.from_user !== me;
      let found = false;
      const dmThreads = state.dmThreads.map((t) => {
        if (t.partner !== partner) return t;
        found = true;
        return {
          ...t,
          last_text: m.text,
          last_voice: !!m.voice_id,
          last_from_me: !incoming,
          last_at: m.created_at,
          unread: incoming && !openMatches ? t.unread + 1 : openMatches ? 0 : t.unread,
        };
      });
      const account = state.account && incoming && !openMatches
        ? { ...state.account, dm_unread: state.account.dm_unread + 1 }
        : state.account;
      return { ...state, dmMessages, dmThreads: found ? dmThreads : state.dmThreads, account };
    }
    case "dm_thread":
      return { ...state, dmOpenWith: msg.user_id, dmMessages: msg.messages };
    case "dm_threads":
      return { ...state, dmThreads: msg.threads };
    case "leaderboard":
      return { ...state, leaderboard: { period: msg.period, rows: msg.rows } };
    case "club":
      return { ...state, club: { club: msg.club, period: msg.period, members: msg.members } };
    case "presence":
      return {
        ...state,
        friends: state.friends.map((f) => (f.id === msg.user_id ? { ...f, online: msg.online } : f)),
      };
    case "login_link_sent":
      return { ...state, loginLinkSent: true };
    case "invite_sent":
      return state;
    case "invite_accepted":
      return { ...state, joinRoomCode: msg.room_code };
    case "badge_earned":
      return { ...state, badgeToasts: [...state.badgeToasts, { player_id: msg.player_id, name: msg.name, badge: msg.badge }] };
    case "match_summary":
      return { ...state, matchSummary: { won: msg.won, xp_gained: msg.xp_gained, level_before: msg.level_before, level_after: msg.level_after, badges: msg.badges, missions_done: msg.missions_done } };
    case "chat_history":
      return { ...state, chat: msg.messages };
    case "chat": {
      // De-dupe by id (a reconnect can briefly overlap history + live).
      if (state.chat.some((m) => m.id === msg.message.id)) return state;
      const chat = [...state.chat, msg.message];
      // The sender clearly stopped typing now that a message landed.
      const chatTyping = { ...state.chatTyping };
      delete chatTyping[msg.message.player_id];
      // Keep the badge clear while the panel is open.
      return { ...state, chat, chatTyping, chatSeen: state.chatOpen ? chat.length : state.chatSeen };
    }
    case "chat_typing": {
      const chatTyping = { ...state.chatTyping };
      if (msg.typing) chatTyping[msg.player_id] = { name: msg.name, ts: Date.now() };
      else delete chatTyping[msg.player_id];
      return { ...state, chatTyping };
    }
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
  submitAnswers: (answers: Record<string, string>) => void;
  setReady: (ready: boolean) => void;
  rulesCancel: () => void;
  stopRound: () => void;
  challenge: (player_id: string, cat: string, valid?: boolean) => void;
  markSame: (player_id: string, cat: string, as_player_id: string | null) => void;
  nextRound: () => void;
  endGame: () => void;
  readyNext: () => void;
  playAgain: () => void;
  addBot: () => void;
  removeBot: (bot_id: string) => void;
  adminLogin: (secret: string) => void;
  adminLogout: () => void;
  adminSetAi: (enabled: boolean) => void;
  adminGenAiCodes: (count: number) => void;
  adminGenAvatarCodes: (count: number) => void;
  adminGenBuzzerCodes: (count: number) => void;
  redeemAiCode: (code: string) => void;
  clearShopResult: () => void;
  sendChat: (text: string, voice?: { id: string; dur: number }) => void;
  sendChatTyping: (typing: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
  leaveRoom: () => void;
  // accounts + social
  createAccount: (name: string) => void;
  updateAccount: (patch: { name?: string; color?: string; title?: string }) => void;
  deleteAccount: () => void;
  logoutAccount: () => void;
  linkEmail: (email: string) => void;
  requestLogin: (email: string) => void;
  clearLoginSent: () => void;
  searchUsers: (query: string) => void;
  viewProfile: (user_id: string) => void;
  historyGet: () => void;
  dmSend: (user_id: string, text: string, voice?: { id: string; dur: number }) => void;
  dmOpen: (user_id: string) => void;
  dmClose: () => void;
  dmRefreshThreads: () => void;
  refreshFriends: () => void;
  friendRequest: (user_id: string) => void;
  friendRespond: (user_id: string, accept: boolean) => void;
  friendRemove: (user_id: string) => void;
  friendBlock: (user_id: string, unblock?: boolean) => void;
  refreshBlocked: () => void;
  refreshInbox: () => void;
  inviteSend: (user_id: string, kind: "invite" | "challenge") => void;
  inviteRespond: (invite_id: string, accept: boolean) => void;
  loadLeaderboard: (period: "all" | "week" | "month") => void;
  createClub: (name: string) => void;
  joinClub: (code: string) => void;
  leaveClub: () => void;
  loadClub: (period: "month" | "all") => void;
  setLenient: (on: boolean) => void;
  setBuzzerSkin: (skin: string | null) => void;
  rematch: () => void;
  clearJoin: () => void;
  drainToasts: () => void;
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
        // Re-establish admin login if a secret is stored on this device.
        const adminSecret = loadAdminSecret();
        if (adminSecret) {
          ws.send(JSON.stringify({ type: "admin_login", secret: adminSecret }));
        }
        // Account: redeem a magic-link code from the URL once, else log in
        // with the stored device token.
        const params = new URLSearchParams(location.search);
        const loginCode = params.get("login");
        if (loginCode) {
          ws.send(JSON.stringify({ type: "account_redeem", code: loginCode }));
          params.delete("login");
          const qs = params.toString();
          history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
        } else {
          const accountToken = loadAccountToken();
          if (accountToken) {
            ws.send(JSON.stringify({ type: "account_login", token: accountToken }));
          }
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
    submitAnswers: (answers) => {
      pendingAnswersRef.current = answers;
      send({ type: "submit_answers", answers });
    },
    setReady: (ready) => send({ type: "set_ready", ready }),
    rulesCancel: () => send({ type: "rules_cancel" }),
    stopRound: () => {
      // Submit the complete final answers, then stop.
      if (pendingAnswersRef.current) send({ type: "submit_answers", answers: pendingAnswersRef.current });
      send({ type: "stop_round" });
    },
    challenge: (player_id, cat, valid) =>
      send({ type: "challenge_answer", player_id, cat, ...(valid === undefined ? {} : { valid }) }),
    markSame: (player_id, cat, as_player_id) => send({ type: "mark_same", player_id, cat, as_player_id }),
    nextRound: () => send({ type: "next_round" }),
    endGame: () => send({ type: "end_game" }),
    readyNext: () => send({ type: "ready_next" }),
    playAgain: () => send({ type: "play_again" }),
    addBot: () => send({ type: "add_bot" }),
    removeBot: (bot_id) => send({ type: "remove_bot", bot_id }),
    adminLogin: (secret) => {
      try {
        localStorage.setItem(ADMIN_KEY, secret);
      } catch {
        /* ignore */
      }
      send({ type: "admin_login", secret });
    },
    adminLogout: () => {
      try {
        localStorage.removeItem(ADMIN_KEY);
      } catch {
        /* ignore */
      }
      dispatch({ type: "adminLogout" });
    },
    adminSetAi: (enabled) => send({ type: "admin_set_ai", enabled }),
    adminGenAiCodes: (count) => send({ type: "admin_gen_ai_codes", count }),
    adminGenAvatarCodes: (count) => send({ type: "admin_gen_ai_codes", count, product: "avatars" }),
    adminGenBuzzerCodes: (count) => send({ type: "admin_gen_ai_codes", count, product: "buzzers" }),
    redeemAiCode: (code) => {
      const c = code.trim();
      if (c) send({ type: "shop_redeem", code: c });
    },
    clearShopResult: () => dispatch({ type: "clearShopResult" }),
    sendChat: (text, voice) => {
      const t = text.trim().slice(0, 280);
      if (voice) send({ type: "chat_send", text: t, voice_id: voice.id, voice_dur: voice.dur });
      else if (t) send({ type: "chat_send", text: t });
    },
    sendChatTyping: (typing) => send({ type: "chat_typing", typing }),
    openChat: () => dispatch({ type: "chatOpen", open: true }),
    closeChat: () => dispatch({ type: "chatOpen", open: false }),
    leaveRoom: () => {
      send({ type: "leave_room" });
      clearSession();
      dispatch({ type: "reset" });
    },
    // accounts + social
    createAccount: (name) => send({ type: "account_create", name }),
    updateAccount: (patch) => send({ type: "account_update", ...patch }),
    deleteAccount: () => send({ type: "account_delete" }),
    logoutAccount: () => {
      saveAccountToken(null);
      dispatch({ type: "accountLogout" });
    },
    linkEmail: (email) => send({ type: "account_link_email", email }),
    requestLogin: (email) => send({ type: "account_request_login", email }),
    clearLoginSent: () => dispatch({ type: "clearLoginSent" }),
    searchUsers: (query) => send({ type: "user_search", query }),
    viewProfile: (user_id) => send({ type: "profile_view", user_id }),
    historyGet: () => send({ type: "history_get" }),
    dmSend: (user_id, text, voice) => {
      const t = text.trim().slice(0, 500);
      if (voice) send({ type: "dm_send", user_id, text: t, voice_id: voice.id, voice_dur: voice.dur });
      else if (t) send({ type: "dm_send", user_id, text: t });
    },
    dmOpen: (user_id) => send({ type: "dm_thread", user_id }),
    dmClose: () => dispatch({ type: "dmClose" }),
    dmRefreshThreads: () => send({ type: "dm_threads" }),
    refreshFriends: () => send({ type: "friends_list" }),
    friendRequest: (user_id) => send({ type: "friend_request", user_id }),
    friendRespond: (user_id, accept) => send({ type: "friend_respond", user_id, accept }),
    friendRemove: (user_id) => send({ type: "friend_remove", user_id }),
    friendBlock: (user_id, unblock) => send({ type: "friend_block", user_id, unblock: !!unblock }),
    refreshBlocked: () => send({ type: "blocked_list" }),
    refreshInbox: () => send({ type: "inbox_get" }),
    inviteSend: (user_id, kind) => send({ type: "invite_send", user_id, kind }),
    inviteRespond: (invite_id, accept) => send({ type: "invite_respond", invite_id, accept }),
    loadLeaderboard: (period) => send({ type: "leaderboard_get", period }),
    createClub: (name) => send({ type: "club_create", name }),
    joinClub: (code) => send({ type: "club_join", code }),
    leaveClub: () => send({ type: "club_leave" }),
    loadClub: (period) => send({ type: "club_get", period }),
    setLenient: (on) => send({ type: "set_lenient", on }),
    setBuzzerSkin: (skin) => send({ type: "set_buzzer_skin", skin }),
    rematch: () => send({ type: "rematch" }),
    clearJoin: () => dispatch({ type: "clearJoin" }),
    drainToasts: () => dispatch({ type: "drainToasts" }),
  };

  // Expose the pending-answers flush via the api object for the Fill screen.
  (api as GameApi & { flushAnswers: () => void }).flushAnswers = () => {
    if (pendingAnswersRef.current) send({ type: "submit_answers", answers: pendingAnswersRef.current });
  };

  return api;
}
