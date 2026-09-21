import { elementsTouched, type PlanStep } from "./reviewState";

/**
 * "N steps" means little without the size of what they were drawn from. A
 * plan is written from an intent and need not propose every groundable
 * element, so this states, as plain counts, how much of the inventory the
 * proposal touches. Rendered only once the inventory's size is actually
 * known - never a guess.
 */
export function InventoryContext({
  steps,
  inventoryElements,
}: {
  steps: PlanStep[];
  inventoryElements: number | null;
}) {
  if (inventoryElements === null) return null;
  const touched = elementsTouched(steps);
  return (
    <p data-testid="plan-inventory" className="text-sm text-muted-foreground">
      These {steps.length} steps touch {touched} of the {inventoryElements}{" "}
      elements in the inventory the plan was grounded against. Elements the plan
      does not touch are not tested by it.
    </p>
  );
}
