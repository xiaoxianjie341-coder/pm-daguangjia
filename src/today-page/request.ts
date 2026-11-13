import type { TodayList } from "./index.ts";

export function field(
  formData: FormData,
  name: string,
  options?: { required?: boolean },
): string {
  const value = formData.get(name);
  const text = typeof value === "string" ? value : "";
  if (options?.required && text.length === 0) {
    throw new Error(`缺少 ${name}`);
  }
  return text;
}

export function parseTodayList(value: unknown): TodayList | undefined {
  if (value === "today" || value === "hidden" || value === "resolved") {
    return value;
  }
  return undefined;
}

export function todayPageHref(input: {
  projectId?: string;
  date?: string;
  list?: TodayList;
  riskCardId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.projectId) params.set("project", input.projectId);
  if (input.date) params.set("date", input.date);
  if (input.list) params.set("list", input.list);
  if (input.riskCardId) params.set("card", input.riskCardId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
