import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export function useSuperAdmin(): boolean {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setIsSuperAdmin(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'appConfig', 'admins'), (snap) => {
      const data = snap.data();
      const superAdminUids: string[] = data?.superAdminUids || [];
      setIsSuperAdmin(superAdminUids.includes(uid));
    });

    return unsubscribe;
  }, [uid]);

  return isSuperAdmin;
}
