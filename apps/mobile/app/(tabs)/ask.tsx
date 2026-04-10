import type {
  DiagnosticAssistantTurn,
  DiagnosticCase,
  DiagnosticCaseState,
  DiagnosticMessage,
  DiagnosticTurnRequest,
  Lawn,
  ProductRecommendation,
  RecommendationSet,
  SensorReading,
  UploadedCaseImage,
  Zone
} from "@lawnpal/core";
import { generateProductRecommendationsForCase } from "@lawnpal/core";
import { MaterialIcons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { InputField } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatRelativeTimestamp } from "@/lib/format";
import { aiAskService } from "@/services/aiAskService";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, radius, spacing } from "@/theme";

type ConversationMessage =
  | { id: string; role: "user"; createdAt: string; text: string; images: UploadedCaseImage[]; status: "complete" }
  | {
      id: string;
      role: "assistant";
      createdAt: string;
      assistantTurn?: DiagnosticAssistantTurn;
      text?: string;
      status: "complete" | "pending" | "error";
    };

const MESSAGE_REORDER_WINDOW_MS = 45_000;

const normalizeConversationOrder = (messages: DiagnosticMessage[]): DiagnosticMessage[] => {
  const ordered = [...messages].sort((left, right) => {
    const timestampComparison = left.createdAt.localeCompare(right.createdAt);

    if (timestampComparison !== 0) {
      return timestampComparison;
    }

    if (left.role === right.role) {
      return 0;
    }

    return left.role === "user" ? -1 : 1;
  });

  let index = 0;

  while (index < ordered.length - 1) {
    const current = ordered[index];
    const next = ordered[index + 1];

    if (!current || !next) {
      break;
    }

    if (current.role === "assistant" && next.role === "user") {
      const previous = index > 0 ? ordered[index - 1] : null;
      const delta = Date.parse(next.createdAt) - Date.parse(current.createdAt);
      const looksLikeBrokenTurn = index === 0 || previous?.role === "assistant";

      if (looksLikeBrokenTurn && Number.isFinite(delta) && delta >= 0 && delta <= MESSAGE_REORDER_WINDOW_MS) {
        ordered[index] = next;
        ordered[index + 1] = current;

        if (index > 0) {
          index -= 1;
          continue;
        }
      }
    }

    index += 1;
  }

  return ordered;
};

const toConversationMessages = (messages: DiagnosticMessage[]): ConversationMessage[] =>
  normalizeConversationOrder(messages).map((message) =>
    message.role === "user"
      ? { id: message.id, role: "user", createdAt: message.createdAt, text: message.text, images: message.images, status: "complete" }
      : { id: message.id, role: "assistant", createdAt: message.createdAt, assistantTurn: message.assistantTurn, status: "complete" }
  );

const createDraftImage = (imageDataUrl: string): UploadedCaseImage => ({
  id: `${Date.now()}_draft`,
  createdAt: new Date().toISOString(),
  label: "general",
  imageDataUrl
});

export default function AskScreen() {
  const router = useRouter();
  const version = useAppStore((state) => state.version);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [primaryLawn, setPrimaryLawn] = useState<Lawn | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [summary, setSummary] = useState<RecommendationSet | null>(null);
  const [activeCase, setActiveCase] = useState<DiagnosticCase | null>(null);
  const [activeState, setActiveState] = useState<DiagnosticCaseState | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [draftImages, setDraftImages] = useState<UploadedCaseImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async (preferredCaseId?: string | null) => {
    const [lawn, zoneList, readingHistory, caseList, latestSummary, storedActiveCaseId] = await Promise.all([
      localRepository.getPrimaryLawn(),
      localRepository.getZones(),
      localRepository.getReadingHistory(60),
      localRepository.listDiagnosticCases(12),
      localRepository.getLatestRecommendationSet(),
      localRepository.getSetting<string | null>("activeDiagnosticCaseId", null)
    ]);

    const targetCaseId = preferredCaseId ?? storedActiveCaseId ?? caseList[0]?.id ?? null;
    setPrimaryLawn(lawn);
    setZones(zoneList);
    setLatestReading(readingHistory[0] ?? null);
    setSummary(latestSummary);

    if (!targetCaseId) {
      setActiveCase(null);
      setActiveState(null);
      setMessages([]);
      return;
    }

    const [caseItem, snapshot, caseMessages] = await Promise.all([
      localRepository.getDiagnosticCase(targetCaseId),
      localRepository.getLatestDiagnosticSnapshot(targetCaseId),
      localRepository.getDiagnosticMessages(targetCaseId)
    ]);

    setActiveCase(caseItem);
    setActiveState(snapshot);
    setMessages(toConversationMessages(caseMessages));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void version;
      void loadData();
    }, [loadData, version])
  );

  const activeZone =
    activeState?.zoneContext ??
    (latestReading ? zones.find((zone) => zone.id === latestReading.zoneId) ?? null : null);

  const askMutation = useMutation({
    mutationFn: async (request: DiagnosticTurnRequest) => aiAskService.ask(request),
    onMutate: (request) => {
      const createdAt = new Date().toISOString();
      setMessages((current) => [
        ...current,
        { id: `${createdAt}_user`, role: "user", createdAt, text: request.userMessage, images: request.images ?? [], status: "complete" },
        { id: `${createdAt}_assistant`, role: "assistant", createdAt, text: "Working the case and narrowing the most likely causes...", status: "pending" }
      ]);
      setQuestion("");
      setDraftImages([]);
      setNotice(null);
      return { createdAt };
    },
    onSuccess: async (response, request, mutationContext) => {
      const createdAt = mutationContext?.createdAt ?? response.assistantTurn.createdAt;
      await localRepository.saveDiagnosticCase(response.case);
      await localRepository.saveDiagnosticSnapshot(response.updatedState);
      await localRepository.saveDiagnosticMessage({
        id: `${createdAt}_user_saved`,
        caseId: response.case.id,
        createdAt,
        role: "user",
        text: request.userMessage,
        replyToQuestionId: request.replyToQuestionId,
        quickReplyValue: request.quickReplyValue,
        images: request.images ?? []
      });
      await localRepository.saveDiagnosticMessage({
        id: `${createdAt}_assistant_saved`,
        caseId: response.case.id,
        createdAt: response.assistantTurn.createdAt,
        role: "assistant",
        assistantTurn: response.assistantTurn
      });
      await localRepository.saveSetting("activeDiagnosticCaseId", response.case.id);
      bumpVersion();
      await loadData(response.case.id);
    },
    onError: (error, _request, mutationContext) => {
      setMessages((current) =>
        current.map((message) =>
          message.role === "assistant" && message.id === `${mutationContext?.createdAt}_assistant`
            ? { ...message, status: "error", text: error.message }
            : message
        )
      );
      setNotice(error.message);
    }
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, base64: true, quality: 0.45 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.base64) {
      return;
    }
    setDraftImages((current) => [...current, createDraftImage(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`)]);
  };

  const submitTurn = async (
    userMessage: string,
    replyToQuestionId?: string,
    quickReplyValue?: string,
    requestedMode?: DiagnosticTurnRequest["requestedMode"]
  ) => {
    if (!userMessage.trim() || askMutation.isPending) {
      return;
    }

    askMutation.mutate({
      caseId: activeCase?.id,
      userMessage: userMessage.trim(),
      replyToQuestionId,
      quickReplyValue,
      images: draftImages.length ? draftImages : undefined,
      zoneContext: activeZone ?? undefined,
      weatherContext: activeState?.weatherContext,
      sensorContext: activeState?.sensorContext ?? latestReading ?? undefined,
      lawnProfile: primaryLawn?.profile,
      requestedMode
    });
  };

  const lastAssistantMessage = [...messages].reverse().find(
    (message) => message.role === "assistant" && Boolean(message.assistantTurn)
  );
  const lastAssistantTurn =
    lastAssistantMessage?.role === "assistant" ? (lastAssistantMessage.assistantTurn ?? null) : null;
  const topHypothesis = activeState?.topHypotheses[0];
  const hasResolvedConfidence = Boolean(
    activeState &&
      activeState.confidence.resolved &&
      activeState.confidence.label === "high" &&
      !activeState.confidence.shouldAskFollowUp
  );
  const settledDiagnosis = Boolean(topHypothesis && hasResolvedConfidence && !lastAssistantTurn?.pendingQuestion);
  const recommendedProducts = useMemo<ProductRecommendation[]>(
    () =>
      settledDiagnosis && activeState && primaryLawn?.profile
        ? generateProductRecommendationsForCase({ caseState: activeState, profile: primaryLawn.profile })
        : [],
    [activeState, primaryLawn, settledDiagnosis]
  );
  const productPreview = recommendedProducts[0] ?? null;
  const summaryLead =
    topHypothesis?.evidenceFor[0] ??
    lastAssistantTurn?.supportingPoints[0] ??
    lastAssistantTurn?.reasoning[0] ??
    lastAssistantTurn?.confidenceNote ??
    "Add one more detail or photo so LawnPal can tighten the diagnosis.";
  const summaryHint = settledDiagnosis
    ? activeState?.currentActionPlan.doNow[0] ?? lastAssistantTurn?.doNow[0] ?? null
    : lastAssistantTurn?.pendingQuestion?.text ??
      activeState?.recommendedNextQuestions[0]?.text ??
      "Recovery steps and products will unlock once the diagnosis is resolved with high confidence.";

  return (
    <AppScreen contentContainerStyle={styles.screenContent} navKey="ask" scroll={false}>
      <View style={styles.contextStrip}>
        {activeState?.weatherContext ? (
          <View style={styles.contextPill}>
            <MaterialIcons color={palette.secondary} name="wb-sunny" size={14} />
            <Text style={styles.contextText}>
              {activeState.weatherContext.current.summary}, {Math.round(activeState.weatherContext.current.temperatureC)} C
            </Text>
          </View>
        ) : null}
        {latestReading ? (
          <View style={styles.contextPill}>
            <MaterialIcons color={palette.secondary} name="schedule" size={14} />
            <Text style={styles.contextText}>{formatRelativeTimestamp(latestReading.takenAt).replace("Updated ", "Last reading ")}</Text>
          </View>
        ) : null}
        {activeState?.sensorContext ? (
          <View style={styles.contextPill}>
            <MaterialIcons color={palette.secondary} name="water-drop" size={14} />
            <Text style={styles.contextText}>Soil: {Math.round(activeState.sensorContext.metrics.moisture)}% moist</Text>
          </View>
        ) : null}
      </View>

      {topHypothesis ? (
        <SurfaceBlock tone="raised">
          <SectionEyebrow tone={settledDiagnosis ? "positive" : "muted"}>
            {settledDiagnosis ? "Current Read" : "Working Diagnosis"}
          </SectionEyebrow>
          <Text style={styles.summaryTitle}>{topHypothesis.label}</Text>
          <Text style={styles.summaryBody}>{summaryLead}</Text>
          {summaryHint ? (
            <Text style={styles.summaryHint}>
              {settledDiagnosis ? `Start here: ${summaryHint}` : `Next: ${summaryHint}`}
            </Text>
          ) : null}
          {settledDiagnosis ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() =>
                  void submitTurn(
                    "Build me a recovery plan for this case.",
                    undefined,
                    undefined,
                    "recovery-plan"
                  )
                }
                style={styles.actionChip}
              >
                <Text style={styles.actionChipText}>Build recovery plan</Text>
              </Pressable>
              {productPreview ? (
                <Pressable
                  onPress={() => router.push(activeCase?.id ? `/products?caseId=${activeCase.id}` : "/products")}
                  style={styles.actionChip}
                >
                  <Text style={styles.actionChipText}>Recommend products</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {productPreview ? (
            <View style={styles.productCard}>
              <View style={styles.productThumb}>
                <Text style={styles.productThumbText}>{productPreview.title.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.productCopy}>
                <SectionEyebrow tone="positive">Matching Product</SectionEyebrow>
                <Text style={styles.productTitle}>{productPreview.title}</Text>
                <Text style={styles.productMeta}>{productPreview.why}</Text>
              </View>
            </View>
          ) : null}
          {summary ? <Text style={styles.metaText}>Latest scan: {summary.mainIssue}</Text> : null}
        </SurfaceBlock>
      ) : null}

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        style={styles.thread}
      >
        {messages.length === 0 ? (
          <SurfaceBlock tone="raised">
            <SectionEyebrow>Start With Evidence</SectionEyebrow>
            <Text style={styles.emptyTitle}>No conversation yet</Text>
            <Text style={styles.emptyText}>
              Send one clear question and a photo if you have one. The design is tuned for diagnosis, not generic chat.
            </Text>
          </SurfaceBlock>
        ) : null}
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageWrap,
              message.role === "user" ? styles.messageWrapUser : styles.messageWrapAssistant
            ]}
          >
            {message.role === "user" ? (
              <View style={styles.userBlock}>
                {message.images.map((image) => (
                  <Image key={image.id} source={{ uri: image.imageDataUrl }} style={styles.userImage} />
                ))}
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{message.text}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.assistantBubble}>
                <View style={styles.assistantHeader}>
                  <View style={styles.assistantAvatar}>
                    <MaterialIcons color={palette.white} name="auto-awesome" size={16} />
                  </View>
                  <Text style={styles.assistantLabel}>Environmental Intelligence</Text>
                </View>
                {message.status === "pending" ? (
                  <View style={styles.pendingRow}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.assistantText}>{message.text}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.assistantVerdict, message.status === "error" && styles.assistantVerdictError]}>
                      {message.assistantTurn?.message ?? message.assistantTurn?.verdict ?? message.text}
                    </Text>
                    {message.assistantTurn?.pendingQuestion ? (
                      <View style={styles.questionBlock}>
                        <SectionEyebrow>Next Question</SectionEyebrow>
                        <Text style={styles.assistantText}>{message.assistantTurn.pendingQuestion.text}</Text>
                        <View style={styles.quickReplyWrap}>
                          {message.assistantTurn.pendingQuestion.quickReplies.map((reply) => (
                            <Pressable
                              key={reply.id}
                              onPress={() =>
                                void submitTurn(reply.label, message.assistantTurn?.pendingQuestion?.id, reply.value)
                              }
                              style={styles.quickReply}
                            >
                              <Text style={styles.quickReplyText}>{reply.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {draftImages.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.draftStrip}>
          {draftImages.map((image) => (
            <Image key={image.id} source={{ uri: image.imageDataUrl }} style={styles.draftImage} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.composerRow}>
        <Pressable onPress={() => void pickImage()} style={styles.composerIconButton}>
          <MaterialIcons color={palette.primary} name="add-photo-alternate" size={22} />
        </Pressable>
        <View style={styles.composerInputWrap}>
          <InputField multiline onChangeText={setQuestion} placeholder="Ask about your lawn health..." value={question} />
        </View>
        <Pressable
          disabled={askMutation.isPending || question.trim().length < 3}
          onPress={() => void submitTurn(question)}
          style={[
            styles.sendButton,
            (askMutation.isPending || question.trim().length < 3) && styles.sendButtonDisabled
          ]}
        >
          <MaterialIcons color={palette.white} name="north" size={22} />
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0
  },
  contextStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: palette.surfaceLow,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  contextText: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  thread: {
    flex: 1
  },
  threadContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg
  },
  emptyTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 24
  },
  emptyText: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  summaryTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 24
  },
  summaryBody: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 24
  },
  summaryHint: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  messageWrap: {
    width: "100%"
  },
  messageWrapUser: {
    alignItems: "flex-end"
  },
  messageWrapAssistant: {
    alignItems: "flex-start"
  },
  userBlock: {
    width: "86%",
    gap: spacing.sm,
    alignItems: "flex-end"
  },
  userImage: {
    width: "100%",
    height: 190,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceHigh
  },
  userBubble: {
    backgroundColor: palette.secondary,
    borderRadius: radius.xl,
    borderTopRightRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  userText: {
    color: palette.white,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  assistantBubble: {
    width: "100%",
    backgroundColor: palette.surfaceLow,
    borderRadius: 28,
    borderTopLeftRadius: 8,
    padding: spacing.lg,
    gap: spacing.md
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  assistantLabel: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 13
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  assistantVerdict: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    lineHeight: 27
  },
  assistantVerdictError: {
    color: palette.danger
  },
  assistantText: {
    color: palette.primary,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  questionBlock: {
    gap: spacing.sm
  },
  quickReplyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickReply: {
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.18)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickReplyText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  metaText: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  actionChip: {
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionChipText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  productCard: {
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.primaryContainer,
    padding: spacing.md
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  productThumbText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 20
  },
  productCopy: {
    flex: 1,
    gap: spacing.xs
  },
  productTitle: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 15
  },
  productMeta: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 14
  },
  noticeText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 18
  },
  draftStrip: {
    maxHeight: 80
  },
  draftImage: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    backgroundColor: palette.surfaceHigh
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  composerIconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceLow,
    alignItems: "center",
    justifyContent: "center"
  },
  composerInputWrap: {
    flex: 1
  },
  sendButton: {
    width: 48,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    opacity: 0.4
  }
});
