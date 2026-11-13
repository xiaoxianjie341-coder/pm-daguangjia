"use server";

import { redirect } from "next/navigation";
import { addKeyNode, createRiskCard, updateRiskCard } from "./index";
import { withTodayPageDatabase } from "./production";
import { field, todayPageHref } from "./request";

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
  redirect(todayPageHref({ projectId, date, riskCardId: created.id }));
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
  redirect(todayPageHref({ projectId, date, riskCardId }));
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
      owner: field(formData, "owner"),
      deadline: field(formData, "deadline"),
      source: field(formData, "source"),
      date,
    }),
  );
  redirect(todayPageHref({ projectId, date, riskCardId }));
}
