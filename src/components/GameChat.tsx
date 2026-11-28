import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";

type ChatRow = { id: string; room: string; user_id: string; body: string; created_at: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Live chat for a game lobby ("lobby:chess") or a single match ("match:<id>"). */
export const GameChat = ({ room, title, labelFor }: { room: string; title: string; labelFor?: (userId: string) => string }) => {
  const me = useUserStore((s) => s.userId);
  const queryClient = useQueryClient();
  const key = ["game-chat", room, me];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("game_chat_messages").select("id,room,user_id,body,created_at")
        .eq("room", room).order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return ((data || []) as ChatRow[]).reverse();
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`chat-${room}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_chat_messages", filter: `room=eq.${room}` }, (payload) => {
        const row = payload.new as ChatRow;
        queryClient.setQueryData<ChatRow[]>(["game-chat", room, me], (old = []) => (old.some((m) => m.id === row.id) ? old : [...old, row].slice(-80)));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [room, queryClient, me]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setSending(true);
    const { data, error } = await supabase.from("game_chat_messages").insert({ room, user_id: me, body: body.slice(0, 300) })
      .select("id,room,user_id,body,created_at").single();
    setSending(false);
    if (error) return toast.error(error.message.includes("too fast") ? "Slow down a little before sending again" : error.message.includes("restricted") ? "Your account cannot chat right now" : "Message not sent");
    setText("");
    queryClient.setQueryData<ChatRow[]>(key, (old = []) => (old.some((m) => m.id === data.id) ? old : [...old, data as ChatRow]));
  };

  const name = (id: string) => (id === me ? "You" : labelFor ? labelFor(id) : `Player ${id.slice(-4).toUpperCase()}`);

  return (
    <section className="game-chat" aria-label={title}>
      <header><MessageCircle className="h-4 w-4" /><h3>{title}</h3><span className="live-dot" aria-hidden="true" />Live</header>
      <ol ref={listRef}>
        {isLoading && <li className="chat-empty">Loading chat…</li>}
        {!isLoading && messages.length === 0 && <li className="chat-empty">No messages yet. Say hello.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.user_id === me ? "mine" : ""}>
            <small>{name(m.user_id)} · {time(m.created_at)}</small>
            <p>{m.body}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={send}>
        <Input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Chat message" />
        <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button>
      </form>
    </section>
  );
};
