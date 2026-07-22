import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ApiError } from "../api/client";
import { categoriesApi, transactionsApi } from "../api/transactions";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Category, TransactionType } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "AddTransaction">;

export default function AddTransactionScreen({ navigation }: Props) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyPhone, setCounterpartyPhone] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .finally(() => setLoadingCategories(false));
  }, []);

  const visibleCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    // Reset the selected category if it no longer matches income/expense.
    if (categoryId && !visibleCategories.some((c) => c.id === categoryId)) {
      setCategoryId(null);
    }
  }, [type, categoryId, visibleCategories]);

  const submit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Enter an amount", "Amount must be greater than zero.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Pick a category", "Choose a category before saving.");
      return;
    }
    if (isCredit && !counterpartyName.trim()) {
      Alert.alert("Who owes this?", "Enter the debtor's name to track this as a debt.");
      return;
    }

    setSubmitting(true);
    try {
      await transactionsApi.create({
        amount: parsedAmount,
        type,
        category_id: categoryId,
        note: note.trim() || undefined,
        is_credit: isCredit,
        counterparty_name: isCredit ? counterpartyName.trim() : undefined,
        counterparty_phone: isCredit && counterpartyPhone.trim() ? counterpartyPhone.trim() : undefined,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save the transaction";
      Alert.alert(err instanceof ApiError && err.status === 402 ? "Free plan limit reached" : "Something went wrong", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.typeToggle}>
        {(["expense", "income"] as TransactionType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeButton, type === t && styles.typeButtonActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
              {t === "expense" ? "Expense" : "Income"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.amountInput}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus
      />

      <Text style={styles.label}>Category</Text>
      {loadingCategories ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.categoryGrid}>
          {visibleCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, categoryId === cat.id && styles.categoryChipActive]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.categoryChipText, categoryId === cat.id && styles.categoryChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="e.g. lunch with a client" />

      <View style={styles.creditRow}>
        <Text style={styles.label}>Mark as credit / unpaid</Text>
        <Switch value={isCredit} onValueChange={setIsCredit} />
      </View>

      {isCredit && (
        <View style={styles.debtorBox}>
          <Text style={styles.label}>Debtor name</Text>
          <TextInput
            style={styles.noteInput}
            value={counterpartyName}
            onChangeText={setCounterpartyName}
            placeholder="e.g. Almaz"
          />
          <Text style={styles.label}>Debtor phone (optional, for reminders)</Text>
          <TextInput
            style={styles.noteInput}
            value={counterpartyPhone}
            onChangeText={setCounterpartyPhone}
            placeholder="e.g. +2519xxxxxxxx"
            keyboardType="phone-pad"
          />
        </View>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  typeToggle: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 24 },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  typeButtonActive: { backgroundColor: "#229ED9" },
  typeButtonText: { fontWeight: "600", color: "#555" },
  typeButtonTextActive: { color: "#fff" },
  label: { fontSize: 13, color: "#666", marginBottom: 8, marginTop: 8 },
  amountInput: { fontSize: 32, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 8, marginBottom: 8 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  categoryChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  categoryChipActive: { backgroundColor: "#229ED9", borderColor: "#229ED9" },
  categoryChipText: { color: "#444" },
  categoryChipTextActive: { color: "#fff" },
  noteInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 8 },
  creditRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  debtorBox: { marginTop: 8 },
  saveButton: { backgroundColor: "#229ED9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 32 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
