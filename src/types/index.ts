import { Timestamp } from 'firebase/firestore';

// ─── Team ──────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  sport: string;
  inviteCode: string;
  photoURL?: string;
  createdAt: Timestamp;
  createdBy: string;
  adminUids: string[];
  mkoszConfigs?: MkoszConfig[];
}

export interface MkoszConfig {
  teamId: string;
  teamName: string;
  competition: string;
  season: string;
}

export type TeamRole = 'player' | 'coach' | 'admin' | 'guest';

export interface TeamMembership {
  role: TeamRole;
  jerseyNumber: string;
  position: string[];
  height: string;
  weight: string;
  phone: string;
  jerseySize: string;
  idNumber: string;
  medicalExpiry: string;
  joinedAt: Timestamp;
}

// ─── User ──────────────────────────────────────────────

export interface UserProfile {
  displayName: string;
  email: string;
  createdAt: Timestamp;
  photoURL?: string;
  pushTokens?: string[];
  notificationPrefs?: {
    chat?: boolean;
    polls?: boolean;
    events?: boolean;
  };
  teamIds: string[];
  lastActiveTeamId?: string;
}

// ─── Chat ──────────────────────────────────────────────

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  createdAt: Timestamp | null;
  type: 'text' | 'system';
}

// ─── Calendar ──────────────────────────────────────────

export type EventType = 'match' | 'training';
export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: Timestamp;
  location: string;
  opponent?: string;       // match only
  isHome?: boolean;        // match only
  mkoszGameId?: string;    // auto-imported match ID
  score?: string;          // result if played (e.g. "78-65")
  squad?: string[];        // match only: selected player userIds
  createdBy: string;       // uid of creator
  createdAt: Timestamp;
}

export interface Rsvp {
  userId: string;
  userName: string;
  status: RsvpStatus;
  updatedAt: Timestamp;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: Timestamp;
  closed: boolean;
  multipleChoice?: boolean;
}

export interface PollVote {
  optionIds: string[];
  userName: string;
  votedAt: Timestamp;
}
