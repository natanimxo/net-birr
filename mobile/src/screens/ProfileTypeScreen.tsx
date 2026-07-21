import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ProfileType } from "../types";

const OPTIONS: { value: ProfileType; title: string; description: string }[] = [
  { value: "personal", title: "Personal", description: "Track where your money goes - budgets, savings." },
  { value: "business", title: "Business", description: "Replace the paper ledger - daily reconciliation, customer debts." },
];

export default function ProfileTypeScreen() {
  const { setProfileType } = useAuth();
  const [submitting, setSubmitting] = useState<ProfileType | null>(null);

  const choose = async (value: ProfileType) => {
    setSubmitting(value);
    try {
      await setProfileType(value);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save your choice";
      Alert.alert("Something went wrong", message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How will you use this app?</Text>
      <Text style={styles.subtitle}>Pick whichever fits how you'll use the app day to day.</Text>

      {OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.card}
          onPress={() => choose(option.value)}
          disabled={submitting !== null}
        >
          <Text style={styles.cardTitle}>{option.title}</Text>
          <Text style={styles.cardDescription}>{option.description}</Text>
          {submitting === option.value && <ActivityIndicator style={styles.cardSpinner} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
  cardDescription: { fontSize: 14, color: "#555" },
  cardSpinner: { marginTop: 12 },
});
