import "server-only";

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};
const PAGE_SIZE = 500;

/** Read every row from an ordered PostgREST query without relying on its row cap. */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data ?? []);
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
