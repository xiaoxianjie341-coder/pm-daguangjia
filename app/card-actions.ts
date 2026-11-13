"use server";

import { redirect } from "next/navigation";
import {
  deleteRiskCard,
  hideRiskCard,
  reopenRiskCard,
  resolveRiskCard,
  restoreRiskCard,
  type TodayList,
} from "../src/today-page";
import { withTodayPageDatabase } from "../src/today-page/production";

export async function hideRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) => {
    hideRiskCard(db, { riskCardId });
  });
  redirect(todayPagePath(formData, "today"));
}

export async function restoreRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) => {
    restoreRiskCard(db, { riskCardId });
  });
  redirect(todayPagePath(formData, "today"));
}

export async function resolveRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) => {
    resolveRiskCard(db, { riskCardId });
  });
  redirect(todayPagePath(formData, "today"));
}

export async function reopenRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId");
  withTodayPageDatabase((db) => {
    reopenRiskCard(db, { riskCardId });
  });
  redirect(todayPagePath(formData, "today"));
}

export async function deleteRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId");
  const list = listField(formData);
  withTodayPageDatabase((db) => {
    deleteRiskCard(db, { riskCardId, confirmed: true });
  });
  redirect(todayPagePath(formData, list));
}

function todayPagePath(formData: FormData, list: TodayList): string {
  const params = new URLSearchParams();
  params.set("project", field(formData, "projectId"));
  params.set("date", field(formData, "date"));
  params.set("list", list);
  return `/?${params.toString()}`;
}

function listField(formData: FormData): TodayList {
  const value = formData.get("list");
  if (value === "hidden" || value === "resolved" || value === "today") {
    return value;
  }
  return "today";
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`缺少 ${name}`);
  }
  return value;
}
