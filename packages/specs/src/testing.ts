export type SpecsInspectionNode = {
  id: string;
  name?: string;
  components: readonly string[];
  position?: [number, number, number];
  visible?: boolean;
};

export type SpecsValidationStep =
  | {
      op: "assert-node";
      id: string;
      requiredComponents?: readonly string[];
    }
  | {
      op: "pinch";
      id: string;
    }
  | {
      op: "poke";
      id: string;
    }
  | {
      op: "drag";
      id: string;
      from: [number, number, number];
      to: [number, number, number];
    }
  | {
      op: "capture";
      label: string;
    };

export type SpecsValidationPlan = {
  name: string;
  inspectorPackage: "AiPreviewAgentInspect";
  interactionPackage: "AiPreviewAgentInteract";
  steps: readonly SpecsValidationStep[];
};

/**
 * Canonical end-to-end contract for the cross-platform Platform Lab.
 *
 * The Lens-side harness can execute this through AiPreviewAgentInspect and
 * AiPreviewAgentInteract while other Viro targets execute equivalent actions
 * through their own test drivers.
 */
export const SPECS_PLATFORM_LAB_PLAN: SpecsValidationPlan = {
  name: "Viro Specs Platform Lab",
  inspectorPackage: "AiPreviewAgentInspect",
  interactionPackage: "AiPreviewAgentInteract",
  steps: [
    {
      op: "assert-node",
      id: "platform-lab-panel",
    },
    {
      op: "assert-node",
      id: "platform-lab-title",
    },
    {
      op: "assert-node",
      id: "platform-lab-model",
      requiredComponents: ["RenderMeshVisual"],
    },
    {
      op: "assert-node",
      id: "platform-lab-button",
    },
    {
      op: "pinch",
      id: "platform-lab-button",
    },
    {
      op: "drag",
      id: "platform-lab-model",
      from: [0, 0, -1.5],
      to: [0.25, 0, -1.5],
    },
    {
      op: "capture",
      label: "platform-lab-after-interaction",
    },
  ],
};

export interface SpecsValidationRuntime {
  inspectNode(id: string): Promise<SpecsInspectionNode | null>;
  pinch(id: string): Promise<void>;
  poke(id: string): Promise<void>;
  drag(
    id: string,
    from: [number, number, number],
    to: [number, number, number]
  ): Promise<void>;
  capture(label: string): Promise<void>;
}

export type SpecsValidationResult = {
  step: SpecsValidationStep;
  passed: boolean;
  message?: string;
};

export async function runSpecsValidationPlan(
  runtime: SpecsValidationRuntime,
  plan: SpecsValidationPlan = SPECS_PLATFORM_LAB_PLAN
): Promise<SpecsValidationResult[]> {
  const results: SpecsValidationResult[] = [];

  for (const step of plan.steps) {
    try {
      switch (step.op) {
        case "assert-node": {
          const node = await runtime.inspectNode(step.id);
          if (!node) {
            throw new Error(`Node ${step.id} was not found.`);
          }

          for (const component of step.requiredComponents ?? []) {
            if (!node.components.includes(component)) {
              throw new Error(
                `Node ${step.id} is missing component ${component}.`
              );
            }
          }
          break;
        }

        case "pinch":
          await runtime.pinch(step.id);
          break;

        case "poke":
          await runtime.poke(step.id);
          break;

        case "drag":
          await runtime.drag(step.id, step.from, step.to);
          break;

        case "capture":
          await runtime.capture(step.label);
          break;
      }

      results.push({ step, passed: true });
    } catch (error) {
      results.push({
        step,
        passed: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
