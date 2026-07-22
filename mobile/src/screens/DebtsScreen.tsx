import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { debtsApi } from "../api/debts";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Debt, DebtStatus } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Debts">;

type FilterOption = DebtStatus | "all";

export default function DebtsScreen({ navigation }: Props) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [filter, setFilter] = useState<FilterOption>("owed");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (activeFilter: FilterOption) => {
    try {
      const result = await debtsApi.list(activeFilter === "all" ? undefined : activeFilter);
      setDebts(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(filter);
  };

  const totalOwed = React.useMemo(
    () => debts.filter((d) => d.status === "owed").reduce((sum, d) => sum + parseFloat(d.amount), 0),
    [debts]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(["owed", "paid", "all"] as FilterOption[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === "owed" ? "Owed" : f === "paid" ? "Paid" : "All"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filter === "owed" && debts.length > 0 && (
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total owed to you</Text>
          <Text style={styles.totalValue}>{totalOwed.toFixed(2)} birr</Text>
        </View>
      )}

      <FlatList
        data={debts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={debts.length ? undefined : styles.emptyList}
        ListEmptyComponent={<Text style={styles.emptyText}>No debts here yet.</Text>}
        renderItem={({ item }: { item: Debt }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("DebtDetail", { debt: item })}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{item.counterparty_name}</Text>
              <Text style={styles.rowTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>{parseFloat(item.amount).toFixed(2)}</Text>
              <View style={[styles.statusBadge, item.status === "paid" ? styles.statusBadgePaid : styles.statusBadgeOwed]}>
                <Text style={styles.statusBadgeText}>{item.status === "paid" ? "Paid" : "Owed"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 16 },
  filterChip: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  filterChipActive: { backgroundColor: "#229ED9" },
  filterChipText: { fontWeight: "600", color: "#555" },
  filterChipTextActive: { color: "#fff" },
  totalBox: { backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16, marginBottom: 12 },
  totalLabel: { color: "#666", marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: "700", color: "#c0392b" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowLeft: {},
  rowName: { fontSize: 16, fontWeight: "600" },
  rowTime: { fontSize: 12, color: "#999", marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 16, fontWeight: "600" },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  statusBadgeOwed: { backgroundColor: "#fff3cd" },
  statusBadgePaid: { backgroundColor: "#e3f2e6" },
  statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#555" },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#999" },
});
