import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { insertFixtureProject, insertFixtureRiskCard } from "./fixtures.ts";
import { openTodayPage } from "./index.ts";

test("默认项目的今日一页是安克，没有风险卡时今日列表为空", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const page = openTodayPage(db);

    assert.equal(page.project.name, "安克 · A30 睡眠耳机");
    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      [],
    );
  } finally {
    db.close();
  }
});

test("今日列表只列出未隐藏且未解决的风险卡标题", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, {
      title: "夹具-跟进中",
      hidden: false,
      resolved: false,
    });
    insertFixtureRiskCard(db, {
      title: "夹具-已隐藏",
      hidden: true,
      resolved: false,
    });
    insertFixtureRiskCard(db, {
      title: "夹具-已解决",
      hidden: false,
      resolved: true,
    });

    const page = openTodayPage(db);

    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-跟进中"],
    );
  } finally {
    db.close();
  }
});

test("不同创建日的风险卡在今天和另一天都出现在今日列表", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, {
      title: "夹具-一月写下",
      createdOn: "2026-01-04",
    });
    insertFixtureRiskCard(db, {
      title: "夹具-十一月写下",
      createdOn: "2026-11-02",
    });

    const onToday = openTodayPage(db, { date: "2026-11-13" });
    const onAnotherDay = openTodayPage(db, { date: "2026-10-01" });

    assert.equal(onToday.date, "2026-11-13");
    assert.equal(onAnotherDay.date, "2026-10-01");
    assert.deepEqual(
      onToday.riskCards.map((card) => card.title),
      ["夹具-一月写下", "夹具-十一月写下"],
    );
    assert.deepEqual(
      onAnotherDay.riskCards.map((card) => card.title),
      ["夹具-一月写下", "夹具-十一月写下"],
    );
  } finally {
    db.close();
  }
});

test("进入今日一页时选中当前列表第一张风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const first = insertFixtureRiskCard(db, { title: "夹具-第一张" });
    insertFixtureRiskCard(db, { title: "夹具-第二张" });

    const page = openTodayPage(db);

    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-第一张", "夹具-第二张"],
    );
    assert.equal(page.selectedRiskCardId, first.id);
  } finally {
    db.close();
  }
});

test("项目列表包含安克，打开另一项目只返回该项目的风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureProject(db, { id: "fixture-project", name: "夹具项目" });
    insertFixtureRiskCard(db, { title: "夹具-安克的卡" });
    insertFixtureRiskCard(db, {
      projectId: "fixture-project",
      title: "夹具-另一项目的卡",
    });

    const anker = openTodayPage(db);
    assert.ok(
      anker.projects.some((project) => project.name === "安克 · A30 睡眠耳机"),
    );
    assert.deepEqual(
      anker.riskCards.map((card) => card.title),
      ["夹具-安克的卡"],
    );

    const other = openTodayPage(db, { projectId: "fixture-project" });
    assert.equal(other.project.name, "夹具项目");
    assert.deepEqual(
      other.riskCards.map((card) => card.title),
      ["夹具-另一项目的卡"],
    );
  } finally {
    db.close();
  }
});

test("风险卡同时有已消耗和计划时，今日一页返回消耗条", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, {
      title: "夹具-两数都有",
      consumed: 3,
      planned: 10,
    });

    const page = openTodayPage(db);

    assert.deepEqual(
      page.riskCards.map((card) => ({
        title: card.title,
        consumptionBar: card.consumptionBar,
      })),
      [
        {
          title: "夹具-两数都有",
          consumptionBar: { consumed: 3, planned: 10 },
        },
      ],
    );
  } finally {
    db.close();
  }
});

test("写入 SQLite 文件后，新连接打开同一文件仍能读到风险卡", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "today-page-"));
  const file = path.join(dir, "pm.sqlite");
  try {
    const first = new DatabaseSync(file);
    insertFixtureRiskCard(first, { title: "夹具-再次打开仍在" });
    first.close();

    const second = new DatabaseSync(file);
    try {
      const page = openTodayPage(second);
      assert.equal(page.project.name, "安克 · A30 睡眠耳机");
      assert.deepEqual(
        page.riskCards.map((card) => card.title),
        ["夹具-再次打开仍在"],
      );
    } finally {
      second.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
