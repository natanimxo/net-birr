import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import AddTransactionScreen from "../screens/AddTransactionScreen";
import AdminScreen from "../screens/AdminScreen";
import DebtDetailScreen from "../screens/DebtDetailScreen";
import DebtsScreen from "../screens/DebtsScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileTypeScreen from "../screens/ProfileTypeScreen";
import TodayScreen from "../screens/TodayScreen";
import UpgradeScreen from "../screens/UpgradeScreen";
import { Debt } from "../types";

export type RootStackParamList = {
  Login: undefined;
  ProfileType: undefined;
  Today: undefined;
  AddTransaction: undefined;
  Upgrade: undefined;
  Admin: undefined;
  Debts: undefined;
  DebtDetail: { debt: Debt };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isLoading, user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert("Log out?", "You'll need to log in again with Telegram.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !user.profile_type ? (
          <Stack.Screen name="ProfileType" component={ProfileTypeScreen} />
        ) : (
          <>
            <Stack.Screen
              name="Today"
              component={TodayScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: "Today",
                headerLeft: () => (
                  <TouchableOpacity onPress={confirmLogout}>
                    <Text style={{ color: "#c0392b", fontWeight: "600" }}>Logout</Text>
                  </TouchableOpacity>
                ),
                headerRight: () => (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {user.is_admin && (
                      <TouchableOpacity onPress={() => navigation.navigate("Admin")}>
                        <Text style={{ color: "#229ED9", fontWeight: "600" }}>Admin</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => navigation.navigate("Debts")}>
                      <Text style={{ color: "#229ED9", fontWeight: "600" }}>Debts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("Upgrade")}>
                      <Text style={{ color: "#229ED9", fontWeight: "600" }}>Upgrade</Text>
                    </TouchableOpacity>
                  </View>
                ),
              })}
            />
            <Stack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={{ headerShown: true, title: "Add Transaction", presentation: "modal" }}
            />
            <Stack.Screen name="Upgrade" component={UpgradeScreen} options={{ headerShown: true, title: "Upgrade" }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ headerShown: true, title: "Pending Payments" }} />
            <Stack.Screen name="Debts" component={DebtsScreen} options={{ headerShown: true, title: "Debts" }} />
            <Stack.Screen name="DebtDetail" component={DebtDetailScreen} options={{ headerShown: true, title: "Debt" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
