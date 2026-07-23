import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 2000;

export default function LoginScreen() {
  const { login } = useAuth();
  const [status, setStatus] = useState<"idle" | "waiting" | "expired" | "error">("idle");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startLogin = useCallback(async () => {
    stopPolling();
    setStatus("waiting");
    try {
      const { token, deep_link } = await authApi.initLogin();
      tokenRef.current = token;
      setDeepLink(deep_link);
      await Linking.openURL(deep_link);

      pollTimer.current = setInterval(async () => {
        if (!tokenRef.current) return;
        try {
          const result = await authApi.pollLogin(tokenRef.current);
          if (result.status === "confirmed" && result.access_token) {
            stopPolling();
            await login(result.access_token);
          } else if (result.status === "expired") {
            stopPolling();
            setStatus("expired");
          }
        } catch (err) {
          stopPolling();
          setStatus("error");
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setStatus("error");
      const message = err instanceof ApiError ? err.message : "Could not reach the server";
      Alert.alert("Login failed", message);
    }
  }, [login, stopPolling]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Net-Birr</Text>
      <Text style={styles.subtitle}>Track your money, day to day.</Text>

      {status === "waiting" && (
        <View style={styles.waitingBox}>
          <ActivityIndicator />
          <Text style={styles.waitingText}>
            Waiting for confirmation in Telegram - tap "Start" in the chat that just opened.
          </Text>
        </View>
      )}

      {status === "expired" && <Text style={styles.errorText}>That login link expired. Try again.</Text>}
      {status === "error" && <Text style={styles.errorText}>Something went wrong. Try again.</Text>}

      <TouchableOpacity style={styles.button} onPress={startLogin}>
        <Text style={styles.buttonText}>{deepLink ? "Reopen Telegram" : "Login with Telegram"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 40 },
  button: { backgroundColor: "#229ED9", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  waitingBox: { alignItems: "center", marginBottom: 32, paddingHorizontal: 16 },
  waitingText: { marginTop: 12, textAlign: "center", color: "#444" },
  errorText: { color: "#c0392b", marginBottom: 16, textAlign: "center" },
});
