import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from './src/services/notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './src/hooks/useAuth';
import { TeamProvider, useTeam } from './src/contexts/TeamContext';
import InviteScreen from './src/screens/InviteScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import PollsScreen from './src/screens/PollsScreen';
import PollDetailScreen from './src/screens/PollDetailScreen';
import CreatePollScreen from './src/screens/CreatePollScreen';
import TeamPickerScreen from './src/screens/TeamPickerScreen';
import JoinTeamScreen from './src/screens/JoinTeamScreen';
import MembersScreen from './src/screens/MembersScreen';
import MemberDetailScreen from './src/screens/MemberDetailScreen';
import TeamHeader from './src/components/TeamHeader';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { spacing } from './src/constants/theme';
let giphyInitialized = false;
try {
  const { GiphySDK } = require('@giphy/react-native-sdk');
  GiphySDK.configure({ apiKey: 'E9rPq5cUqwR8PWkPZbQ6ItQG02RKNb2w' });
  giphyInitialized = true;
} catch (e) {
  console.warn('Giphy SDK not available (Expo Go?)');
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const CalendarStack = createNativeStackNavigator();
const PollStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// navTheme is now created dynamically inside the App component

function CalendarStackScreen() {
  return (
    <CalendarStack.Navigator screenOptions={{ headerShown: false }}>
      <CalendarStack.Screen name="CalendarList" component={CalendarScreen} />
      <CalendarStack.Screen name="EventDetail" component={EventDetailScreen} />
      <CalendarStack.Screen name="CreateEvent" component={CreateEventScreen} />
    </CalendarStack.Navigator>
  );
}

function PollStackScreen() {
  return (
    <PollStack.Navigator screenOptions={{ headerShown: false }}>
      <PollStack.Screen name="PollsList" component={PollsScreen} />
      <PollStack.Screen name="PollDetail" component={PollDetailScreen} />
      <PollStack.Screen name="CreatePoll" component={CreatePollScreen} />
    </PollStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Members" component={MembersScreen} />
      <ProfileStack.Screen name="MemberDetail" component={MemberDetailScreen} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarStackScreen}
        options={{
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Polls"
        component={PollStackScreen}
        options={{
          tabBarLabel: 'Polls',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const TeamStack = createNativeStackNavigator();

function AuthenticatedApp() {
  const { loading: teamLoading, activeTeamId, teams } = useTeam();
  const { colors } = useTheme();

  if (teamLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // User has no teams — show join screen
  if (teams.length === 0 || !activeTeamId) {
    return (
      <TeamStack.Navigator screenOptions={{ headerShown: false }}>
        <TeamStack.Screen name="JoinTeam" component={JoinTeamScreen} />
      </TeamStack.Navigator>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TeamHeader />
      <MainTabs />
    </View>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (user) {
      // Register for push notifications
      registerForPushNotifications(user.uid);

      // Listen for incoming notifications while app is open
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        // Notification received while app is in foreground
      });

      // Listen for notification taps
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        // User tapped on notification — could navigate to chat
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  const { colors, isDark } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {user ? (
          <TeamProvider>
            <AuthenticatedApp />
          </TeamProvider>
        ) : (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Invite" component={InviteScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
