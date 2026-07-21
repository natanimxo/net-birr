import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { API_URL, ApiError } from "../api/client";
import { adminApi } from "../api/payments";
import { PaymentSubmission } from "../types";

export default function AdminScreen() {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.listPendingSubmissions();
      setSubmissions(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load submissions";
      Alert.alert("Something went wrong", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const approve = async (submission: PaymentSubmission) => {
    setActingOnId(submission.id);
    try {
      await adminApi.approve(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not approve";
      Alert.alert("Approve failed", message);
    } finally {
      setActingOnId(null);
    }
  };

  const confirmReject = (submission: PaymentSubmission) => {
    Alert.alert("Reject submission?", `Reject the ${submission.plan} payment from ${submission.sender_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => reject(submission) },
    ]);
  };

  const reject = async (submission: PaymentSubmission) => {
    setActingOnId(submission.id);
    try {
      await adminApi.reject(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not reject";
      Alert.alert("Reject failed", message);
    } finally {
      setActingOnId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={submissions.length ? styles.list : styles.emptyList}
      data={submissions}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No pending submissions.</Text>}
      renderItem={({ item }) => {
        const busy = actingOnId === item.id;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardPlan}>
                {item.plan} - {item.amount} birr
              </Text>
              <Text style={styles.cardMethod}>{item.method.toUpperCase()}</Text>
            </View>

            <Text style={styles.cardLine}>
              From: {item.sender_name}
              {item.telegram_username ? ` (@${item.telegram_username})` : ""}
            </Text>
            <Text style={styles.cardLine}>Transaction ID: {item.transaction_id}</Text>
            <Text style={styles.cardDate}>{new Date(item.submitted_at).toLocaleString()}</Text>

            {item.screenshot_url && (
              <TouchableOpacity onPress={() => Linking.openURL(`${API_URL}${item.screenshot_url}`)}>
                <Image source={{ uri: `${API_URL}${item.screenshot_url}` }} style={styles.screenshot} resizeMode="cover" />
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton, busy && styles.actionButtonDisabled]}
                onPress={() => confirmReject(item)}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#c0392b" /> : <Text style={styles.rejectButtonText}>Reject</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton, busy && styles.actionButtonDisabled]}
                onPress={() => approve(item)}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveButtonText}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#999" },
  card: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardPlan: { fontSize: 16, fontWeight: "700", textTransform: "capitalize" },
  cardMethod: { fontSize: 12, color: "#229ED9", fontWeight: "600" },
  cardLine: { fontSize: 14, color: "#333", marginBottom: 2 },
  cardDate: { fontSize: 12, color: "#999", marginBottom: 8 },
  screenshot: { width: "100%", height: 180, borderRadius: 8, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  actionButtonDisabled: { opacity: 0.6 },
  rejectButton: { borderWidth: 1, borderColor: "#c0392b" },
  rejectButtonText: { color: "#c0392b", fontWeight: "600" },
  approveButton: { backgroundColor: "#2e7d32" },
  approveButtonText: { color: "#fff", fontWeight: "600" },
});
