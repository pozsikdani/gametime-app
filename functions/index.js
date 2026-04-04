const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Expo } = require('expo-server-sdk');

initializeApp();
const db = getFirestore();
const expo = new Expo();

// Send push notification when a new chat message is created (multi-team)
exports.onNewMessage = onDocumentCreated('teams/{teamId}/messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) return;

  const { teamId, messageId } = event.params;
  const senderId = message.senderId;
  const senderName = message.senderName || 'Valaki';
  const text = message.text || '';

  // Get team info for notification title
  const teamDoc = await db.doc(`teams/${teamId}`).get();
  const teamName = teamDoc.exists ? teamDoc.data().name : '';

  // Get team members only (not all users)
  const membersSnapshot = await db.collection(`teams/${teamId}/members`).get();
  const memberUids = membersSnapshot.docs.map((doc) => doc.id);

  // Get push tokens for team members only
  const pushTokens = [];

  for (const uid of memberUids) {
    // Don't send to the sender
    if (uid === senderId) continue;

    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists) continue;

    const userData = userDoc.data();
    // Check notification preferences (default: enabled)
    const prefs = userData.notificationPrefs || {};
    if (prefs.chat === false) continue;
    // Collect all push tokens
    if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
      userData.pushTokens.forEach((token) => {
        if (Expo.isExpoPushToken(token)) {
          pushTokens.push(token);
        }
      });
    }
  }

  if (pushTokens.length === 0) return;

  // Build notification messages
  const notifTitle = teamName ? `${senderName} · ${teamName}` : senderName;
  const messages = pushTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: notifTitle,
    body: text.length > 100 ? text.substring(0, 100) + '...' : text,
    data: { type: 'chat', teamId, messageId },
  }));

  // Send in chunks (Expo recommends max 100 per batch)
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }
});

// ─── Scheduled: Medical expiry notifications ───────────────────
// Runs daily at 9:00 AM CET (8:00 UTC)
const MEDICAL_THRESHOLDS = [
  { days: 60, label: '2 honap' },
  { days: 30, label: '1 honap' },
  { days: 14, label: '2 het' },
  { days: 7, label: '1 het' },
];

exports.checkMedicalExpiry = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Budapest' },
  async () => {
    const teamsSnapshot = await db.collection('teams').get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamId = teamDoc.id;
      const teamName = teamDoc.data().name || '';

      const membersSnapshot = await db.collection(`teams/${teamId}/members`).get();

      // Collect admin/coach tokens for team-level alerts
      const adminUids = [];
      const membersByUid = {};

      for (const memberDoc of membersSnapshot.docs) {
        const data = memberDoc.data();
        membersByUid[memberDoc.id] = data;
        if (data.role === 'admin' || data.role === 'coach') {
          adminUids.push(memberDoc.id);
        }
      }

      // Check each member's medical expiry
      for (const memberDoc of membersSnapshot.docs) {
        const data = memberDoc.data();
        if (!data.medicalExpiry) continue;

        const expiry = new Date(data.medicalExpiry);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check if today matches any threshold
        const threshold = MEDICAL_THRESHOLDS.find((t) => t.days === daysLeft);
        if (!threshold) continue;

        const memberName = data.displayName || 'Ismeretlen';
        const memberUid = memberDoc.id;

        // 1. Notify the member themselves
        const memberTokens = await getTokensForUid(memberUid);
        if (memberTokens.length > 0) {
          const msgs = memberTokens.map((token) => ({
            to: token,
            sound: 'default',
            title: `Sportorvosi lejarat - ${threshold.label}`,
            body: `A sportorvosi igazolasod ${data.medicalExpiry}-en lejar. Meg ${threshold.label} van hatra!`,
            data: { type: 'medical', teamId },
          }));
          await sendNotifications(msgs);
        }

        // 2. Notify admins/coaches
        for (const adminUid of adminUids) {
          if (adminUid === memberUid) continue; // Don't double-notify
          const adminTokens = await getTokensForUid(adminUid);
          if (adminTokens.length > 0) {
            const msgs = adminTokens.map((token) => ({
              to: token,
              sound: 'default',
              title: `Sportorvosi lejarat - ${teamName}`,
              body: `${memberName} sportorvosija ${threshold.label} mulva lejar (${data.medicalExpiry}).`,
              data: { type: 'medical', teamId, memberUid },
            }));
            await sendNotifications(msgs);
          }
        }
      }
    }

    console.log('Medical expiry check completed.');
  }
);

// ─── Helper: get push tokens for a user ───────────────────────
async function getTokensForUid(uid) {
  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) return [];
  const data = userDoc.data();
  if (!data.pushTokens || !Array.isArray(data.pushTokens)) return [];
  return data.pushTokens.filter((t) => Expo.isExpoPushToken(t));
}

// ─── Helper: send push notifications in chunks ────────────────
async function sendNotifications(messages) {
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }
}
