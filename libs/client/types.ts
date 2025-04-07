export interface ChatRoomMember {
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  lastReadAt?: Date;
}

export interface Message {
  id: number;
  message: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface Product {
  id: number;
  name: string;
  price: number;
  photos: string[];
}

export interface ChatRoom {
  id: number;
  type: "profile" | "product";
  productId: number | null;
  chatRoomMembers: ChatRoomMember[];
  messages: Message[];
  product?: Product;
}

export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
}

export interface MutationResult<T> {
  success: boolean;
  error?: string;
  data?: T;
}
