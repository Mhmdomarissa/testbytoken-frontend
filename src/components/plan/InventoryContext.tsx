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
  const share = inventoryElements > 0 ? touched / inventoryElements : 0;
  return (
    <div className="flex flex-col gap-2.5">
      <p data-testid="plan-inventory" className="text-sm text-muted-foreground">
        These {steps.length} steps touch {touched} of the {inventoryElements}{" "}
        elements in the inventory this plan was made from. Elements the plan
        does not touch are not tested by it.
      </p>
      {/* The same two numbers, drawn: the sentence above is what's read. */}
      <div aria-hidden="true" className="h-0.5 w-full max-w-md bg-(--line)">
        <div
          className="fill-in h-full bg-primary"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}
