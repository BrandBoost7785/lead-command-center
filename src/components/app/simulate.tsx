import { useState } from "react";
import { Radio } from "lucide-react";
import { actions } from "@/lib/data/store";
import { useBusiness } from "@/hooks/use-app-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, EventType, Intent } from "@/lib/domain/types";

/**
 * Integration simulator: injects a real inbound event through the whole
 * pipeline (classification → scoring → priority → task → notification →
 * audit) so the event-driven architecture is demonstrable before any external
 * provider is connected.
 */
export function SimulateEventButton({ defaultProspectId }: { defaultProspectId?: string }) {
  const { state, businessId, index } = useBusiness();
  const [open, setOpen] = useState(false);
  const prospects = state.prospects.filter((p) => p.businessId === businessId);
  const [prospectId, setProspectId] = useState(defaultProspectId ?? prospects[0]?.id ?? "");
  const [channel, setChannel] = useState<Channel>("email");
  const [intent, setIntent] = useState<Intent>("high_intent");
  const [body, setBody] = useState(
    "Yes — this looks good. Can we get on a call this week to finalise the details?",
  );

  const submit = () => {
    const prospect = state.prospects.find((p) => p.id === prospectId);
    if (!prospect) return;
    const typeMap: Record<string, EventType> = {
      email: "EMAIL_RECEIVED",
      call: "CALL_MISSED",
      sms: "SMS_RECEIVED",
      whatsapp: "WHATSAPP_RECEIVED",
      form: "FORM_COMPLETED",
      meeting: "APPOINTMENT_CREATED",
    };
    actions.simulateEvent({
      type: typeMap[channel] ?? "EMAIL_RECEIVED",
      prospectId: prospect.id,
      channel,
      summary: `${channel === "call" ? "Missed call" : "Inbound activity"} from ${index.nameOf(prospect)}`,
      detail: body,
      body,
      intent,
    });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Radio className="h-3.5 w-3.5" />
        Simulate inbound
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Simulate an incoming event</DialogTitle>
            <DialogDescription className="text-xs">
              Injects the event through the real pipeline: classification, scoring, priority,
              recommended action, task creation and the audit log. Without integrations connected,
              this is how the loop is demonstrated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prospect</Label>
                <Select value={prospectId} onValueChange={setProspectId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose a prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    {prospects.slice(0, 30).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {index.nameOf(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email received</SelectItem>
                    <SelectItem value="call">Missed call</SelectItem>
                    <SelectItem value="sms">SMS received</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp received</SelectItem>
                    <SelectItem value="form">Form submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Classified intent</Label>
              <Select value={intent} onValueChange={(v) => setIntent(v as Intent)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "high_intent",
                      "interested",
                      "scheduling",
                      "pricing",
                      "question",
                      "objection",
                      "not_interested",
                    ] as Intent[]
                  ).map((i) => (
                    <SelectItem key={i} value={i}>
                      {i.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit}>
              Inject event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
