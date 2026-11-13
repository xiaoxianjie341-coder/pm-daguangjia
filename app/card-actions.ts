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
import { field, parseTodayList, todayPageHref } from "../src/today-page/request";

export async function hideRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId", { required: true });
  withTodayPageDatabase((db) => {
    hideRiskCard(db, { riskCardId });
  });
  redirect(listedTodayPage(formData, "today"));
}

export async function restoreRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId", { required: true });
  withTodayPageDatabase((db) => {
    restoreRiskCard(db, { riskCardId });
  });
  redirect(listedTodayPage(formData, "today"));
}

export async function resolveRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId", { required: true });
  withTodayPageDatabase((db) => {
    resolveRiskCard(db, { riskCardId });
  });
  redirect(listedTodayPage(formData, "today"));
}

export async function reopenRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId", { required: true });
  withTodayPageDatabase((db) => {
    reopenRiskCard(db, { riskCardId });
  });
  redirect(listedTodayPage(formData, "today"));
}

export async function deleteRiskCardAction(formData: FormData) {
  const riskCardId = field(formData, "riskCardId", { required: true });
  const list = parseTodayList(formData.get("list")) ?? "today";
  withTodayPageDatabase((db) => {
    deleteRiskCard(db, { riskCardId, confirmed: true });
  });
  redirect(listedTodayPage(formData, list));
}

function listedTodayPage(formData: FormData, list: TodayList): string {
  return todayPageHref({
    projectId: field(formData, "projectId", { required: true }),
    date: field(formData, "date", { required: true }),
    list,
  });
}
