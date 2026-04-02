import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { Team, TeamMembership } from '../types';

interface TeamContextValue {
  /** Currently active team ID */
  activeTeamId: string | null;
  /** Currently active team document */
  activeTeam: Team | null;
  /** All teams the user belongs to */
  teams: Team[];
  /** User's membership in the active team */
  membership: TeamMembership | null;
  /** Whether initial loading is in progress */
  loading: boolean;
  /** Switch to a different team */
  switchTeam: (teamId: string) => Promise<void>;
}

const TeamContext = createContext<TeamContextValue>({
  activeTeamId: null,
  activeTeam: null,
  teams: [],
  membership: null,
  loading: true,
  switchTeam: async () => {},
});

export function useTeam() {
  return useContext(TeamContext);
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  // 1. Load user's teamIds and lastActiveTeamId
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubUser = onSnapshot(doc(db, 'users', uid), (snap) => {
      const data = snap.data();
      const teamIds: string[] = data?.teamIds || [];
      const lastActive: string | undefined = data?.lastActiveTeamId;

      if (teamIds.length === 0) {
        setTeams([]);
        setActiveTeamId(null);
        setActiveTeam(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      // Determine active team
      if (lastActive && teamIds.includes(lastActive)) {
        setActiveTeamId(lastActive);
      } else {
        setActiveTeamId(teamIds[0]);
      }

      // Fetch team documents
      // Firestore `in` query supports up to 30 items — sufficient for our use case
      const teamsQuery = query(
        collection(db, 'teams'),
        where(documentId(), 'in', teamIds.slice(0, 30))
      );

      const unsubTeams = onSnapshot(teamsQuery, (snapshot) => {
        const teamDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Team[];
        setTeams(teamDocs);
        setLoading(false);
      });

      return () => unsubTeams();
    });

    return () => unsubUser();
  }, [uid]);

  // 2. When activeTeamId changes, update activeTeam and load membership
  useEffect(() => {
    if (!activeTeamId) {
      setActiveTeam(null);
      setMembership(null);
      return;
    }

    // Set activeTeam from loaded teams
    const team = teams.find((t) => t.id === activeTeamId) || null;
    setActiveTeam(team);

    // Load membership
    if (!uid) return;

    const unsubMembership = onSnapshot(
      doc(db, 'teams', activeTeamId, 'members', uid),
      (snap) => {
        if (snap.exists()) {
          setMembership(snap.data() as TeamMembership);
        } else {
          setMembership(null);
        }
      }
    );

    return () => unsubMembership();
  }, [activeTeamId, teams, uid]);

  // 3. Switch team
  const switchTeam = useCallback(
    async (teamId: string) => {
      if (!uid) return;
      setActiveTeamId(teamId);
      await updateDoc(doc(db, 'users', uid), { lastActiveTeamId: teamId });
    },
    [uid]
  );

  return (
    <TeamContext.Provider
      value={{
        activeTeamId,
        activeTeam,
        teams,
        membership,
        loading,
        switchTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
