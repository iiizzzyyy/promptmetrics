export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(query: { page?: string | number; limit?: string | number }): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginatedResponse<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
