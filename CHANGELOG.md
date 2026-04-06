# Gametime — Changelog

## Build #6 — 2026-04-06
**Version 1.0.1**

### Features
- Chat emoji reactions: long-press message → pick from 👍❤️😂😮😢🔥 → reaction pills shown below message
- Haptic feedback + scale animation on long-press
- Emoji picker positioned above the message bubble
- Player license card upload (photo/gallery) on profile
- Admin can view license cards in member detail screen (tap for full-size)
- Event location opens in Maps app (match events only)
- Next event banner: auto-collapses after RSVP, shows RSVP counts in collapsed view
- Date/time picker on New Event screen (native spinner instead of manual text input)

### Fixes
- Chat: Firestore reconnect on app foreground (fix delayed messages)
- Chat: retry logic (3x) on permission-denied after fresh registration
- Chat: client-side timestamp fallback for correct message ordering
- RegisterScreen: include displayName + medicalExpiry in membership doc
- Poll selected option: green instead of red
- MemberDetail: swapped Change role / Remove from team colors
- Firebase Storage rules deployed (fix license card upload permission)

### Data fixes (server-side, no build needed)
- Fixed missing displayNames for registered testers
- Cleared old push tokens broken by project rename
- Firestore rules: invite code lookup without auth

---

## Build #5 — 2026-04-05
**Version 1.0.0 (iOS build 5, Android versionCode 4)**

### Fixes
- Chat: force Firestore reconnect when app returns to foreground (fix delayed messages)
- Chat: retry logic (3x with 1.5s delay) on permission-denied after fresh registration
- Chat: client-side timestamp fallback for correct message ordering
- Chat: error handler on onSnapshot listener (prevents infinite loading)
- RegisterScreen: include displayName and medicalExpiry in membership doc
- Firestore rules: allow team list without auth (invite code lookup fix)
- Firebase config: add firestore rules deployment path
- Clear old push tokens broken by project rename

### Assets
- New Gametime basketball app icon (orange)
- Android adaptive icon with orange background

---

## Build #4 — 2026-04-04
**Version 1.0.0 (iOS build 4, Android versionCode 3)**

### Features
- Full English UI translation (~200 strings, 20 files)
- App renamed from "Közgáz Kosár" to "Gametime"
- Bundle ID changed to app.gametime.team
- New EAS project: gametime-team

### Fixes
- Firebase environment variables added to EAS (fixed black screen on production builds)

---

## Build #3 — 2026-04-04
**Version 1.0.0 (iOS build 3, Android versionCode 2)**

### Features
- Guest role with restricted match RSVP
- Team members list screen (admin only)
- Member detail screen with read-only profile view
- Admin can change member roles and remove members
- Medical clearance expiry field with native date picker
- Scheduled Cloud Function for medical expiry notifications (daily 9:00 CET)
- Keyboard handling improvements (enter = send in chat)
- KeyboardAvoidingView offset fix for chat and profile

### Data
- 6 teams created (Közgáz B, A, MEFOB Női, MEFOB Férfi, Leftoverz, Női Budapest)
- Peti added to all teams

---

## Build #2 — 2026-04-03
**Version 1.0.0 (iOS build 2, Android versionCode 1)**

### Features
- Multi-team architecture (Firestore nested collections)
- Global team switcher (TeamHeader component)
- Team-scoped chat, calendar, polls
- Cloud Functions: push notifications for team messages
- MKOSZ match sync (team-aware, reads from team doc mkoszConfigs)
- Safe area handling for Dynamic Island

---

## Build #1 — Initial
**Version 1.0.0**

### Features
- Chat with real-time messaging
- Calendar with matches and trainings
- RSVP system (2-way for matches, 3-way for trainings)
- Squad announcement
- Polls with single/multiple choice voting
- User profiles with player data
- Push notifications
- MKOSZ match import
