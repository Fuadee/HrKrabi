"use client";

import { useEffect, useMemo, useState } from "react";

export type DocumentInput = {
  docScope: string;
  docNo: string;
};

export type ActionModalMode = "receive" | "record_found" | "record_not_found";

type ActionModalPayload = {
  signedBy: string;
  note: string;
  documents: DocumentInput[];
  replacementWorkerName?: string;
  replacementStartDate?: string;
};

type ActionModalProps = {
  isOpen: boolean;
  mode: ActionModalMode;
  title: string;
  isSubmitting: boolean;
  initialReplacementName?: string;
  initialReplacementStartDate?: string;
  onClose: () => void;
  onSubmit: (payload: ActionModalPayload) => void;
};

const docScopeOptions = [
  { value: "INTERNAL", label: "INTERNAL (มท.)" },
  { value: "TO_DISTRICT", label: "TO_DISTRICT (ส่งเขต)" },
  { value: "OTHER", label: "OTHER" },
];

function getDefaultDocuments(mode: ActionModalMode): DocumentInput[] {
  if (mode === "receive") {
    return [
      { docScope: "INTERNAL", docNo: "" },
      { docScope: "TO_DISTRICT", docNo: "" },
    ];
  }

  return [{ docScope: "INTERNAL", docNo: "" }];
}

export function ActionModal({
  isOpen,
  mode,
  title,
  isSubmitting,
  initialReplacementName,
  initialReplacementStartDate,
  onClose,
  onSubmit,
}: ActionModalProps) {
  const [signedBy, setSignedBy] = useState("");
  const [note, setNote] = useState("");
  const [documents, setDocuments] = useState<DocumentInput[]>([]);
  const [replacementName, setReplacementName] = useState("");
  const [replacementStartDate, setReplacementStartDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isFound = mode === "record_found";
  const isReceive = mode === "receive";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSignedBy("");
    setNote("");
    setDocuments(getDefaultDocuments(mode));
    setReplacementName(initialReplacementName ?? "");
    setReplacementStartDate(initialReplacementStartDate ?? "");
    setFormError(null);
  }, [isOpen, mode, initialReplacementName, initialReplacementStartDate]);

  const trimmedDocuments = useMemo(
    () =>
      documents
        .map((doc) => ({
          docScope: doc.docScope.trim(),
          docNo: doc.docNo.trim(),
        }))
        .filter((doc) => doc.docScope || doc.docNo),
    [documents],
  );

  const submitAction = () => {
    const cleanedSignedBy = signedBy.trim();
    const cleanedNote = note.trim();

    if (!cleanedSignedBy) {
      setFormError("Signed by is required.");
      return;
    }

    if (trimmedDocuments.length === 0) {
      setFormError("Add at least one document.");
      return;
    }

    if (
      trimmedDocuments.some((doc) => !doc.docScope || !doc.docNo)
    ) {
      setFormError("Each document needs a scope and document number.");
      return;
    }

    if (isReceive) {
      if (trimmedDocuments.length < 2) {
        setFormError("Receive requires at least two documents.");
        return;
      }

      const scopes = new Set(
        trimmedDocuments.map((doc) => doc.docScope.toUpperCase()),
      );

      if (!scopes.has("INTERNAL") || !scopes.has("TO_DISTRICT")) {
        setFormError(
          "Receive must include INTERNAL (มท.) and TO_DISTRICT (ส่งเขต).",
        );
        return;
      }
    }

    if (isFound) {
      if (!replacementName.trim()) {
        setFormError("Replacement worker name is required.");
        return;
      }

      if (!replacementStartDate) {
        setFormError("Replacement start date is required.");
        return;
      }
    }

    onSubmit({
      signedBy: cleanedSignedBy,
      note: cleanedNote,
      documents: trimmedDocuments,
      replacementWorkerName: isFound ? replacementName.trim() : undefined,
      replacementStartDate: isFound ? replacementStartDate : undefined,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl">
        <div className="border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-xs text-slate-400">
                Add signature details and document numbers.
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
        </div>
        <div className="space-y-4 px-6 py-4 text-sm">
          {formError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-300">
              Signed by
              <input
                type="text"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                placeholder="HR officer name"
              />
            </label>
            <label className="text-xs text-slate-300">
              Note (optional)
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                placeholder="Additional note"
              />
            </label>
          </div>

          {isFound ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">
                Replacement name
                <input
                  type="text"
                  value={replacementName}
                  onChange={(event) => setReplacementName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-slate-300">
                Start date
                <input
                  type="date"
                  value={replacementStartDate}
                  onChange={(event) => setReplacementStartDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">Documents</p>
              <button
                type="button"
                onClick={() =>
                  setDocuments((prev) => [
                    ...prev,
                    { docScope: "INTERNAL", docNo: "" },
                  ])
                }
                className="text-xs text-emerald-200 transition hover:text-emerald-100"
              >
                + Add document
              </button>
            </div>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={`doc-${index}`}
                  className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/40 p-3 md:flex-row md:items-center"
                >
                  <label className="flex-1 text-xs text-slate-300">
                    Scope
                    <select
                      value={doc.docScope}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDocuments((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, docScope: value }
                              : item,
                          ),
                        );
                      }}
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    >
                      {docScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 text-xs text-slate-300">
                    Document no.
                    <input
                      type="text"
                      value={doc.docNo}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDocuments((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, docNo: value }
                              : item,
                          ),
                        );
                      }}
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDocuments((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="text-xs text-rose-200 transition hover:text-rose-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitAction}
            disabled={isSubmitting}
            className="rounded-md bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
