"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type HistoryDocument = {
  id: string;
  doc_scope: string;
  doc_no: string;
  created_at: string;
};

type HistoryAction = {
  id: string;
  case_id: string;
  action_type: string;
  signed_by: string;
  note: string | null;
  created_at: string;
  documents: HistoryDocument[];
};

type HistoryModalProps = {
  isOpen: boolean;
  caseId: string | null;
  onClose: () => void;
};

const actionTypeLabels: Record<string, string> = {
  RECEIVE_SEND: "รับเคสและส่งเอกสาร",
  RECORD_FOUND: "บันทึก: พบคนแทน",
  RECORD_NOT_FOUND: "บันทึก: ยังไม่พบคนแทน",
  APPROVE_SWAP: "ปิดงาน",
  MARK_VACANT: "ปิดงาน: ตำแหน่งว่าง",
};

const docScopeLabels: Record<string, string> = {
  INTERNAL: "ภายนอก (มท.)",
  TO_DISTRICT: "ส่งเขต",
  OTHER: "อื่น ๆ",
};

const formatActionType = (value: string) =>
  actionTypeLabels[value] ?? value.replace(/_/g, " ");

const formatDocScope = (value: string) => docScopeLabels[value] ?? value;

export function HistoryModal({ isOpen, caseId, onClose }: HistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<HistoryAction[]>([]);

  useEffect(() => {
    if (!isOpen || !caseId) {
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setError("ไม่สามารถยืนยันตัวตนได้");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/hr/history?caseId=${caseId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as {
        data?: HistoryAction[];
        error?: string;
      };

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "ไม่สามารถโหลดประวัติได้");
        setLoading(false);
        return;
      }

      setActions(payload.data ?? []);
      setLoading(false);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, caseId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="card-surface w-full max-w-2xl text-text-main shadow-soft">
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">ประวัติการดำเนินการ</h2>
            <p className="text-xs text-text-muted">
              การดำเนินการล่าสุดและเอกสารที่เกี่ยวข้อง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted transition hover:text-text-main"
          >
            ปิด
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4 text-sm">
          {loading ? (
            <p className="text-sm text-text-muted">กำลังโหลดประวัติ...</p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
          {!loading && !error && actions.length === 0 ? (
            <p className="text-sm text-text-muted">
              ยังไม่มีประวัติการดำเนินการ
            </p>
          ) : null}
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-border-soft bg-surface-muted p-4"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-main">
                      {formatActionType(action.action_type)}
                    </p>
                    <p className="text-xs text-text-muted">
                      ผู้ลงนาม: {action.signed_by}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(action.created_at).toLocaleString()}
                  </span>
                </div>
                {action.note ? (
                  <p className="mt-2 text-xs text-slate-600">{action.note}</p>
                ) : null}
                <div className="mt-3">
                  <p className="text-xs font-semibold text-text-muted">
                    เอกสาร
                  </p>
                  {action.documents.length === 0 ? (
                    <p className="text-xs text-text-muted">
                      ไม่มีเอกสารบันทึกไว้
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {action.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border border-border-soft bg-white px-2 py-1"
                        >
                          <span>{formatDocScope(doc.doc_scope)}</span>
                          <span className="font-semibold">{doc.doc_no}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
