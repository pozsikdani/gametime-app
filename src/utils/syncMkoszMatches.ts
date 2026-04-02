import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { fetchMkoszSchedule } from './mkoszScraper';

/**
 * Fetches matches from MKOSZ and syncs them to Firestore.
 * Only adds new matches (skips already imported ones based on date + opponent).
 * Reads mkoszConfigs from the team document — if none, skips sync.
 */
export async function syncMkoszMatches(teamId: string): Promise<number> {
  // Read team doc to get mkoszConfigs
  const teamDoc = await getDoc(doc(db, 'teams', teamId));
  const mkoszConfigs = teamDoc.data()?.mkoszConfigs;
  if (!mkoszConfigs || !Array.isArray(mkoszConfigs) || mkoszConfigs.length === 0) {
    return 0; // No MKOSZ config for this team — skip
  }

  const matches = await fetchMkoszSchedule(mkoszConfigs);
  if (matches.length === 0) return 0;

  // Get existing events to avoid duplicates
  const eventsRef = collection(db, 'teams', teamId, 'events');
  const existingQuery = query(eventsRef, where('type', '==', 'match'));
  const existingDocs = await getDocs(existingQuery);

  const existingKeys = new Set<string>();
  existingDocs.docs.forEach((doc) => {
    const data = doc.data();
    if (data.date && data.opponent) {
      // Key: date ISO string + opponent (lowercased)
      const dateStr = data.date.toDate().toISOString().slice(0, 10);
      existingKeys.add(`${dateStr}_${data.opponent.toLowerCase()}`);
    }
  });

  let added = 0;

  for (const match of matches) {
    const dateStr = match.date.toISOString().slice(0, 10);
    const key = `${dateStr}_${match.opponent.toLowerCase()}`;

    if (existingKeys.has(key)) continue;

    const title = match.isHome
      ? `Közgáz vs ${match.opponent}`
      : `${match.opponent} vs Közgáz`;

    await addDoc(eventsRef, {
      type: 'match',
      title,
      date: Timestamp.fromDate(match.date),
      location: match.location,
      opponent: match.opponent,
      isHome: match.isHome,
      score: match.score || null,
      mkoszGameId: match.gameId || null,
      createdBy: 'mkosz-sync',
      createdAt: serverTimestamp(),
    });

    added++;
  }

  return added;
}
