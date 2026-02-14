export interface BloodlineCardTransferItem {
  id: number;
  fromUser: { id: number; name: string } | null;
  toUser: { id: number; name: string };
  note: string | null;
  createdAt: string;
}

export interface BloodlineCardItem {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  creator: { id: number; name: string };
  currentOwner: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
  transfers: BloodlineCardTransferItem[];
}

export interface BloodlineCardsResponse {
  success: boolean;
  createdCard: BloodlineCardItem | null;
  ownedCards: BloodlineCardItem[];
  error?: string;
}

export interface BloodlineCardTransferResponse {
  success: boolean;
  error?: string;
}
