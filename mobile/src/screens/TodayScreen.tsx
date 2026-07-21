import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { transactionsApi } from "../api/transactions";
import { RootStackParamList } from "../navigation/RootNavigator";
import { TodayResponse, Transaction } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Today">;

export default function TodayScreen({ navigation }: Props) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const today = await transactionsApi.today();
      setData(today);
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

  const totals = React.useMemo(() => {
    if (!data) return { income: 0, expense: 0 };
    return data.transactions.reduce(
      (acc, t) => {
        const amount = parseFloat(t.amount);
        if (t.type === "income") acc.income += amount;
        else acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [data]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: "#2e7d32" }]}>+{totals.income.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Expense</Text>
          <Text style={[styles.summaryValue, { color: "#c0392b" }]}>-{totals.expense.toFixed(2)}</Text>
        </View>
      </View>

      {data?.is_free_tier && (
        <View style={styles.capBanner}>
          <Text style={styles.capBannerText}>
            {data.count_today}/{data.free_daily_cap} free transactions used today
            {data.cap_reached ? " - upgrade to add more" : ""}
          </Text>
        </View>
      )}

      <FlatList
        data={data?.transactions ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={data?.transactions.length ? undefined : styles.emptyList}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet today.</Text>}
        renderItem={({ item }: { item: Transaction }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.rowNote}>{item.note || (item.type === "income" ? "Income" : "Expense")}</Text>
              <Text style={styles.rowTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: item.type === "income" ? "#2e7d32" : "#c0392b" }]}>
              {item.type === "income" ? "+" : "-"}
              {parseFloat(item.amount).toFixed(2)}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, data?.cap_reached ? styles.fabDisabled : undefined]}
        onPress={() => navigation.navigate("AddTransaction")}
        disabled={data?.cap_reached}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryBox: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 },
  summaryLabel: { color: "#666", marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: "700" },
  capBanner: { backgroundColor: "#fff3cd", borderRadius: 8, padding: 10, marginBottom: 12 },
  capBannerText: { color: "#856404", fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowNote: { fontSize: 16 },
  rowTime: { fontSize: 12, color: "#999", marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: "600" },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#999" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#229ED9",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  fabDisabled: { backgroundColor: "#aaa" },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
});
