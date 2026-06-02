import { useCallback, useEffect, useState } from "react";
import { Bell, Megaphone, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type InboxMessage = {
  id: string;
  sender_label: string;
  title: string | null;
  body: string;
  recipient_id: string | null;
  created_at: string;
};

export const MessagesInbox = () => {
  const userId = useUserStore((s) => s.userId);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("message_reads").select("message_id").eq("user_id", userId),
    ]);
    setMessages((msgs || []) as InboxMessage[]);
    setReadIds(new Set((reads || []).map((r: { message_id: string }) => r.message_id)));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const unreadCount = messages.filter((m) => !readIds.has(m.id)).length;

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unread = messages.filter((m) => !readIds.has(m.id));
    if (unread.length === 0) return;
    const rows = unread.map((m) => ({ message_id: m.id, user_id: userId }));
    const { error } = await supabase
      .from("message_reads")
      .upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });
    if (!error) {
      setReadIds((prev) => {
        const next = new Set(prev);
        unread.forEach((m) => next.add(m.id));
        return next;
      });
    }
  }, [userId, messages, readIds]);

  useEffect(() => {
    if (open) markAllRead();
  }, [open, markAllRead]);

  if (!userId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Messages">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display tracking-wider">
            <span className="text-gradient-primary">TECHWIZARD</span> Hub Messages
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {messages.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No messages yet
            </div>
          )}
          {messages.map((m) => {
            const unread = !readIds.has(m.id);
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3 transition-colors ${
                  unread ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/40"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary shadow-glow">
                    {m.recipient_id ? (
                      <Rocket className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
                    ) : (
                      <Megaphone className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black tracking-wide">{m.sender_label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                  {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                {m.title && <div className="mb-1 text-sm font-bold">{m.title}</div>}
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
