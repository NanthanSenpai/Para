import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRealtimeBadges } from '../context/RealtimeBadgesContext';

import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BookmarksScreen } from '../screens/BookmarksScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { DrawerContent } from '../components/DrawerContent';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function BottomTabs() {
  const { colors } = useTheme();
  const { unreadNotifications, unreadMessages } = useRealtimeBadges();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 54,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.accent,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={25} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarBadge: unreadNotifications > 0 ? unreadNotifications : undefined,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'mail' : 'mail-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function DrawerShell() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerShown: false, drawerType: 'slide', swipeEdgeWidth: 80 }}
    >
      <Drawer.Screen name="MainTabs" component={BottomTabs} />
    </Drawer.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : !profile ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Root" component={DrawerShell} options={{ headerShown: false }} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
            <Stack.Screen name="ProfileDetail" component={ProfileScreen} options={{ title: '' }} />
            <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
            <Stack.Screen name="OnboardingEdit" component={OnboardingScreen} options={{ title: 'Edit profile' }} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }: any) => ({ title: route.params?.otherUser?.display_name ?? 'Chat' })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
