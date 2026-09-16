"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

const environmentItems = [
  { label: "Select environment", value: null },
  { label: "Development", value: "dev" },
  { label: "Staging", value: "staging" },
  { label: "Production", value: "production" },
];

const statusSwatches = [
  {
    name: "pass",
    fg: "var(--status-pass-fg)",
    bg: "var(--status-pass-bg)",
    border: "var(--status-pass-border)",
  },
  {
    name: "fail",
    fg: "var(--status-fail-fg)",
    bg: "var(--status-fail-bg)",
    border: "var(--status-fail-border)",
  },
  {
    name: "running",
    fg: "var(--status-running-fg)",
    bg: "var(--status-running-bg)",
    border: "var(--status-running-border)",
  },
  {
    name: "queued",
    fg: "var(--status-queued-fg)",
    bg: "var(--status-queued-bg)",
    border: "var(--status-queued-border)",
  },
  {
    name: "skipped",
    fg: "var(--status-skipped-fg)",
    bg: "var(--status-skipped-bg)",
    border: "var(--status-skipped-border)",
  },
  {
    name: "warning",
    fg: "var(--status-warning-fg)",
    bg: "var(--status-warning-bg)",
    border: "var(--status-warning-border)",
  },
];

const runRows = [
  {
    id: "run_8f2a1c9d",
    target: "checkout.example.com",
    status: "pass" as const,
    duration: "12.4s",
  },
  {
    id: "run_3b7e0a41",
    target: "checkout.example.com",
    status: "fail" as const,
    duration: "8.1s",
  },
  {
    id: "run_c19d5e02",
    target: "app.example.com",
    status: "running" as const,
    duration: "—",
  },
];

export default function ThemePreviewPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase text-(--text-tertiary) tracking-[0.2em]">
          A4 &mdash; theme proof, not a product screen
        </p>
        <h1 className="font-heading text-3xl font-light tracking-tight">
          Test by Token
        </h1>
        <p className="text-sm text-muted-foreground">
          Every component below is themed from styles/tokens.css. Nothing here
          is a real screen &mdash; it exists to prove the theme reads as the
          brand before any product work begins.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">Inputs &amp; select</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="https://app.example.com" className="max-w-xs" />
          <Select items={environmentItems}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {environmentItems
                  .filter((item) => item.value !== null)
                  .map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">Badges</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Semantic status scale from A3 (fg / bg wash / border, not a Badge
          variant yet &mdash; that comes with real run UI):
        </p>
        <div className="flex flex-wrap gap-2">
          {statusSwatches.map((s) => (
            <span
              key={s.name}
              className="inline-flex items-center border px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
              style={{
                color: s.fg,
                backgroundColor: s.bg,
                borderColor: s.border,
              }}
            >
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">Table</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.id}</TableCell>
                <TableCell>{row.target}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide"
                    style={{
                      color: `var(--status-${row.status}-fg)`,
                      backgroundColor: `var(--status-${row.status}-bg)`,
                      borderColor: `var(--status-${row.status}-border)`,
                    }}
                  >
                    {row.status}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.duration}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">Tabs</h2>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="proof">Proof</TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="text-sm text-muted-foreground"
          >
            Tab content themed via the same tokens &mdash; no per-component
            overrides.
          </TabsContent>
          <TabsContent value="steps" className="text-sm text-muted-foreground">
            Step output would render here in monospace.
          </TabsContent>
          <TabsContent value="proof" className="text-sm text-muted-foreground">
            Proof metadata would render here.
          </TabsContent>
        </Tabs>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-light">
          Dialog, tooltip, toast, skeleton
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              Open dialog
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Cancel run?</DialogTitle>
                <DialogDescription>
                  This will stop the run and mark remaining scenarios as
                  skipped. This is themed chrome, not real functionality.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost">Keep running</Button>
                <Button variant="destructive">Cancel run</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" />}>
              Hover me
            </TooltipTrigger>
            <TooltipContent>Tooltips use the same tokens too.</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Run queued",
                description: "checkout.example.com — 3 scenarios",
                type: "success",
              })
            }
          >
            Fire toast
          </Button>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </section>
    </main>
  );
}
