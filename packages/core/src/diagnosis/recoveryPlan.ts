import type {
  DiagnosticCase,
  DiagnosticCaseState,
  RecoveryPlan,
  RecoveryPlanStep,
  RecoveryPlanWindow
} from "../types";
import { makeId } from "../utils/id";
import { getDiagnosticPlaybook } from "./playbooks";

const makeStep = (title: string, reason: string, dayLabel: string, avoid = false): RecoveryPlanStep => ({
  id: makeId("plan-step"),
  title,
  reason,
  dayLabel,
  avoid
});

const uniqueWindows = (windows: RecoveryPlanWindow[]): RecoveryPlanWindow[] =>
  windows
    .map((window) => ({
      ...window,
      steps: window.steps.filter(
        (step, index, all) => all.findIndex((other) => other.title === step.title) === index
      )
    }))
    .filter((window) => window.steps.length > 0);

export const generateRecoveryPlan = (input: {
  caseItem: DiagnosticCase;
  state: DiagnosticCaseState;
  now: string;
}): RecoveryPlan | undefined => {
  if (!input.state.topHypotheses.length) {
    return undefined;
  }

  const top = input.state.topHypotheses[0]!;
  const playbook = getDiagnosticPlaybook(top.id);
  if (!playbook) {
    return undefined;
  }

  const windows: RecoveryPlanWindow[] = [
    {
      title: "3-day",
      steps: [
        ...input.state.currentActionPlan.doNow.map((item) =>
          makeStep(item, `Immediate action for ${top.label.toLowerCase()}.`, "Today")
        ),
        ...input.state.currentActionPlan.avoid.map((item) =>
          makeStep(item, "Avoid this while the picture is still narrowing.", "Today", true)
        )
      ]
    },
    {
      title: "7-day",
      steps: [
        makeStep(
          `Re-check the patch by ${new Date(input.state.currentActionPlan.recheckAt).toLocaleDateString("en-GB")}`,
          "A short interval re-check is the best way to confirm whether the leading hypothesis still fits.",
          "This week"
        ),
        ...playbook.immediateActions.slice(0, 2).map((item) =>
          makeStep(item, "This remains the most sensible short-term management step.", "This week")
        ),
        ...input.state.currentActionPlan.watchFor.slice(0, 2).map((item) =>
          makeStep(item, "If this appears, the diagnosis or urgency changes.", "This week")
        )
      ]
    }
  ];

  if (input.state.confidence.label === "high" || input.state.currentIntent === "recovery-plan") {
    windows.push({
      title: "30-day",
      steps: [
        makeStep(
          "Review whether the patch is filling back in or needs repair.",
          "Longer-term repair only makes sense once the underlying cause has stabilised.",
          "This month"
        ),
        ...playbook.productCategoriesIfConfirmed.slice(0, 2).map((category) =>
          makeStep(
            `Consider ${category.replace("-", " ")} support if recovery stalls.`,
            "Product categories are only worth using once the diagnosis is reasonably settled.",
            "This month"
          )
        )
      ]
    });
  }

  return {
    caseId: input.caseItem.id,
    generatedAt: input.now,
    confidence: input.state.confidence.label,
    windows: uniqueWindows(windows)
  };
};
