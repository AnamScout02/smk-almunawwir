"use client";
import { useState, useEffect, useCallback } from "react";
import { Mail, MailOpen, Trash2, Loader2, CheckCheck } from "lucide-react";

interface Message { id: string; name: string; email: string; subject: string; message: string; isRead: boolean; createdAt: string; }

export default function AdminMessagesPage() {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/messages");
    setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string, isRead: boolean) {
    await fetch(`/api/admin/messages/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus pesan ini?")) return;
    await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    load();
  }

  function openMsg(item: Message) {
    setExpanded(expanded === item.id ? null : item.id);
    if (!item.isRead) markRead(item.id, true);
  }

  const unread = items.filter(i => !i.isRead).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Pesan Masuk</h1>
          <p className="text-gray-500 text-sm mt-1">{unread > 0 ? `${unread} pesan belum dibaca` : "Semua pesan sudah dibaca"}</p>
        </div>
        {unread > 0 && (
          <button
            onClick={async () => {
              await fetch("/api/admin/messages", { method: "PATCH" });
              load();
            }}
            className="shrink-0 inline-flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <CheckCheck size={15} /> Tandai Semua Dibaca
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">Belum ada pesan masuk</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${!item.isRead ? "border-primary-200 shadow-primary-50" : ""}`}>
              <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => openMsg(item)}>
                <div className={`mt-0.5 shrink-0 ${!item.isRead ? "text-primary-600" : "text-gray-300"}`}>
                  {item.isRead ? <MailOpen size={18} /> : <Mail size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${!item.isRead ? "text-primary-900" : "text-gray-700"}`}>{item.name}</span>
                    {!item.isRead && <span className="px-1.5 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700 font-medium">Baru</span>}
                    <span className="text-xs text-gray-400 ml-auto">{new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 font-medium">{item.subject}</p>
                  {expanded !== item.id && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.message}</p>}
                </div>
                <button onClick={e => { e.stopPropagation(); remove(item.id); }} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0 rounded-lg hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
              {expanded === item.id && (
                <div className="px-4 pb-4 border-t pt-3 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">Dari: <a href={`mailto:${item.email}`} className="text-primary-600 hover:underline">{item.email}</a></p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                  <div className="flex gap-2 mt-3">
                    <a href={`mailto:${item.email}?subject=Re: ${item.subject}`} className="btn-primary text-xs !px-4 !py-2">Balas via Email</a>
                    <button onClick={() => markRead(item.id, !item.isRead)} className="px-4 py-2 text-xs border rounded-lg text-gray-600 hover:bg-gray-100">
                      {item.isRead ? "Tandai Belum Dibaca" : "Tandai Sudah Dibaca"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
