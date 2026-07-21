import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ApiError } from "../api/client";
import { paymentsApi } from "../api/payments";
import { PaymentMethod, PaymentPlanKind, PaymentSubmission, PlansResponse } from "../types";

const PLACEHOLDER = "TODO_FILL_IN";
const isPlaceholder = (value: string) => value === PLACEHOLDER;

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "telebirr", label: "Telebirr" },
  { value: "cbe", label: "CBE" },
  { value: "awash", label: "Awash" },
];

const STATUS_COLORS: Record<PaymentSubmission["status"], string> = {
  pending: "#856404",
  approved: "#2e7d32",
  rejected: "#c0392b",
};

export default function UpgradeScreen() {
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [plan, setPlan] = useState<PaymentPlanKind>("monthly");
  const [method, setMethod] = useState<PaymentMethod>("telebirr");
  const [senderName, setSenderName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [pickedAsset, setPickedAsset] = useState<{ uri: string; mimeType: string } | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [plansData, submissionsData] = await Promise.all([paymentsApi.getPlans(), paymentsApi.mySubmissions()]);
    setPlans(plansData);
    setSubmissions(submissionsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadAsset = async (asset: { uri: string; mimeType: string }) => {
    setUploadingScreenshot(true);
    setScreenshotError(null);
    try {
      const { url } = await paymentsApi.uploadScreenshot(asset.uri, asset.mimeType);
      setScreenshotUrl(url);
    } catch (err) {
      // Keep the picked image and its info around so the user can retry without
      // re-picking - most failures here are transient network issues, not a
      // problem with the image itself.
      const message = err instanceof ApiError ? err.message : "Could not upload screenshot";
      console.error("Screenshot upload failed:", err);
      setScreenshotError(message);
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach a screenshot.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets[0];
    const asset = {
      uri: picked.uri,
      mimeType: picked.mimeType || "image/jpeg",
    };
    setPickedAsset(asset);
    setScreenshotUrl(null);
    await uploadAsset(asset);
  };

  const retryUpload = () => {
    if (pickedAsset) uploadAsset(pickedAsset);
  };

  const submit = async () => {
    if (!senderName.trim() || !transactionId.trim()) {
      Alert.alert("Missing info", "Enter the sender name and transaction ID.");
      return;
    }
    setSubmitting(true);
    try {
      await paymentsApi.createSubmission({
        plan,
        method,
        sender_name: senderName.trim(),
        transaction_id: transactionId.trim(),
        screenshot_url: screenshotUrl ?? undefined,
      });
      setSenderName("");
      setTransactionId("");
      setPickedAsset(null);
      setScreenshotUrl(null);
      setScreenshotError(null);
      Alert.alert("Submitted", "We'll review your payment and activate your plan shortly.");
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not submit payment";
      Alert.alert("Something went wrong", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !plans) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const accountValue =
    method === "telebirr"
      ? plans.payment_details.telebirr_number
      : method === "cbe"
      ? plans.payment_details.cbe_account
      : plans.payment_details.awash_account;
  const accountNotReady = isPlaceholder(accountValue);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Upgrade</Text>

      <View style={styles.planRow}>
        <TouchableOpacity
          style={[styles.planCard, plan === "monthly" && styles.planCardActive]}
          onPress={() => setPlan("monthly")}
        >
          <Text style={styles.planTitle}>Monthly</Text>
          <Text style={styles.planPrice}>{plans.price_monthly_birr} birr</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.planCard, plan === "yearly" && styles.planCardActive]}
          onPress={() => setPlan("yearly")}
        >
          <Text style={styles.planTitle}>Yearly</Text>
          <Text style={styles.planPrice}>{plans.price_yearly_birr} birr</Text>
          <Text style={styles.planNote}>2 months free</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Pay via</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.methodChip, method === m.value && styles.methodChipActive]}
            onPress={() => setMethod(m.value)}
          >
            <Text style={[styles.methodChipText, method === m.value && styles.methodChipTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.detailsBox}>
        {accountNotReady ? (
          <Text style={styles.detailsPending}>Payment details for {method.toUpperCase()} are being set up - check back soon.</Text>
        ) : method === "telebirr" ? (
          <>
            <Text style={styles.detailsLine}>Telebirr: {plans.payment_details.telebirr_number}</Text>
            <Text style={styles.detailsLine}>Name: {plans.payment_details.telebirr_name}</Text>
          </>
        ) : (
          <Text style={styles.detailsLine}>Account: {accountValue}</Text>
        )}
      </View>

      <Text style={styles.instructions}>
        Send the amount above using your own {method.toUpperCase()} app, then fill in the details below so we can confirm it.
      </Text>

      <Text style={styles.label}>Your name (as sent)</Text>
      <TextInput style={styles.input} value={senderName} onChangeText={setSenderName} placeholder="e.g. Abebe Kebede" />

      <Text style={styles.label}>Transaction ID</Text>
      <TextInput style={styles.input} value={transactionId} onChangeText={setTransactionId} placeholder="From your payment receipt" />

      <Text style={styles.label}>Screenshot (optional)</Text>
      <TouchableOpacity style={styles.screenshotButton} onPress={pickScreenshot} disabled={uploadingScreenshot}>
        {uploadingScreenshot ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.screenshotButtonText}>{pickedAsset ? "Change screenshot" : "Attach screenshot"}</Text>
        )}
      </TouchableOpacity>
      {pickedAsset && !uploadingScreenshot && (
        <>
          {screenshotUrl ? (
            <Text style={styles.screenshotStatus}>Uploaded</Text>
          ) : (
            <View>
              <Text style={[styles.screenshotStatus, styles.screenshotError]}>{screenshotError || "Upload failed"}</Text>
              <TouchableOpacity onPress={retryUpload}>
                <Text style={styles.retryText}>Retry upload</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.submitButton, (submitting || uploadingScreenshot) && styles.submitButtonDisabled]}
        onPress={submit}
        disabled={submitting || uploadingScreenshot}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit for review</Text>}
      </TouchableOpacity>

      {submissions.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Your submissions</Text>
          {submissions.map((s) => (
            <View key={s.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyPlan}>
                  {s.plan} - {s.amount} birr
                </Text>
                <Text style={styles.historyDate}>{new Date(s.submitted_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.historyStatus, { color: STATUS_COLORS[s.status] }]}>{s.status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  planRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  planCard: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 16, alignItems: "center" },
  planCardActive: { borderColor: "#229ED9", backgroundColor: "#eaf6fc" },
  planTitle: { fontSize: 14, color: "#666", marginBottom: 4 },
  planPrice: { fontSize: 20, fontWeight: "700" },
  planNote: { fontSize: 12, color: "#2e7d32", marginTop: 4 },
  label: { fontSize: 13, color: "#666", marginBottom: 8, marginTop: 8 },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  methodChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  methodChipActive: { backgroundColor: "#229ED9", borderColor: "#229ED9" },
  methodChipText: { color: "#444" },
  methodChipTextActive: { color: "#fff" },
  detailsBox: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 14, marginBottom: 8 },
  detailsLine: { fontSize: 15, marginBottom: 4 },
  detailsPending: { color: "#856404" },
  instructions: { fontSize: 13, color: "#666", marginVertical: 12 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 4 },
  screenshotButton: {
    borderWidth: 1,
    borderColor: "#229ED9",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  screenshotButtonText: { color: "#229ED9", fontWeight: "600" },
  screenshotStatus: { fontSize: 12, color: "#666", marginTop: 4, textAlign: "center" },
  screenshotError: { color: "#c0392b" },
  retryText: { fontSize: 13, color: "#229ED9", fontWeight: "600", textAlign: "center", marginTop: 4 },
  submitButton: { backgroundColor: "#229ED9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  historySection: { marginTop: 32 },
  historyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  historyPlan: { fontSize: 14, textTransform: "capitalize" },
  historyDate: { fontSize: 12, color: "#999", marginTop: 2 },
  historyStatus: { fontWeight: "600", textTransform: "capitalize" },
});
