export interface ApiResponseBase {
  success: boolean;
  status?: number;
  error?: string;
  message?: string;
}

export type ApiResponse<T extends Record<string, unknown> = Record<string, unknown>> =
  ApiResponseBase & T;

