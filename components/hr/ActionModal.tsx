"use client";

import { useEffect, useMemo, useState } from "react";

export type DocumentInput = {
  docScope: "INTERNAL" | "TO_DISTRICT" | "OTHER";
  docNo: string;
};

export type ActionModalMode = "receive" | "record_found" | "record_not_found";

export type ActionModalPayload = {
  signedBy: string;
  note?: string;
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
  { value: "INTERNAL", label: "ภายนอก (มท.)" },
  { value: "TO_DISTRICT", label: "ส่งเขต" },
  { value: "OTHER", label: "อื่น ๆ" },
] as const;

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
          docScope: doc.docScope,
          docNo: doc.docNo.trim(),
        }))
        .filter((doc) => doc.docScope || doc.docNo),
    [documents],
  );

  const submitAction = () => {
    const cleanedSignedBy = signedBy.trim();
    const cleanedNote = note.trim();

    if (!cleanedSignedBy) {
      setFormError("จำเป็นต้องระบุผู้ลงนาม");
      return;
    }

    if (trimmedDocuments.length === 0) {
      setFormError("กรุณาเพิ่มเอกสารอย่างน้อย 1 รายการ");
      return;
    }

    if (
      trimmedDocuments.some((doc) => !doc.docScope || !doc.docNo)
    ) {
      setFormError("เอกสารทุกฉบับต้องระบุประเภทและเลขที่หนังสือ");
      return;
    }

    if (isReceive) {
      if (trimmedDocuments.length < 2) {
        setFormError("การรับเคสต้องมีเอกสารอย่างน้อย 2 ฉบับ");
        return;
      }

      const scopes = new Set(
        trimmedDocuments.map((doc) => doc.docScope.toUpperCase()),
      );

      if (!scopes.has("INTERNAL") || !scopes.has("TO_DISTRICT")) {
        setFormError(
          "การรับเคสต้องมีเอกสาร ภายนอก (มท.) และ ส่งเขต",
        );
        return;
      }
    }

    if (isFound) {
      if (!replacementName.trim()) {
        setFormError("จำเป็นต้องระบุชื่อผู้แทน");
        return;
      }

      if (!replacementStartDate) {
        setFormError("จำเป็นต้องระบุวันที่เริ่มของผู้แทน");
        return;
      }
    }

    onSubmit({
      signedBy: cleanedSignedBy,
      note: cleanedNote ? cleanedNote : undefined,
      documents: trimmedDocuments,
      replacementWorkerName: isFound ? replacementName.trim() : undefined,
      replacementStartDate: isFound ? replacementStartDate : undefined,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="card-surface w-full max-w-lg text-text-main shadow-soft">
        <div className="border-b border-border-soft px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-xs text-text-muted">
                ระบุผู้ลงนามและเลขที่เอกสาร
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
        </div>
        <div className="space-y-4 px-6 py-4 text-sm">
          {formError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-text-muted">
              ผู้ลงนาม
              <input
                type="text"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
                className="input-premium mt-1"
                placeholder="ชื่อเจ้าหน้าที่ HR"
              />
            </label>
            <label className="text-xs text-text-muted">
              หมายเหตุ (ถ้ามี)
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="input-premium mt-1"
                placeholder="หมายเหตุเพิ่มเติม"
              />
            </label>
          </div>

          {isFound ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-text-muted">
                ชื่อผู้แทน
                <input
                  type="text"
                  value={replacementName}
                  onChange={(event) => setReplacementName(event.target.value)}
                  className="input-premium mt-1"
                />
              </label>
              <label className="text-xs text-text-muted">
                วันที่เริ่ม
                <input
                  type="date"
                  value={replacementStartDate}
                  onChange={(event) => setReplacementStartDate(event.target.value)}
                  className="input-premium mt-1"
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted">เอกสาร</p>
              <button
                type="button"
                onClick={() =>
                  setDocuments((prev) => [
                    ...prev,
                    { docScope: "INTERNAL", docNo: "" },
                  ])
                }
                className="btn-secondary"
              >
                + เพิ่มเอกสาร
              </button>
            </div>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={`doc-${index}`}
                  className="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface-muted p-3 md:flex-row md:items-center"
                >
                  <label className="flex-1 text-xs text-text-muted">
                    ประเภท
                    <select
                      value={doc.docScope}
                      onChange={(event) => {
                        const value =
                          event.target.value as DocumentInput["docScope"];
                        setDocuments((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, docScope: value }
                              : item,
                          ),
                        );
                      }}
                      className="select-premium mt-1"
                    >
                      {docScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 text-xs text-text-muted">
                    เลขที่หนังสือ
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
                      className="input-premium mt-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDocuments((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="btn-destructive"
                  >
                    ลบออก
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-soft px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submitAction}
            disabled={isSubmitting}
            className="btn-gold px-4"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
