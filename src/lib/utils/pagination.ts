export interface PaginationParams {
  page: number;
  perPage: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function parsePagination(
  searchParams: Record<string, string | string[] | undefined>
): PaginationParams {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.perPage) || 10));
  const search = (searchParams.search as string) || undefined;
  const sortBy = (searchParams.sortBy as string) || undefined;
  const sortOrder =
    (searchParams.sortOrder as string) === "asc" ? "asc" : "desc";

  return { page, perPage, search, sortBy, sortOrder };
}

export function paginationMeta(total: number, params: PaginationParams) {
  return {
    total,
    page: params.page,
    perPage: params.perPage,
    totalPages: Math.ceil(total / params.perPage),
  };
}
