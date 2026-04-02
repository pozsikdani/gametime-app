const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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
