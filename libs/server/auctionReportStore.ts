import { promises as fs } from "fs";
import path from "path";

export type AuctionReportStatus = "OPEN" | "RESOLVED" | "REJECTED";
export type AuctionReportAction =
  | "NONE"
  | "STOP_AUCTION"
  | "BAN_USER"
  | "STOP_AUCTION_AND_BAN";

export interface AuctionReportItem {
  id: number;
  auctionId: number;
  reporterId: number;
  reportedUserId: number;
  reason: string;
  detail: string;
  status: AuctionReportStatus;
  resolutionAction: AuctionReportAction;
  resolutionNote: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateAuctionReportInput {
  auctionId: number;
  reporterId: number;
  reportedUserId: number;
  reason: string;
  detail: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "auction-reports.json");

const ensureStoreFile = async () => {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, "[]", "utf-8");
  }
};

export const readAuctionReports = async (): Promise<AuctionReportItem[]> => {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAuctionReports = async (items: AuctionReportItem[]) => {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf-8");
};

export const createAuctionReport = async (
  input: CreateAuctionReportInput
): Promise<AuctionReportItem> => {
  const items = await readAuctionReports();
  const now = new Date().toISOString();
  const nextId = items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;

  const created: AuctionReportItem = {
    id: nextId,
    auctionId: input.auctionId,
    reporterId: input.reporterId,
    reportedUserId: input.reportedUserId,
    reason: input.reason,
    detail: input.detail,
    status: "OPEN",
    resolutionAction: "NONE",
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  items.push(created);
  await writeAuctionReports(items);
  return created;
};

export const updateAuctionReport = async (
  reportId: number,
  data: Partial<Omit<AuctionReportItem, "id" | "auctionId" | "reporterId" | "reportedUserId" | "createdAt">>
): Promise<AuctionReportItem | null> => {
  const items = await readAuctionReports();
  const index = items.findIndex((item) => item.id === reportId);
  if (index < 0) return null;

  const updated: AuctionReportItem = {
    ...items[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  await writeAuctionReports(items);

  return updated;
};
