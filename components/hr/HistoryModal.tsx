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
        setError("Unable to authenticate.");
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
        setError(payload.error ?? "Failed to load history.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Action History</h2>
            <p className="text-xs text-slate-400">
              Recent case actions and attached documents.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4 text-sm">
          {loading ? (
            <p className="text-sm text-slate-300">Loading history...</p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}
          {!loading && !error && actions.length === 0 ? (
            <p className="text-sm text-slate-400">No actions recorded yet.</p>
          ) : null}
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {action.action_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-400">
                      Signed by {action.signed_by}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(action.created_at).toLocaleString()}
                  </span>
                </div>
                {action.note ? (
                  <p className="mt-2 text-xs text-slate-300">{action.note}</p>
                ) : null}
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">
                    Documents
                  </p>
                  {action.documents.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No documents recorded.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-200">
                      {action.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1"
                        >
                          <span>{doc.doc_scope}</span>
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
