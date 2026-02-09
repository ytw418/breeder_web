import { promises as fs } from "fs";
import path from "path";

export type GuinnessRecordType = "size" | "weight";
export type GuinnessSubmissionStatus = "pending" | "approved" | "rejected";
export type GuinnessRejectionReasonCode =
  | "photo_blur"
  | "measurement_not_visible"
  | "contact_missing"
  | "invalid_value"
  | "insufficient_description"
  | "suspected_manipulation"
  | "other";

export interface GuinnessSubmission {
  id: number;
  userId: number;
  userName: string;
  species: string;
  recordType: GuinnessRecordType;
  value: number;
  measurementDate: string | null;
  description: string | null;
  proofPhotos: string[];
  contactPhone: string | null;
  contactEmail: string | null;
  consentToContact: boolean;
  submittedAt: string;
  slaDueAt: string;
  resubmitCount: number;
  status: GuinnessSubmissionStatus;
  reviewReasonCode: GuinnessRejectionReasonCode | null;
  reviewMemo: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  approvedRecordId: number | null;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "guinness-submissions.json");

export async function readGuinnessSubmissions(): Promise<GuinnessSubmission[]> {
  try {
    const text = await fs.readFile(SUBMISSIONS_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: Partial<GuinnessSubmission>, index: number) => ({
      id:
        Number(item.id) ||
        Number(new Date(item.createdAt || "").getTime()) ||
        1000000 + index,
      userId: Number(item.userId) || 0,
      userName: String(item.userName || ""),
      species: String(item.species || ""),
      recordType: item.recordType === "weight" ? "weight" : "size",
      value: Number(item.value) || 0,
      measurementDate: item.measurementDate || null,
      description: item.description || null,
      proofPhotos: Array.isArray(item.proofPhotos)
        ? item.proofPhotos.filter(Boolean)
        : [],
      contactPhone: item.contactPhone || null,
      contactEmail: item.contactEmail || null,
      consentToContact: Boolean(item.consentToContact),
      submittedAt: item.submittedAt || item.createdAt || new Date().toISOString(),
      slaDueAt:
        item.slaDueAt ||
        (() => {
          const base = new Date(item.submittedAt || item.createdAt || Date.now());
          return new Date(base.getTime() + 72 * 60 * 60 * 1000).toISOString();
        })(),
      resubmitCount: Number(item.resubmitCount) || 0,
      status:
        item.status === "approved" || item.status === "rejected"
          ? item.status
          : "pending",
      reviewReasonCode: item.reviewReasonCode || null,
      reviewMemo: item.reviewMemo || null,
      reviewedBy: item.reviewedBy ?? null,
      reviewedAt: item.reviewedAt || null,
      approvedRecordId: item.approvedRecordId ?? null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function writeGuinnessSubmissions(items: GuinnessSubmission[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify(items, null, 2), "utf-8");
}
