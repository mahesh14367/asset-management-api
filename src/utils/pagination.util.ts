export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const getPaginationParams = (query: { page?: number; limit?: number }): PaginationParams => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10)); // cap at 100 — prevents someone requesting limit=999999
  return { page, limit };
};

export const buildPaginationMeta = (totalDocs: number, page: number, limit: number): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
  return {
    currentPage: page,
    totalPages,
    totalDocs,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

// Escapes user input before dropping it into a $regex search — prevents
// ReDoS attacks and "regex injection" (e.g. someone searching for ".*")
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');