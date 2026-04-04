# Jogosultsági mátrix — Gametime App

> Utolsó frissítés: 2026-04-03

## Szerepkörök

| Szint | Firestore érték | Leírás |
|-------|----------------|--------|
| **Guest** | `guest` | Vendég, korlátozott hozzáférés |
| **Player** | `player` | Csaptag |
| **Coach** | `coach` | Edző (admin jogokkal) |
| **Team Admin** | `admin` | Csapat adminisztrátor |
| **Super Admin** | `appConfig/admins` | App-szintű admin |

> Coach és Team Admin jogosultsága **azonos** — `useAdmin()` hook mindkettőt admin-nak tekinti.

## Műveletek

| Művelet | Guest | Player | Coach/Admin | Super Admin |
|---------|:-----:|:------:|:-----------:|:-----------:|
| **Chat** | | | | |
| Üzenetek olvasása | ✅ | ✅ | ✅ | ✅ |
| Üzenet küldése | ✅ | ✅ | ✅ | ✅ |
| Üzenet törlése | ❌ | ❌ | ✅ | ✅ |
| **Naptár** | | | | |
| Események megtekintése | ✅ | ✅ | ✅ | ✅ |
| RSVP edzésre | ✅ | ✅ | ✅ | ✅ |
| RSVP meccsre | ❌ | ✅ | ✅ | ✅ |
| Esemény létrehozása | ❌ | ❌ | ✅ | ✅ |
| Esemény szerkesztése | ❌ | ❌ | ✅ | ✅ |
| Esemény törlése | ❌ | ❌ | ✅ | ✅ |
| Keret kihirdetése | ❌ | ❌ | ✅ | ✅ |
| MKOSZ meccsek szinkron | ❌ | ❌ | ✅ | ✅ |
| **Szavazások** | | | | |
| Szavazás megtekintése | ✅ | ✅ | ✅ | ✅ |
| Szavazat leadása | ✅ | ✅ | ✅ | ✅ |
| Szavazás létrehozása | ❌ | ❌ | ✅ | ✅ |
| Szavazás lezárása | ❌ | ❌ | ✅ | ✅ |
| Szavazás törlése | ❌ | ❌ | ✅ | ✅ |
| **Profil** | | | | |
| Saját profil szerkesztése | ✅ | ✅ | ✅ | ✅ |
| Értesítés beállítások | ✅ | ✅ | ✅ | ✅ |
| Jelszó módosítás | ✅ | ✅ | ✅ | ✅ |
| **Adminisztráció** | | | | |
| Csapattagok listája | ❌ | ❌ | ✅ | ✅ |
| Tag profil megtekintése | ❌ | ❌ | ✅ | ✅ |
| Szerepkör változtatása | ❌ | ❌ | ✅ | ✅ |
| Tag eltávolítása | ❌ | ❌ | ✅ | ✅ |
| Csapat létrehozása | ❌ | ❌ | ❌ | ✅ |
| Csapat beállítások | ❌ | ❌ | ✅ | ✅ |

## Implementáció

- **Role típus:** `src/types/index.ts` → `TeamRole = 'player' | 'coach' | 'admin' | 'guest'`
- **Admin check:** `src/hooks/useAdmin.ts` → `useAdmin()` = team admin/coach VAGY super admin
- **Team admin check:** `src/hooks/useTeamAdmin.ts` → `useTeamAdmin()` = role === 'admin' || 'coach'
- **Super admin check:** `src/hooks/useSuperAdmin.ts` → `useSuperAdmin()` = uid in `appConfig/admins.superAdminUids`
- **Guest meccs RSVP:** `src/screens/EventDetailScreen.tsx` → `!isGuest` feltétel a meccs RSVP section-ön
- **Firestore rules:** `firestore.rules` → `isTeamMember()`, `isTeamAdmin()`, `isSuperAdmin()` helper-ek
