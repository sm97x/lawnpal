import type {
  CareEvent,
  CaseReminder,
  DiagnosticAssistantTurn,
  DiagnosticCase,
  DiagnosticCaseState,
  DiagnosticMessage,
  DiagnosticTurnRequest,
  Lawn,
  RecommendationSet,
  SensorReading,
  UploadedCaseImage,
  Zone
} from "@lawnpal/core";
import { buildTrendSummaries, isCoachingHypothesisId, makeId } from "@lawnpal/core";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Body, Button, Card, Chip, Heading, InputField, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { aiAskService } from "@/services/aiAskService";
import { scheduleCaseReminderNotification } from "@/services/notifications";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

type ConversationMessage =
  | {
      id: string;
      role: "user";
      createdAt: string;
      text: string;
      images: UploadedCaseImage[];
      status: "complete";
    }
  | {
      id: string;
      role: "assistant";
      createdAt: string;
      assistantTurn?: DiagnosticAssistantTurn;
      text?: string;
      status: "complete" | "pending" | "error";
    };

const toConversationMessages = (messages: DiagnosticMessage[]): ConversationMessage[] =>
  messages.map((message) =>
    message.role === "user"
      ? {
          id: message.id,
          role: "user",
          createdAt: message.createdAt,
          text: message.text,
          images: message.images,
          status: "complete"
        }
      : {
          id: message.id,
          role: "assistant",
          createdAt: message.createdAt,
          assistantTurn: message.assistantTurn,
          status: "complete"
        }
  );

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));

const buildSiblingZoneInsights = (input: {
  activeZoneId?: string;
  zones: Zone[];
  readings: SensorReading[];
}): string[] => {
  if (!input.activeZoneId) {
    return [];
  }

  const current = input.readings.filter((reading) => reading.zoneId === input.activeZoneId).slice(-3);
  if (!current.length) {
    return [];
  }

  const currentAverage =
    current.reduce((sum, reading) => sum + reading.metrics.moisture, 0) / current.length;

  return input.zones
    .filter((zone) => zone.id !== input.activeZoneId)
    .map((zone) => {
      const zoneReadings = input.readings.filter((reading) => reading.zoneId === zone.id).slice(-3);
      if (!zoneReadings.length) {
        return null;
      }

      const zoneAverage =
        zoneReadings.reduce((sum, reading) => sum + reading.metrics.moisture, 0) /
        zoneReadings.length;

      if (currentAverage - zoneAverage >= 10) {
        return `${zone.name} has recently been drier than this zone.`;
      }

      if (zoneAverage - currentAverage >= 10) {
        return `${zone.name} has recently been wetter than this zone.`;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
};

const createDraftImage = (imageDataUrl: string): UploadedCaseImage => ({
  id: makeId("draft-image"),
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
  const [allReadings, setAllReadings] = useState<SensorReading[]>([]);
  const [cases, setCases] = useState<DiagnosticCase[]>([]);
  const [activeCase, setActiveCase] = useState<DiagnosticCase | null>(null);
  const [activeState, setActiveState] = useState<DiagnosticCaseState | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [draftImages, setDraftImages] = useState<UploadedCaseImage[]>([]);
  const [showCaseList, setShowCaseList] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(
    async (preferredCaseId?: string | null) => {
      const [lawn, zoneList, readingHistory, caseList, latestSummary, storedActiveCaseId] =
        await Promise.all([
          localRepository.getPrimaryLawn(),
          localRepository.getZones(),
          localRepository.getReadingHistory(120),
          localRepository.listDiagnosticCases(20),
          localRepository.getLatestRecommendationSet(),
          localRepository.getSetting<string | null>("activeDiagnosticCaseId", null)
        ]);

      const latest = readingHistory[0] ?? null;
      const targetCaseId = preferredCaseId ?? storedActiveCaseId ?? caseList[0]?.id ?? null;

      setPrimaryLawn(lawn);
      setZones(zoneList);
      setLatestReading(latest);
      setSummary(latestSummary);
      setAllReadings(readingHistory);
      setCases(caseList);

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
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void version;
      let active = true;
      const load = async () => {
        await loadData();
        if (!active) {
          return;
        }
      };

      void load();
      return () => {
        active = false;
      };
    }, [loadData, version])
  );

  const activeZone =
    activeState?.zoneContext ??
    (latestReading ? zones.find((zone) => zone.id === latestReading.zoneId) ?? null : null);

  const trendSummaries = useMemo(() => {
    if (!activeZone) {
      return [];
    }

    return buildTrendSummaries(allReadings, activeZone.id).map((trend) => trend.text);
  }, [activeZone, allReadings]);

  const siblingZoneInsights = useMemo(
    () =>
      buildSiblingZoneInsights({
        activeZoneId: activeZone?.id,
        zones,
        readings: allReadings
      }),
    [activeZone?.id, allReadings, zones]
  );

  const persistResponse = async (
    request: DiagnosticTurnRequest,
    response: Awaited<ReturnType<typeof aiAskService.ask>>,
    context: {
      userMessageId: string;
      assistantMessageId: string;
      createdAt: string;
    }
  ) => {
    await localRepository.saveDiagnosticCase(response.case);
    await localRepository.saveDiagnosticSnapshot(response.updatedState);
    await localRepository.saveDiagnosticMessage({
      id: context.userMessageId,
      caseId: response.case.id,
      createdAt: context.createdAt,
      role: "user",
      text: request.userMessage,
      replyToQuestionId: request.replyToQuestionId,
      quickReplyValue: request.quickReplyValue,
      images: request.images ?? []
    });
    await localRepository.saveDiagnosticMessage({
      id: context.assistantMessageId,
      caseId: response.case.id,
      createdAt: response.assistantTurn.createdAt,
      role: "assistant",
      assistantTurn: response.assistantTurn
    });
    await localRepository.saveSetting("activeDiagnosticCaseId", response.case.id);
  };

  const askMutation = useMutation<
    Awaited<ReturnType<typeof aiAskService.ask>>,
    Error,
    {
      request: DiagnosticTurnRequest;
      context: {
        userMessageId: string;
        assistantMessageId: string;
        createdAt: string;
      };
    }
  >({
    mutationFn: async ({ request }) => aiAskService.ask(request),
    onMutate: ({ request, context }) => {
      setMessages((current) => [
        ...current,
        {
          id: context.userMessageId,
          role: "user",
          createdAt: context.createdAt,
          text: request.userMessage,
          images: request.images ?? [],
          status: "complete"
        },
        {
          id: context.assistantMessageId,
          role: "assistant",
          createdAt: context.createdAt,
          text: "Working the case and narrowing the most likely causes...",
          status: "pending"
        }
      ]);
      setQuestion("");
      setDraftImages([]);
      setReminderNotice(null);
    },
    onSuccess: async (response, variables) => {
      await persistResponse(variables.request, response, variables.context);
      bumpVersion();
      void loadData(response.case.id);
      setShowCaseList(false);
    },
    onError: (error, variables) => {
      setMessages((current) =>
        current.map((message) =>
          message.role === "assistant" && message.id === variables.context.assistantMessageId
            ? {
                ...message,
                text: error.message,
                status: "error"
              }
            : message
        )
      );
    }
  });

  const pickImage = async (mode: "camera" | "library") => {
    const result =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, base64: true, quality: 0.45 })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            base64: true,
            quality: 0.45
          });

    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.base64) {
      return;
    }

    setDraftImages((current) => [
      ...current,
      createDraftImage(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`)
    ]);
  };

  const submitTurn = async (input: {
    userMessage: string;
    requestedMode?: DiagnosticTurnRequest["requestedMode"];
    replyToQuestionId?: string;
    quickReplyValue?: string;
  }) => {
    const trimmed = input.userMessage.trim();
    if (!trimmed || askMutation.isPending) {
      return;
    }

    const careEvents = await localRepository.getCareEvents({
      caseId: activeCase?.id,
      zoneId: activeZone?.id,
      limit: 8
    });

    const request: DiagnosticTurnRequest = {
      caseId: activeCase?.id,
      userMessage: trimmed,
      replyToQuestionId: input.replyToQuestionId,
      quickReplyValue: input.quickReplyValue,
      images: draftImages.length ? draftImages : undefined,
      requestedMode: input.requestedMode ?? "diagnose",
      zoneContext: activeZone ?? undefined,
      weatherContext: activeState?.weatherContext,
      sensorContext: activeState?.sensorContext ?? latestReading ?? undefined,
      lawnProfile: primaryLawn?.profile,
      historyContext: {
        currentCaseState: activeState ?? undefined,
        recentMessages: messages.slice(-8).map((message) => ({
          id: message.id,
          role: message.role,
          text:
            message.role === "user"
              ? message.text
              : message.assistantTurn?.message ??
                message.assistantTurn?.verdict ??
                message.text ??
                "",
          createdAt: message.createdAt
        })),
        recentCaseSummaries: cases.slice(0, 5).map((caseItem) => ({
          caseId: caseItem.id,
          title: caseItem.title,
          issueFamily: caseItem.issueFamily,
          outcome: caseItem.summary
        })),
        zoneTrendSummaries: trendSummaries,
        siblingZoneInsights
      },
      careEvents
    };

    askMutation.mutate({
      request,
      context: {
        userMessageId: makeId("ask-user"),
        assistantMessageId: makeId("ask-assistant"),
        createdAt: new Date().toISOString()
      }
    });
  };

  const handleSetReminder = async () => {
    if (!activeCase || !activeState) {
      return;
    }

    const settings = await localRepository.getSettingsSnapshot();
    const reminder: CaseReminder = {
      id: makeId("case-reminder"),
      caseId: activeCase.id,
      remindAt: activeState.currentActionPlan.recheckAt,
      title: `Re-check ${activeCase.title}`,
      note: activeState.currentActionPlan.watchFor[0] ?? "Check the patch again.",
      status: "pending"
    };

    await localRepository.setCaseReminder(reminder);
    await scheduleCaseReminderNotification(reminder, settings.remindersEnabled);
    setReminderNotice(`Reminder set for ${formatDate(reminder.remindAt)}.`);
  };

  const logCareEvent = async (type: CareEvent["type"], title: string) => {
    const event: CareEvent = {
      id: makeId("care-event"),
      createdAt: new Date().toISOString(),
      caseId: activeCase?.id,
      zoneId: activeZone?.id,
      type,
      title
    };

    await localRepository.saveCareEvent(event);
    bumpVersion();
  };

  const lastAssistantIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .filter((entry) => entry.message.role === "assistant")
    .slice(-1)[0]?.index;
  const currentStage = activeState?.stage ?? activeCase?.stage ?? "intake";
  const currentLikelihoods = activeState?.visibleHypotheses ?? [];
  const topHypothesisId = activeState?.topHypotheses[0]?.id;
  const coachingCase = isCoachingHypothesisId(topHypothesisId);
  const likelihoodLabel = coachingCase ? "Current view" : "Current likelihood";
  const canBuildRecoveryPlan =
    Boolean(activeState) &&
    !coachingCase &&
    ["provisional", "confident", "monitoring"].includes(currentStage);
  const canRecommendProducts =
    (activeState?.productSuggestionCategories.length ?? 0) > 0 ||
    (activeState?.confidence.topScore ?? 0) >= 0.7;
  const canSetReminder = Boolean(activeState) && currentStage !== "intake";
  const canCompareZones = Boolean(activeState) && currentStage !== "intake";

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Heading>Ask Lawn Pal</Heading>
              <Body muted>
                Lawn Pal should narrow when diagnosis is needed, and answer directly when timing advice is enough.
              </Body>
            </View>
            <View style={styles.headerActions}>
              <Button
                label="New case"
                tone="secondary"
                onPress={() =>
                  void localRepository
                    .saveSetting("activeDiagnosticCaseId", null)
                    .then(() => loadData(null))
                }
              />
              <Button
                label={showCaseList ? "Hide cases" : "Open cases"}
                tone="ghost"
                onPress={() => setShowCaseList((current) => !current)}
              />
            </View>
          </View>

          {activeCase ? (
            <>
              <View style={styles.pillRow}>
                <Chip
                  label={currentStage}
                  tone={currentStage === "confident" ? "positive" : "warning"}
                />
                <Chip label={activeCase.issueFamily} />
                {activeZone ? <Chip label={activeZone.name} /> : null}
                {activeState ? <Chip label={activeState.confidence.label} /> : null}
              </View>
              <Subheading>{activeCase.title}</Subheading>
              <Body>{activeCase.summary}</Body>
              <View style={styles.summaryActions}>
                <Button
                  label={showSummary ? "Hide summary" : "Show summary"}
                  tone="ghost"
                  onPress={() => setShowSummary((current) => !current)}
                />
              </View>
              {showSummary ? (
                <View style={styles.summaryPanel}>
                  <Text style={styles.sectionLabel}>{likelihoodLabel}</Text>
                  <View style={styles.likelihoodList}>
                    {currentLikelihoods.map((hypothesis, index) => (
                      <View key={hypothesis.id} style={styles.likelihoodRow}>
                        <Text style={styles.likelihoodLabel}>{hypothesis.label}</Text>
                        <Text style={styles.likelihoodValue}>
                          {hypothesis.percentage}%{" "}
                          {index === 0
                            ? "leading"
                            : hypothesis.kind === "other"
                              ? "other"
                              : "possible"}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.contextRow}>
                    {activeState?.weatherContext ? (
                      <Text style={styles.contextText}>
                        Weather: {activeState.weatherContext.current.summary}
                      </Text>
                    ) : null}
                    {activeState?.sensorContext ? (
                      <Text style={styles.contextText}>
                        Moisture: {Math.round(activeState.sensorContext.metrics.moisture)}%
                      </Text>
                    ) : null}
                    {summary ? (
                      <Text style={styles.contextText}>Plan: {summary.mainIssue}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {reminderNotice ? <Text style={styles.noticeText}>{reminderNotice}</Text> : null}
            </>
          ) : (
            <Body muted>Start a new case with one clear question and a photo if you have one.</Body>
          )}

          {showCaseList ? (
            <View style={styles.caseList}>
              {cases.length ? (
                cases.map((caseItem) => (
                  <Pressable
                    key={caseItem.id}
                    style={[
                      styles.caseListItem,
                      activeCase?.id === caseItem.id && styles.caseListItemActive
                    ]}
                    onPress={() =>
                      void localRepository
                        .saveSetting("activeDiagnosticCaseId", caseItem.id)
                        .then(() => loadData(caseItem.id))
                    }
                  >
                    <Text style={styles.caseListTitle}>{caseItem.title}</Text>
                    <Text style={styles.caseListMeta}>
                      {caseItem.issueFamily} | {formatDate(caseItem.updatedAt)}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Body muted>No saved diagnosis cases yet.</Body>
              )}
            </View>
          ) : null}
        </Card>
        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>No conversation yet</Text>
              <Text style={styles.emptyText}>
                Try a tight case-opening message like: This patch appeared in three days and the
                rest of the lawn looks healthy, plus a clear close photo.
              </Text>
            </Card>
          ) : null}

          {messages.map((message, index) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === "user" ? styles.messageRowUser : styles.messageRowAssistant
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  message.role === "user" ? styles.userBubble : styles.assistantBubble,
                  message.role === "assistant" && message.status === "error" && styles.errorBubble
                ]}
              >
                <Text
                  style={[
                    styles.messageLabel,
                    message.role === "user" ? styles.userMessageLabel : styles.assistantMessageLabel
                  ]}
                >
                  {message.role === "user" ? "You" : "Lawn Pal"}
                </Text>

                {message.role === "user" ? (
                  <>
                    <Text style={styles.userText}>{message.text}</Text>
                    {message.images.map((image) => (
                      <Image key={image.id} source={{ uri: image.imageDataUrl }} style={styles.messageImage} />
                    ))}
                  </>
                ) : message.status === "pending" ? (
                  <View style={styles.pendingRow}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.assistantText}>{message.text}</Text>
                  </View>
                ) : message.status === "error" ? (
                  <Text style={styles.assistantText}>{message.text}</Text>
                ) : message.assistantTurn ? (
                  <>
                    <Text style={styles.assistantVerdict}>
                      {message.assistantTurn.message ?? message.assistantTurn.verdict}
                    </Text>
                    {((message.assistantTurn.supportingPoints ?? []).length
                      ? message.assistantTurn.supportingPoints ?? []
                      : message.assistantTurn.reasoning
                    ).length ? (
                      <View style={styles.section}>
                        {(((message.assistantTurn.supportingPoints ?? []).length
                          ? message.assistantTurn.supportingPoints ?? []
                          : message.assistantTurn.reasoning
                        ) ?? []).map((line) => (
                          <Text key={line} style={styles.assistantText}>
                            - {line}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {((message.assistantTurn.interimAdvice ?? []).length
                      ? message.assistantTurn.interimAdvice ?? []
                      : message.assistantTurn.mode === "question-led"
                        ? []
                        : message.assistantTurn.doNow.slice(0, 2)
                    ).length ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>For now</Text>
                        {(((message.assistantTurn.interimAdvice ?? []).length
                          ? message.assistantTurn.interimAdvice ?? []
                          : message.assistantTurn.doNow.slice(0, 2)
                        ) ?? []).map((line) => (
                          <Text key={line} style={styles.assistantText}>
                            - {line}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {message.assistantTurn.pendingQuestion ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.sectionLabel}>Next question</Text>
                        <Text style={styles.assistantText}>
                          {message.assistantTurn.pendingQuestion.text}
                        </Text>
                        <Text style={styles.metaText}>
                          {message.assistantTurn.pendingQuestion.reason}
                        </Text>
                        <View style={styles.quickReplyWrap}>
                          {message.assistantTurn.pendingQuestion.quickReplies.map((reply) => (
                            <Pressable
                              key={reply.id}
                              style={styles.quickReply}
                              disabled={askMutation.isPending}
                              onPress={() =>
                                void submitTurn({
                                  userMessage: reply.label,
                                  replyToQuestionId: message.assistantTurn?.pendingQuestion?.id,
                                  quickReplyValue: reply.value
                                })
                              }
                            >
                              <Text style={styles.quickReplyText}>{reply.label}</Text>
                            </Pressable>
                          ))}
                          <Pressable
                            style={styles.secondaryReply}
                            disabled={askMutation.isPending}
                            onPress={() =>
                              void submitTurn({
                                userMessage: "Skip this question for now.",
                                replyToQuestionId: message.assistantTurn?.pendingQuestion?.id,
                                quickReplyValue: "skip_pending_question"
                              })
                            }
                          >
                            <Text style={styles.secondaryReplyText}>Skip this question</Text>
                          </Pressable>
                          <Pressable
                            style={styles.secondaryReply}
                            onPress={() => {
                              setQuestion("");
                              scrollRef.current?.scrollToEnd({ animated: true });
                            }}
                          >
                            <Text style={styles.secondaryReplyText}>Answer in my own words</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                    <Text style={styles.metaText}>
                      {message.assistantTurn.confidenceSummary ??
                        message.assistantTurn.confidenceNote}
                    </Text>
                    {message.assistantTurn.mode !== "question-led" ? (
                      <Text style={styles.metaText}>
                        Re-check: {formatDate(message.assistantTurn.recheckAt)}
                      </Text>
                    ) : null}

                    {index === lastAssistantIndex ? (
                      <View style={styles.actionWrap}>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                        >
                          <Text style={styles.actionChipText}>Ask another question</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          disabled={!canBuildRecoveryPlan || askMutation.isPending}
                          onPress={() =>
                            canBuildRecoveryPlan
                              ? void submitTurn({
                                  userMessage: "Build me a recovery plan for this case.",
                                  requestedMode: "recovery-plan"
                                })
                              : undefined
                          }
                        >
                          <Text style={styles.actionChipText}>Build recovery plan</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          disabled={!canRecommendProducts}
                          onPress={() =>
                            canRecommendProducts
                              ? router.push(
                                  activeCase?.id ? `/products?caseId=${activeCase.id}` : "/products"
                                )
                              : undefined
                          }
                        >
                          <Text style={styles.actionChipText}>Recommend products</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          disabled={!canSetReminder}
                          onPress={() => (canSetReminder ? void handleSetReminder() : undefined)}
                        >
                          <Text style={styles.actionChipText}>Set reminder</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          disabled={!canCompareZones || askMutation.isPending}
                          onPress={() =>
                            canCompareZones
                              ? void submitTurn({
                                  userMessage: "Compare this issue with my other zones.",
                                  requestedMode: "compare-zone"
                                })
                              : undefined
                          }
                        >
                          <Text style={styles.actionChipText}>Compare another zone</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          ))}
          <Card>
            <Subheading>Evidence and actions</Subheading>
            <View style={styles.quickReplyWrap}>
              <Pressable
                style={styles.quickReply}
                onPress={() => void logCareEvent("fertiliser", "Applied fertiliser")}
              >
                <Text style={styles.quickReplyText}>Applied feed</Text>
              </Pressable>
              <Pressable
                style={styles.quickReply}
                onPress={() => void logCareEvent("weedkiller", "Applied weedkiller")}
              >
                <Text style={styles.quickReplyText}>Applied weedkiller</Text>
              </Pressable>
              <Pressable
                style={styles.quickReply}
                onPress={() => void logCareEvent("watering", "Watered lawn")}
              >
                <Text style={styles.quickReplyText}>Watered</Text>
              </Pressable>
              <Pressable
                style={styles.quickReply}
                onPress={() => void logCareEvent("mowing", "Mowed lawn")}
              >
                <Text style={styles.quickReplyText}>Mowed</Text>
              </Pressable>
            </View>
            {trendSummaries.length ? (
              <View style={styles.inlineList}>
                {trendSummaries.map((trend) => (
                  <Text key={trend} style={styles.metaText}>
                    - {trend}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>

          <Card>
            <InputField
              value={question}
              onChangeText={setQuestion}
              placeholder="This patch appeared in three days and the rest of the lawn looks healthy."
              multiline
            />
            {draftImages.length ? (
              <View style={styles.draftImages}>
                {draftImages.map((image) => (
                  <Image key={image.id} source={{ uri: image.imageDataUrl }} style={styles.composerPreview} />
                ))}
                <Button label="Clear draft photos" tone="ghost" onPress={() => setDraftImages([])} />
              </View>
            ) : null}
            <View style={styles.composerActions}>
              <Button
                label="Take photo"
                tone="secondary"
                onPress={() => void pickImage("camera")}
                disabled={askMutation.isPending}
              />
              <Button
                label="Choose photo"
                tone="ghost"
                onPress={() => void pickImage("library")}
                disabled={askMutation.isPending}
              />
            </View>
            <Button
              label={askMutation.isPending ? "Working the case..." : "Send to Lawn Pal"}
              onPress={() => void submitTurn({ userMessage: question })}
              disabled={askMutation.isPending || question.trim().length < 3}
            />
          </Card>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md
  },
  headerRow: {
    gap: spacing.sm
  },
  headerCopy: {
    gap: 6
  },
  headerActions: {
    gap: 10
  },
  caseList: {
    gap: 10,
    marginTop: 8
  },
  caseListItem: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 12,
    backgroundColor: palette.surface
  },
  caseListItemActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft
  },
  caseListTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  caseListMeta: {
    color: palette.inkSoft,
    marginTop: 4
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  hypothesisPill: {
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  hypothesisText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  contextRow: {
    gap: 4
  },
  summaryActions: {
    alignItems: "flex-start"
  },
  summaryPanel: {
    gap: 10
  },
  likelihoodList: {
    gap: 8
  },
  likelihoodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border
  },
  likelihoodLabel: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600"
  },
  likelihoodValue: {
    color: palette.inkSoft,
    fontSize: 13
  },
  contextText: {
    color: palette.inkSoft,
    fontSize: 13
  },
  noticeText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "600"
  },
  thread: {
    flex: 1
  },
  threadContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "600"
  },
  emptyText: {
    color: palette.inkSoft,
    fontSize: 15,
    lineHeight: 22
  },
  messageRow: {
    width: "100%"
  },
  messageRowUser: {
    alignItems: "flex-end"
  },
  messageRowAssistant: {
    alignItems: "flex-start"
  },
  bubble: {
    width: "92%",
    borderRadius: 24,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1
  },
  userBubble: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  assistantBubble: {
    backgroundColor: palette.surface,
    borderColor: palette.border
  },
  errorBubble: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoft
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  userMessageLabel: {
    color: "rgba(255, 255, 255, 0.82)"
  },
  assistantMessageLabel: {
    color: palette.inkSoft
  },
  userText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 22
  },
  assistantVerdict: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700"
  },
  assistantText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22
  },
  section: {
    gap: 6
  },
  sectionLabel: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  metaText: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19
  },
  followUpBlock: {
    gap: 6,
    paddingVertical: 4
  },
  questionCard: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted
  },
  quickReplyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickReply: {
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickReplyText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  secondaryReply: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surface
  },
  secondaryReplyText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600"
  },
  actionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surfaceMuted
  },
  actionChipText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600"
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  messageImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted
  },
  draftImages: {
    gap: 10
  },
  composerPreview: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted
  },
  composerActions: {
    gap: 10
  },
  inlineList: {
    gap: 4
  }
});
