"use client";

import { useState } from "react";
import { z } from "zod";
import { EnvironmentSchema, TargetSchema } from "@/lib/contract";
import { useCreateTarget, useUpdateTarget } from "@/lib/api/queries/targets";
import { ApiError } from "@/lib/api/errors";
import { isUnrecognised, type Tolerated } from "@/lib/api/tolerant";
import {
  validateTarget,
  type TargetFieldErrors,
  type TargetInput,
} from "@/lib/targets/validateTarget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Target = Tolerated<z.infer<typeof TargetSchema>>;

const ENVIRONMENTS = EnvironmentSchema.options.map((value) => ({
  value: String(value),
  label: String(value),
}));

/**
 * Register a target, or (with `target`) change one. Same form either way:
 * the failure screen's "Change address" is this dialog, pre-filled.
 */
export function TargetFormDialog({
  target,
  open,
  onOpenChange,
}: {
  target?: Target;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">
            {target ? "Change target" : "Register a target"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? "Changes apply to the next scan."
              : "The application you want tested. We only ever load it - we never ask for a password."}
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <EditForm target={target} onDone={() => onOpenChange(false)} />
        ) : (
          <CreateForm onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateTarget();
  return (
    <TargetForm
      submitLabel="Register target"
      pending={create.isPending}
      serverError={create.error}
      onSubmit={(value) => create.mutate(value, { onSuccess: onDone })}
    />
  );
}

function EditForm({ target, onDone }: { target: Target; onDone: () => void }) {
  const update = useUpdateTarget(target.id);
  return (
    <TargetForm
      initial={{
        name: target.name,
        base_url: target.base_url,
        environment: isUnrecognised(target.environment)
          ? null
          : target.environment,
      }}
      submitLabel="Save changes"
      pending={update.isPending}
      serverError={update.error}
      onSubmit={(value) => update.mutate(value, { onSuccess: onDone })}
    />
  );
}

function TargetForm({
  initial,
  submitLabel,
  pending,
  serverError,
  onSubmit,
}: {
  initial?: { name: string; base_url: string; environment: string | null };
  submitLabel: string;
  pending: boolean;
  serverError: unknown;
  onSubmit: (value: TargetInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "");
  const [environment, setEnvironment] = useState<string | null>(
    initial?.environment ?? null,
  );
  const [errors, setErrors] = useState<TargetFieldErrors>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateTarget({ name, base_url: baseUrl, environment });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="target-name">Name</FieldLabel>
          <Input
            id="target-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "target-name-error" : undefined}
            placeholder="Checkout"
            autoComplete="off"
          />
          {errors.name && (
            <FieldError id="target-name-error">{errors.name}</FieldError>
          )}
        </Field>

        <Field data-invalid={errors.base_url ? true : undefined}>
          <FieldLabel htmlFor="target-url">Address</FieldLabel>
          <Input
            id="target-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            aria-invalid={errors.base_url ? true : undefined}
            aria-describedby={errors.base_url ? "target-url-error" : undefined}
            placeholder="https://app.example.com"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
          {errors.base_url && (
            <FieldError id="target-url-error">{errors.base_url}</FieldError>
          )}
        </Field>

        <Field data-invalid={errors.environment ? true : undefined}>
          <FieldLabel id="target-env-label">Environment</FieldLabel>
          <Select
            items={ENVIRONMENTS}
            value={environment}
            onValueChange={(v) => setEnvironment(v)}
          >
            <SelectTrigger
              className="w-full"
              aria-labelledby="target-env-label"
              aria-invalid={errors.environment ? true : undefined}
              aria-describedby={
                errors.environment ? "target-env-error" : undefined
              }
            >
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {ENVIRONMENTS.map((env) => (
                  <SelectItem key={env.value} value={env.value}>
                    {env.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.environment && (
            <FieldError id="target-env-error">{errors.environment}</FieldError>
          )}
        </Field>
      </FieldGroup>

      {serverError != null && (
        <p role="alert" className="text-sm text-destructive">
          {serverError instanceof ApiError
            ? serverError.message
            : "Something went wrong. Please try again."}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
