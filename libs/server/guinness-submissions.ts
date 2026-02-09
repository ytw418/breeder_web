import client from "@libs/server/client";

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
  speciesId: number | null;
  speciesRawText: string | null;
  recordType: GuinnessRecordType;
  value: number;
  measurementDate: string | Date | null;
  description: string | null;
  proofPhotos: string[];
  contactPhone: string | null;
  contactEmail: string | null;
  consentToContact: boolean;
  submittedAt: string | Date;
  slaDueAt: string | Date;
  resubmitCount: number;
  status: GuinnessSubmissionStatus;
  reviewReasonCode: GuinnessRejectionReasonCode | null;
  reviewMemo: string | null;
  reviewedBy: number | null;
  reviewedAt: string | Date | null;
  approvedRecordId: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export async function readGuinnessSubmissions(): Promise<GuinnessSubmission[]> {
  return client.guinnessSubmission.findMany();
}
