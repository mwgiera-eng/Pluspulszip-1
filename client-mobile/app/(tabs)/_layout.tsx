import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="signals"
        options={{
          title: "Sygnały",
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="download"
        options={{
          title: "Instalacja",
          tabBarIcon: ({ color, size }) => <Ionicons name="download-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
