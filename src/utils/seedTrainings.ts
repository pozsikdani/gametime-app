import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

const TRAINING_LOCATION = 'Közgáz tornaterem';

function getTrainingDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay();
    // Tuesday = 2, Thursday = 4
    if (day === 2 || day === 4) {
      dates.push(new Date(current.getFullYear(), current.getMonth(), current.getDate(), 20, 0));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatTitle(date: Date): string {
  const days = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
  return `${days[date.getDay()]} edzés`;
}

export async function seedTrainings(): Promise<number> {
  const start = new Date(2026, 3, 1);   // April 1, 2026
  const end = new Date(2026, 5, 15);    // June 15, 2026
  const dates = getTrainingDates(start, end);

  // Check existing training events to avoid duplicates
  const eventsRef = collection(db, 'events');
  const existingQuery = query(eventsRef, where('type', '==', 'training'));
  const existingSnap = await getDocs(existingQuery);

  const existingDates = new Set<string>();
  existingSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.date) {
      const d = data.date.toDate();
      existingDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`);
    }
  });

  let added = 0;
  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    if (existingDates.has(key)) continue;

    await addDoc(eventsRef, {
      type: 'training',
      title: formatTitle(date),
      date: Timestamp.fromDate(date),
      location: TRAINING_LOCATION,
      createdBy: auth.currentUser?.uid || '',
      createdAt: serverTimestamp(),
    });
    added++;
  }

  return added;
}
