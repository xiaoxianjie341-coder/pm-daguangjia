"use server";

import { redirect } from "next/navigation";
import { addKeyNode, createRiskCard, updateRiskCard } from "./index";
import { withTodayPageDatabase } from "./production";

export async function createRiskCardAction(formData: FormData): Promise<void> {
  const projectId = field(formData, "projectId");
  const date = field(formData, "date");
  const created = withTodayPageDatabase((db) =>
    createRiskCard(db, {
      projectId,
      title: field(formData, "title"),
      description: field(formData, "description"),
      owner: field(formData, "owner"),
      deadline: field(formData, "deadline"),
      source: field(formData, "source"),
      date,
    }),
  );
  redirect(todayHref({ projectId, date, riskCardId: created.id }));
}

export async function updateRiskCardAction(formData: FormData): Promise<void> {
  const projectId = field(formData, "projectId");
  const date = field(formData, "date");
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) =>
    updateRiskCard(db, {
      riskCardId,
      title: field(formData, "title"),
      description: field(formData, "description"),
    }),
  );
  redirect(todayHref({ projectId, date, riskCardId }));
}

export async function addKeyNodeAction(formData: FormData): Promise<void> {
  const projectId = field(formData, "projectId");
  const date = field(formData, "date");
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) =>
    addKeyNode(db, {
      riskCardId,
      content: field(formData, "content"),
      link: field(formData, "link"),
      date,
    }),
  );
  redirect(todayHref({ projectId, date, riskCardId }));
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function todayHref(input: {
  projectId: string;
  date: string;
  riskCardId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.projectId) params.set("project", input.projectId);
  if (input.date) params.set("date", input.date);
  if (input.riskCardId) params.set("card", input.riskCardId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
