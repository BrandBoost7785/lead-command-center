import { useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  Square,
  UserCheck,
} from "lucide-react";
import { actions } from "@/lib/data/store";
import { useAppState } from "@/hooks/use-app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHANNEL_LABEL, NEXT_ACTION_LABEL } from "@/lib/format";
import { draftFor } from "@/lib/ai/reasoner";
import type { Channel, NextActionType, Prospect } from "@/lib/domain/types";

type ActionKind = "reply" | "call" | "sms" | "whatsapp" | "task" | "note";

/**
 * Contextual quick actions: every important row in the product can act on the
 * record it describes — the spec's "never make the user hunt for the next
 * action" principle.
 */
export function QuickAction({
  prospectId,
  action,
  label,
  variant = "outline",
  size = "sm",
  className,
}: {
  prospectId: string;
  action: ActionKind;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "xs";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const state = useAppState();
  const prospect = state.prospects.find((p) => p.id === prospectId);

  const defaults: Record<ActionKind, { label: string; icon: React.ReactNode }> = {
    reply: { label: "Reply", icon: <Mail className="h-3.5 w-3.5" /> },
    call: { label: "Call", icon: <Phone className="h-3.5 w-3.5" /> },
    sms: { label: "SMS", icon: <MessageCircle className="h-3.5 w-3.5" /> },
    whatsapp: { label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" /> },
    task: { label: "Task", icon: <CalendarPlus className="h-3.5 w-3.5" /> },
    note: { label: "Note", icon: <Square className="h-3.5 w-3.5" /> },
  };

  if (!prospect) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
      >
        {defaults[action].icon}
        {label ?? defaults[action].label}
      </Button>
      {open ? (
        <ActionDialog prospect={prospect} kind={action} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function ActionButton({
  prospectId,
  kind,
  label,
  variant = "outline",
  className,
}: {
  prospectId: string;
  kind: ActionKind;
  label: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const state = useAppState();
  const prospect = state.prospects.find((p) => p.id === prospectId);
  if (!prospect) return null;
  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <ActionDialog prospect={prospect} kind={kind} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ActionDialog({
  prospect,
  kind,
  onClose,
}: {
  prospect: Prospect;
  kind: ActionKind;
  onClose: () => void;
}) {
  const state = useAppState();
  const contact = state.contacts.find((c) => c.id === prospect.contactId);
  const name = contact ? `${contact.firstName} ${contact.lastName}` : "contact";
  const pending = state.communications.find(
    (c) =>
      c.prospectId === prospect.id && c.direction === "inbound" && c.requiresResponse && !c.handled,
  );

  const [body, setBody] = useState(kind === "reply" ? draftFor(state, prospect) : "");
  const [subject, setSubject] = useState(
    pending?.subject ? `RE: ${pending.subject.replace(/^RE:\s*/i, "")}` : "Following up",
  );
  const [channel, setChannel] = useState<Channel>(
    kind === "sms" ? "sms" : kind === "whatsapp" ? "whatsapp" : "email",
  );
  const [callOutcome, setCallOutcome] = useState<"connected" | "voicemail" | "no_answer">(
    "connected",
  );
  const [duration, setDuration] = useState(8);
  const [taskType, setTaskType] = useState<NextActionType>("follow_up");
  const [dueInHours, setDueInHours] = useState(4);
  const [taskTitle, setTaskTitle] = useState(`Follow up with ${name}`);
  const [aiDrafting, setAiDrafting] = useState(false);

  const regenerate = () => {
    setAiDrafting(true);
    setTimeout(() => {
      setBody(draftFor(state, prospect));
      setAiDrafting(false);
    }, 350);
  };

  const submit = () => {
    if (kind === "call") {
      actions.logCall({
        prospectId: prospect.id,
        outcome: callOutcome,
        notes: body || `Call with ${name} — ${callOutcome.replace(/_/g, " ")}.`,
        durationSeconds: callOutcome === "connected" ? duration * 60 : 0,
      });
      if (pending) actions.handleCommunication(pending.id);
    } else if (kind === "task") {
      actions.createTask({
        title: taskTitle,
        prospectId: prospect.id,
        companyId: prospect.companyId,
        type: taskType,
        priority: prospect.priority === "critical" ? "critical" : "high",
        dueMinutes: dueInHours * 60,
        reason: "Created from a contextual quick action.",
      });
      if (pending) actions.handleCommunication(pending.id);
    } else if (kind === "note") {
      actions.addNote(prospect.id, body);
    } else {
      actions.sendMessage({
        prospectId: prospect.id,
        channel,
        subject: channel === "email" ? subject : undefined,
        body,
        inReplyTo: pending?.id,
      });
    }
    onClose();
  };

  const titles: Record<ActionKind, string> = {
    reply: `Reply to ${name}`,
    call: `Log a call with ${name}`,
    sms: `Text ${name}`,
    whatsapp: `WhatsApp ${name}`,
    task: `Create a task for ${name}`,
    note: `Add a note about ${name}`,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{titles[kind]}</DialogTitle>
          <DialogDescription className="text-xs">
            {pending
              ? `Replying clears the open item from your attention queue and writes the event into the audit trail.`
              : `This action is logged as an event and re-scores the prospect immediately.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {kind === "reply" || kind === "sms" || kind === "whatsapp" ? (
            <>
              <div className="flex items-center gap-2">
                <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={regenerate}
                  disabled={aiDrafting}
                >
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  {aiDrafting ? "Drafting…" : "Redraft with AI"}
                </Button>
              </div>
              {channel === "email" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="text-sm"
                />
              </div>
            </>
          ) : null}

          {kind === "call" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Outcome</Label>
                  <Select
                    value={callOutcome}
                    onValueChange={(v) => setCallOutcome(v as typeof callOutcome)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                      <SelectItem value="no_answer">No answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="text-sm"
                  placeholder="What was discussed, what was agreed, what happens next…"
                />
              </div>
            </>
          ) : null}

          {kind === "task" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Task</Label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={taskType} onValueChange={(v) => setTaskType(v as NextActionType)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "follow_up",
                          "call",
                          "reply",
                          "send_proposal",
                          "schedule",
                          "research",
                          "review",
                        ] as NextActionType[]
                      ).map((t) => (
                        <SelectItem key={t} value={t}>
                          {NEXT_ACTION_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due in (hours)</Label>
                  <Input
                    type="number"
                    value={dueInHours}
                    onChange={(e) => setDueInHours(Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </>
          ) : null}

          {kind === "note" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="text-sm"
                placeholder="Context future-you will thank you for…"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={submit}
            disabled={kind !== "call" && kind !== "task" && !body.trim()}
          >
            {kind === "call" ? (
              <Phone className="h-3.5 w-3.5" />
            ) : kind === "task" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : kind === "note" ? (
              <UserCheck className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {kind === "call"
              ? "Log call"
              : kind === "task"
                ? "Create task"
                : kind === "note"
                  ? "Save note"
                  : `Send ${CHANNEL_LABEL[channel]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
