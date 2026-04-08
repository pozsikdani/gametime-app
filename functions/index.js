const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Lazy-load Expo SDK to avoid deployment timeout
let _expo = null;
function getExpo() {
  if (!_expo) {
    const { Expo } = require('expo-server-sdk');
    _expo = new Expo();
  }
  return _expo;
}
function isExpoPushToken(token) {
  const { Expo } = require('expo-server-sdk');
  return Expo.isExpoPushToken(token);
}

// Send push notification when a new chat message is created (multi-team)
exports.onNewMessage = onDocumentCreated('teams/{teamId}/messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) return;

  // Skip system messages
  if (message.type === 'system') return;

  const { teamId, messageId } = event.params;
  const senderId = message.senderId;
  const senderName = message.senderName || 'Unknown';
  const text = message.text || '';

  console.log(`New message in team ${teamId} from ${senderName}: "${text.substring(0, 50)}"`);

  // Get team info for notification title
  const teamDoc = await db.doc(`teams/${teamId}`).get();
  const teamName = teamDoc.exists ? teamDoc.data().name : '';

  // Get team members only (not all users)
  const membersSnapshot = await db.collection(`teams/${teamId}/members`).get();
  const memberUids = membersSnapshot.docs.map((doc) => doc.id);

  console.log(`Team has ${memberUids.length} members, sender: ${senderId}`);

  // Get push tokens for team members only
  const pushMessages = [];

  for (const uid of memberUids) {
    // Don't send to the sender
    if (uid === senderId) continue;

    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists) continue;

    const userData = userDoc.data();
    // Check notification preferences (default: enabled)
    const prefs = userData.notificationPrefs || {};
    if (prefs.chat === false) {
      console.log(`Skipping ${userData.displayName}: chat notifications disabled`);
      continue;
    }

    // Collect valid push tokens
    if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
      userData.pushTokens.forEach((token) => {
        if (isExpoPushToken(token)) {
          pushMessages.push({
            to: token,
            sound: 'default',
            title: teamName ? `${senderName} · ${teamName}` : senderName,
            body: text.length > 100 ? text.substring(0, 100) + '...' : text,
            data: { type: 'chat', teamId, messageId },
          });
        }
      });
    }
  }

  if (pushMessages.length === 0) {
    console.log('No push tokens to send to.');
    return;
  }

  console.log(`Sending ${pushMessages.length} push notifications...`);

  // Send individually to avoid PUSH_TOO_MANY_EXPERIENCE_IDS error
  let sent = 0;
  let failed = 0;
  for (const msg of pushMessages) {
    try {
      const [ticket] = await getExpo().sendPushNotificationsAsync([msg]);
      if (ticket.status === 'ok') {
        sent++;
      } else {
        failed++;
        console.error(`Push failed for ${msg.to}:`, ticket.message || ticket.details);
        // Remove invalid token
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log(`Removing invalid token: ${msg.to}`);
          const usersSnap = await db.collection('users').where('pushTokens', 'array-contains', msg.to).get();
          for (const userDoc of usersSnap.docs) {
            const tokens = userDoc.data().pushTokens.filter((t) => t !== msg.to);
            await db.doc(`users/${userDoc.id}`).update({ pushTokens: tokens });
          }
        }
      }
    } catch (error) {
      failed++;
      console.error(`Push error for ${msg.to}:`, error.message || error);
    }
  }

  console.log(`Push complete: ${sent} sent, ${failed} failed.`);
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
  return data.pushTokens.filter((t) => isExpoPushToken(t));
}

// ─── Helper: send push notifications in chunks ────────────────
async function sendNotifications(messages) {
  if (messages.length === 0) return;
  const chunks = getExpo().chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await getExpo().sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }
}
