import { useEffect, useRef, useState } from "react";
import { useChat } from "@anvia/react";
import { api } from "#/utils/api";

interface PersistedMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
}

export function ChatPanel({ mealPlanId }: { mealPlanId: string }) {
  const [history, setHistory] = useState<PersistedMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Note: Cast to any because Hono RPC (hc) type inference doesn't merge
    // endpoint paths (/{id}) with sub-routes (/:id/chat) on the same segment
    ((api["meal-plans"] as any)[":id"].chat as any)
      .$get({ param: { id: mealPlanId } })
      .then((res: any) => res.json())
      .then((body: any) => setHistory(body.data as unknown as PersistedMessage[]));
  }, [mealPlanId]);

  const { send, messages, error } = useChat({
    endpoint: `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8002"}/meal-plans/${mealPlanId}/chat`,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [history, messages]);

  function handleSend() {
    if (!input.trim()) return;
    send(input);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <h2 className="shrink-0 font-semibold border-b px-6 py-4">
        Ask about this plan
      </h2>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
        {history.map((m) => (
          <p
            key={m.id}
            className={m.role === "USER" ? "text-right" : "text-left"}
          >
            {m.content}
          </p>
        ))}
        {messages.map((message, i) =>
          message.parts.map((p, j) =>
            p.type === "text" ? (
              <p
                key={`${i}-${j}`}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                {p.text}
              </p>
            ) : null,
          ),
        )}
        <div ref={messagesEndRef} />
      </div>
      {error ? (
        <p className="shrink-0 text-red-600 text-sm px-6">{String(error)}</p>
      ) : null}
      <div className="shrink-0 flex gap-2 border-t px-6 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button
          type="button"
          className="primary"
          disabled={!input.trim()}
          onClick={handleSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}
