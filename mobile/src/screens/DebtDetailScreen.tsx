import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { debtsApi } from "../api/debts";
import { ApiError } from "../api/client";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Debt, DebtHistoryEntry } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "DebtDetail">;

// t.me/+<phone> opens a direct chat by phone lookup - no bot involved, no prior
// opt-in needed from the debtor. Telegram only accepts digits after the "+".
function buildTelegramLink(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://t.me/+${digits}`;
}

function buildReminderMessage(debt: Debt): string {
  const amount = parseFloat(debt.amount).toFixed(2);
  return `Hi ${debt.counterparty_name}, this is a reminder that you owe ${amount} birr. Please reach out to arrange payment. Thank you!`;
}

export default function DebtDetailScreen({ route, navigation }: Props) {
  const { debt: initialDebt } = route.params;
  const [debt, setDebt] = useState<Debt>(initialDebt);
  const [history, setHistory] = useState<DebtHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState(initialDebt.amount);
  const [savingAmount, setSavingAmount] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Both the initial mount fetch and every post-edit refetch call this same
  // function. A monotonically increasing request id guards against an older,
  // slower request resolving after a newer one and clobbering fresher history
  // with stale (or empty) data - a real race that can happen whenever the
  // backend's first request after a cold start/restart is slower than usual.
  const historyRequestId = useRef(0);

  const loadHistory = useCallback(async (debtId: string) => {
    const requestId = ++historyRequestId.current;
    try {
      const result = await debtsApi.history(debtId);
      if (requestId === historyRequestId.current) {
        setHistory(result);
      }
    } finally {
      if (requestId === historyRequestId.current) {
        setLoadingHistory(false);
      }
    }
  }, []);

  useEffect(() => {
    loadHistory(debt.id);
  }, [debt.id, loadHistory]);

  const saveAmount = async () => {
    const parsed = parseFloat(amountInput);
    if (!parsed || parsed <= 0) {
      Alert.alert("Enter an amount", "Amount must be greater than zero.");
      return;
    }
    setSavingAmount(true);
    try {
      const updated = await debtsApi.update(debt.id, { amount: parsed });
      setDebt(updated);
      setEditingAmount(false);
      await loadHistory(debt.id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update the amount";
      Alert.alert("Something went wrong", message);
    } finally {
      setSavingAmount(false);
    }
  };

  const toggleStatus = async () => {
    const nextStatus = debt.status === "owed" ? "paid" : "owed";
    setTogglingStatus(true);
    try {
      const updated = await debtsApi.update(debt.id, { status: nextStatus });
      setDebt(updated);
      await loadHistory(debt.id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update the status";
      Alert.alert("Something went wrong", message);
    } finally {
      setTogglingStatus(false);
    }
  };

  const copyReminder = async () => {
    await Clipboard.setStringAsync(buildReminderMessage(debt));
    Alert.alert("Copied", "Reminder message copied - paste it anywhere (Telegram, SMS, WhatsApp).");
  };

  const openTelegramChat = async () => {
    if (!debt.counterparty_phone) return;
    const link = buildTelegramLink(debt.counterparty_phone);
    if (!link) return;
    try {
      // Telegram doesn't support a ?text= prefill parameter on phone-number deep
      // links (only bot ?start= links and the /share/url endpoint support that) -
      // confirmed via Telegram's own deep-linking docs, not just assumed. So we
      // open a bare chat and rely on the Copy button above for the message text.
      await Linking.openURL(link);
    } catch {
      // Most likely cause: the debtor's Telegram privacy setting blocks being
      // found by phone number, or their number doesn't match what's on file.
      Alert.alert(
        "Couldn't open Telegram chat",
        "This can happen if the debtor's privacy settings block phone lookup, or the number doesn't match their Telegram account. Use the copied message to reach them another way instead."
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{debt.counterparty_name}</Text>
      {debt.counterparty_phone && <Text style={styles.phone}>{debt.counterparty_phone}</Text>}

      <View style={styles.amountRow}>
        {editingAmount ? (
          <>
            <TextInput
              style={styles.amountInput}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.smallButton} onPress={saveAmount} disabled={savingAmount}>
              {savingAmount ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallButtonText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallButton, styles.smallButtonMuted]}
              onPress={() => {
                setAmountInput(debt.amount);
                setEditingAmount(false);
              }}
            >
              <Text style={styles.smallButtonMutedText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.amountValue}>{parseFloat(debt.amount).toFixed(2)} birr</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => setEditingAmount(true)}>
              <Text style={styles.smallButtonText}>Edit</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={[styles.statusBadge, debt.status === "paid" ? styles.statusBadgePaid : styles.statusBadgeOwed]}>
        <Text style={styles.statusBadgeText}>{debt.status === "paid" ? "Paid" : "Still owed"}</Text>
      </View>

      <TouchableOpacity style={styles.statusButton} onPress={toggleStatus} disabled={togglingStatus}>
        {togglingStatus ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.statusButtonText}>{debt.status === "owed" ? "Mark as paid" : "Mark as owed again"}</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Send a reminder</Text>
      <View style={styles.reminderBox}>
        <Text style={styles.reminderText}>{buildReminderMessage(debt)}</Text>
        <View style={styles.reminderButtonRow}>
          <TouchableOpacity style={styles.copyButton} onPress={copyReminder}>
            <Text style={styles.copyButtonText}>Copy message</Text>
          </TouchableOpacity>
          {debt.counterparty_phone && (
            <TouchableOpacity style={styles.openButton} onPress={openTelegramChat}>
              <Text style={styles.openButtonText}>Open Telegram chat</Text>
            </TouchableOpacity>
          )}
        </View>
        {!debt.counterparty_phone && (
          <Text style={styles.reminderHint}>No phone number on file - copy the message and send it manually.</Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>History</Text>
      {loadingHistory ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : history.length === 0 ? (
        <Text style={styles.emptyText}>No changes yet - this debt is exactly as it was created.</Text>
      ) : (
        history.map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <Text style={styles.historyText}>
              {entry.field_changed === "amount" ? "Amount" : "Status"} changed from{" "}
              <Text style={styles.historyValue}>{entry.old_value}</Text> to <Text style={styles.historyValue}>{entry.new_value}</Text>
            </Text>
            <Text style={styles.historyTime}>{new Date(entry.changed_at).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  name: { fontSize: 22, fontWeight: "700" },
  phone: { fontSize: 14, color: "#666", marginTop: 2 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  amountValue: { fontSize: 28, fontWeight: "700", flex: 1 },
  amountInput: { fontSize: 28, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: "#ddd", flex: 1, paddingVertical: 4 },
  smallButton: { backgroundColor: "#229ED9", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  smallButtonText: { color: "#fff", fontWeight: "600" },
  smallButtonMuted: { backgroundColor: "#eee" },
  smallButtonMutedText: { color: "#555", fontWeight: "600" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  statusBadgeOwed: { backgroundColor: "#fff3cd" },
  statusBadgePaid: { backgroundColor: "#e3f2e6" },
  statusBadgeText: { fontSize: 13, fontWeight: "600", color: "#555" },
  statusButton: { backgroundColor: "#2e7d32", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  statusButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sectionLabel: { fontSize: 13, color: "#666", marginTop: 28, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  reminderBox: { backgroundColor: "#f5f5f5", borderRadius: 12, padding: 14 },
  reminderText: { fontSize: 14, color: "#333", lineHeight: 20 },
  reminderButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  copyButton: { flex: 1, backgroundColor: "#229ED9", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  copyButtonText: { color: "#fff", fontWeight: "600" },
  openButton: { flex: 1, borderWidth: 1, borderColor: "#229ED9", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  openButtonText: { color: "#229ED9", fontWeight: "600" },
  reminderHint: { fontSize: 12, color: "#999", marginTop: 10 },
  historyRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e0e0e0" },
  historyText: { fontSize: 14, color: "#333" },
  historyValue: { fontWeight: "700" },
  historyTime: { fontSize: 12, color: "#999", marginTop: 2 },
  emptyText: { color: "#999" },
});
