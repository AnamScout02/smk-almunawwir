"use client";
import { useState, useEffect, useCallback } from "react";
import { Mail, MailOpen, Trash2, Loader2, CheckCheck, MessageSquare } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

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
      <PageHeader
        icon={<MessageSquare size={22} />}
        title="Pesan Masuk"
        description={unread > 0 ? `${unread} pesan belum dibaca` : "Semua pesan sudah dibaca"}
        actions={
          unread > 0 ? (
            <button
              onClick={async () => {
                await fetch("/api/admin/messages", { method: "PATCH" });
                load();
              }}
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <CheckCheck size={15} /> Tandai Semua Dibaca
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Mail} description="Belum ada pesan masuk" />
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${!item.isRead ? "border-primary-200 shadow-primary-50" : "border-gray-100"}`}>
              <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => openMsg(item)}>
                <div className={`mt-0.5 shrink-0 ${!item.isRead ? "text-primary-600" : "text-gray-300"}`}>
                  {item.isRead ? <MailOpen size={18} /> : <Mail size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${!item.isRead ? "text-primary-900" : "text-gray-700"}`}>{item.name}</span>
                    {!item.isRead && <span className="px-1.5 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 border border-primary-200 font-semibold">Baru</span>}
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
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 bg-primary-50/30">
                  <p className="text-xs text-gray-500 mb-3">
                    Dari: <a href={`mailto:${item.email}`} className="text-primary-700 font-semibold hover:underline">{item.email}</a>
                  </p>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`mailto:${item.email}?subject=Re: ${item.subject}`}
                      className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                      Balas via Email
                    </a>
                    <button onClick={() => markRead(item.id, !item.isRead)}
                      className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-white transition-colors">
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
