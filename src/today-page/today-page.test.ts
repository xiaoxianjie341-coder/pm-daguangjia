import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  insertFixtureKeyNode,
  insertFixtureProject,
  insertFixtureRiskCard,
} from "./fixtures.ts";
import {
  addKeyNode,
  createRiskCard,
  deleteRiskCard,
  hideRiskCard,
  openTodayPage,
  reopenRiskCard,
  resolveRiskCard,
  restoreRiskCard,
  updateRiskCard,
  type OpenTodayPageInput,
} from "./index.ts";
import * as todayPage from "./index.ts";

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

test("已隐藏列表只列出已隐藏且未解决的风险卡", () => {
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
    insertFixtureRiskCard(db, {
      title: "夹具-隐藏后又解决",
      hidden: true,
      resolved: true,
    });

    const page = openTodayPage(db, { list: "hidden" });

    assert.equal(page.list, "hidden");
    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-已隐藏"],
    );
  } finally {
    db.close();
  }
});

test("已解决列表列出已解决的风险卡", () => {
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
    insertFixtureRiskCard(db, {
      title: "夹具-隐藏后又解决",
      hidden: true,
      resolved: true,
    });

    const page = openTodayPage(db, { list: "resolved" });

    assert.equal(page.list, "resolved");
    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-已解决", "夹具-隐藏后又解决"],
    );
  } finally {
    db.close();
  }
});

test("进入已隐藏列表时选中该列表第一张风险卡，并带回它的关键节点", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const todayCard = insertFixtureRiskCard(db, { title: "夹具-今日卡" });
    const firstHidden = insertFixtureRiskCard(db, {
      title: "夹具-先隐藏",
      hidden: true,
    });
    insertFixtureKeyNode(db, {
      riskCardId: firstHidden.id,
      content: "夹具-隐藏卡上的节点",
      date: "2026-11-02",
    });
    insertFixtureRiskCard(db, { title: "夹具-后隐藏", hidden: true });

    const page = openTodayPage(db, {
      list: "hidden",
      riskCardId: todayCard.id,
    });

    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-先隐藏", "夹具-后隐藏"],
    );
    assert.equal(page.selectedRiskCardId, firstHidden.id);
    assert.deepEqual(
      page.keyNodes.map((node) => node.content),
      ["夹具-隐藏卡上的节点"],
    );
  } finally {
    db.close();
  }
});

test("进入已解决列表时选中该列表第一张风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, { title: "夹具-今日卡" });
    const firstResolved = insertFixtureRiskCard(db, {
      title: "夹具-先解决",
      resolved: true,
    });
    insertFixtureRiskCard(db, { title: "夹具-后解决", resolved: true });

    const page = openTodayPage(db, {
      list: "resolved",
      riskCardId: "不属于这个列表",
    });

    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-先解决", "夹具-后解决"],
    );
    assert.equal(page.selectedRiskCardId, firstResolved.id);
  } finally {
    db.close();
  }
});

test("切换日期不改变已隐藏和已解决列表里的风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const hidden = insertFixtureRiskCard(db, {
      title: "夹具-一月就隐藏",
      hidden: true,
      createdOn: "2026-01-04",
    });
    const resolved = insertFixtureRiskCard(db, {
      title: "夹具-十一月才解决",
      resolved: true,
      createdOn: "2026-11-02",
    });

    const hiddenOnNovember = openTodayPage(db, {
      list: "hidden",
      date: "2026-11-13",
    });
    const hiddenOnOctober = openTodayPage(db, {
      list: "hidden",
      date: "2026-10-01",
    });
    const resolvedOnNovember = openTodayPage(db, {
      list: "resolved",
      date: "2026-11-13",
    });
    const resolvedOnOctober = openTodayPage(db, {
      list: "resolved",
      date: "2026-10-01",
    });

    assert.deepEqual(
      hiddenOnNovember.riskCards.map((card) => card.id),
      [hidden.id],
    );
    assert.deepEqual(
      hiddenOnOctober.riskCards.map((card) => card.id),
      [hidden.id],
    );
    assert.deepEqual(
      resolvedOnNovember.riskCards.map((card) => card.id),
      [resolved.id],
    );
    assert.deepEqual(
      resolvedOnOctober.riskCards.map((card) => card.id),
      [resolved.id],
    );
  } finally {
    db.close();
  }
});

test("隐藏风险卡后它离开今日列表，能在已隐藏里连同关键节点读到", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const stay = insertFixtureRiskCard(db, { title: "夹具-仍在今日" });
    const card = insertFixtureRiskCard(db, { title: "夹具-准备隐藏" });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-隐藏前记下的节点",
      date: "2026-11-13",
    });

    hideRiskCard(db, { riskCardId: card.id });

    const today = openTodayPage(db, { date: "2026-11-13" });
    const hidden = openTodayPage(db, { list: "hidden", date: "2026-11-13" });

    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      ["夹具-仍在今日"],
    );
    assert.equal(today.selectedRiskCardId, stay.id);
    assert.deepEqual(
      hidden.riskCards.map((item) => item.title),
      ["夹具-准备隐藏"],
    );
    assert.equal(hidden.selectedRiskCardId, card.id);
    assert.deepEqual(
      hidden.keyNodes.map((node) => node.content),
      ["夹具-隐藏前记下的节点"],
    );
  } finally {
    db.close();
  }
});

test("恢复风险卡后它回到今日列表，已隐藏里不再有它", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-准备恢复" });
    hideRiskCard(db, { riskCardId: card.id });

    restoreRiskCard(db, { riskCardId: card.id });

    const today = openTodayPage(db);
    const hidden = openTodayPage(db, { list: "hidden" });

    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      ["夹具-准备恢复"],
    );
    assert.equal(today.selectedRiskCardId, card.id);
    assert.deepEqual(
      hidden.riskCards.map((item) => item.title),
      [],
    );
  } finally {
    db.close();
  }
});

test("解决风险卡后它离开今日列表，能在已解决里连同关键节点读到", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const stay = insertFixtureRiskCard(db, { title: "夹具-仍在今日" });
    const card = insertFixtureRiskCard(db, { title: "夹具-准备解决" });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-解决前记下的节点",
      date: "2026-11-08",
    });

    resolveRiskCard(db, { riskCardId: card.id });

    const today = openTodayPage(db);
    const hidden = openTodayPage(db, { list: "hidden" });
    const resolved = openTodayPage(db, { list: "resolved" });

    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      ["夹具-仍在今日"],
    );
    assert.equal(today.selectedRiskCardId, stay.id);
    assert.deepEqual(
      hidden.riskCards.map((item) => item.title),
      [],
    );
    assert.deepEqual(
      resolved.riskCards.map((item) => item.title),
      ["夹具-准备解决"],
    );
    assert.equal(resolved.selectedRiskCardId, card.id);
    assert.deepEqual(
      resolved.keyNodes.map((node) => node.content),
      ["夹具-解决前记下的节点"],
    );
  } finally {
    db.close();
  }
});

test("重新打开风险卡后它回到今日列表，已解决里不再有它", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-准备重新打开" });
    resolveRiskCard(db, { riskCardId: card.id });

    reopenRiskCard(db, { riskCardId: card.id });

    const today = openTodayPage(db);
    const resolved = openTodayPage(db, { list: "resolved" });

    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      ["夹具-准备重新打开"],
    );
    assert.equal(today.selectedRiskCardId, card.id);
    assert.deepEqual(
      resolved.riskCards.map((item) => item.title),
      [],
    );
  } finally {
    db.close();
  }
});

test("未确认时删除会被拒绝，风险卡仍留在今日列表", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-不该被删" });

    assert.throws(
      () => deleteRiskCard(db, { riskCardId: card.id, confirmed: false }),
      /确认/,
    );

    const today = openTodayPage(db);
    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      ["夹具-不该被删"],
    );
  } finally {
    db.close();
  }
});

test("确认删除后，风险卡在今日、已隐藏、已解决里都读不到", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const todayCard = insertFixtureRiskCard(db, { title: "夹具-今日待删" });
    insertFixtureKeyNode(db, {
      riskCardId: todayCard.id,
      content: "夹具-会跟着卡一起消失的节点",
      date: "2026-11-13",
    });
    const hiddenCard = insertFixtureRiskCard(db, { title: "夹具-已隐藏待删" });
    hideRiskCard(db, { riskCardId: hiddenCard.id });
    const resolvedCard = insertFixtureRiskCard(db, { title: "夹具-已解决待删" });
    resolveRiskCard(db, { riskCardId: resolvedCard.id });

    deleteRiskCard(db, { riskCardId: todayCard.id, confirmed: true });
    deleteRiskCard(db, { riskCardId: hiddenCard.id, confirmed: true });
    deleteRiskCard(db, { riskCardId: resolvedCard.id, confirmed: true });

    const today = openTodayPage(db, { riskCardId: todayCard.id });
    const hidden = openTodayPage(db, {
      list: "hidden",
      riskCardId: hiddenCard.id,
    });
    const resolved = openTodayPage(db, {
      list: "resolved",
      riskCardId: resolvedCard.id,
    });

    assert.deepEqual(
      today.riskCards.map((item) => item.title),
      [],
    );
    assert.equal(today.selectedRiskCardId, null);
    assert.deepEqual(
      today.keyNodes.map((node) => node.content),
      [],
    );
    assert.deepEqual(
      hidden.riskCards.map((item) => item.title),
      [],
    );
    assert.deepEqual(
      resolved.riskCards.map((item) => item.title),
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

    assert.equal(page.list, "today");
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

test("选中的风险卡会带回它的全部关键节点内容", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-有节点的卡" });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-先记下样品延期",
      date: "2026-11-01",
    });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-供应商回复了新交期",
      date: "2026-11-12",
    });

    const page = openTodayPage(db);

    assert.equal(page.selectedRiskCardId, card.id);
    assert.deepEqual(
      page.keyNodes.map((node) => node.content),
      ["夹具-先记下样品延期", "夹具-供应商回复了新交期"],
    );
  } finally {
    db.close();
  }
});

test("所选日期会标出当天的关键节点，其他日期的节点仍在", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-跨日期节点" });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-一月的节点",
      date: "2026-01-04",
    });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-十一月十三日的节点",
      date: "2026-11-13",
    });

    const page = openTodayPage(db, { date: "2026-11-13" });

    assert.deepEqual(
      page.keyNodes.map((node) => ({
        content: node.content,
        marked: node.marked,
      })),
      [
        { content: "夹具-一月的节点", marked: false },
        { content: "夹具-十一月十三日的节点", marked: true },
      ],
    );
  } finally {
    db.close();
  }
});

test("关键节点存了跳转链接就带回，没存就不带", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const card = insertFixtureRiskCard(db, { title: "夹具-带链接的卡" });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-能点开的节点",
      date: "2026-11-13",
      link: "https://example.com/fixture-node",
    });
    insertFixtureKeyNode(db, {
      riskCardId: card.id,
      content: "夹具-没有链接的节点",
      date: "2026-11-13",
    });

    const page = openTodayPage(db, { date: "2026-11-13" });

    assert.deepEqual(
      page.keyNodes.map((node) => ({
        content: node.content,
        link: node.link,
      })),
      [
        {
          content: "夹具-能点开的节点",
          link: "https://example.com/fixture-node",
        },
        { content: "夹具-没有链接的节点", link: null },
      ],
    );
  } finally {
    db.close();
  }
});

test("改选另一张风险卡后，右侧换成那张卡的关键节点", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const first = insertFixtureRiskCard(db, { title: "夹具-甲" });
    insertFixtureKeyNode(db, {
      riskCardId: first.id,
      content: "夹具-甲的进度",
      date: "2026-11-02",
    });
    const second = insertFixtureRiskCard(db, { title: "夹具-乙" });
    insertFixtureKeyNode(db, {
      riskCardId: second.id,
      content: "夹具-乙的进度",
      date: "2026-11-09",
    });

    const page = openTodayPage(db, { riskCardId: second.id });

    assert.equal(page.selectedRiskCardId, second.id);
    assert.deepEqual(
      page.keyNodes.map((node) => node.content),
      ["夹具-乙的进度"],
    );
  } finally {
    db.close();
  }
});

test("切换日期不改变今日列表里的风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const earlier = insertFixtureRiskCard(db, {
      title: "夹具-一月写下",
      createdOn: "2026-01-04",
    });
    const later = insertFixtureRiskCard(db, {
      title: "夹具-十一月写下",
      createdOn: "2026-11-02",
    });

    const onNovember = openTodayPage(db, { date: "2026-11-13" });
    const onOctober = openTodayPage(db, { date: "2026-10-01" });

    assert.deepEqual(
      onNovember.riskCards.map((card) => card.id),
      [earlier.id, later.id],
    );
    assert.deepEqual(
      onOctober.riskCards.map((card) => card.id),
      [earlier.id, later.id],
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

test("缺少已消耗或计划时没有消耗条，已消耗为 0 时仍有消耗条", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, {
      title: "夹具-只有已消耗",
      consumed: 5,
    });
    insertFixtureRiskCard(db, {
      title: "夹具-只有计划",
      planned: 12,
    });
    insertFixtureRiskCard(db, {
      title: "夹具-两数都没有",
    });
    insertFixtureRiskCard(db, {
      title: "夹具-已消耗为零",
      consumed: 0,
      planned: 6,
    });

    const page = openTodayPage(db);

    assert.deepEqual(
      page.riskCards.map((card) => ({
        title: card.title,
        consumptionBar: card.consumptionBar,
      })),
      [
        { title: "夹具-只有已消耗", consumptionBar: null },
        { title: "夹具-只有计划", consumptionBar: null },
        { title: "夹具-两数都没有", consumptionBar: null },
        {
          title: "夹具-已消耗为零",
          consumptionBar: { consumed: 0, planned: 6 },
        },
      ],
    );
  } finally {
    db.close();
  }
});

type OpenTodayPagePlanField = Extract<
  keyof OpenTodayPageInput,
  "consumed" | "planned" | "consumptionBar"
>;

const openTodayPageAcceptsPlanAmount: OpenTodayPagePlanField extends never
  ? false
  : true = false;

test("今日一页应用接口不提供修改计划额，读取不会改掉消耗条", () => {
  const db = new DatabaseSync(":memory:");
  try {
    insertFixtureRiskCard(db, {
      title: "夹具-只读消耗条",
      consumed: 4,
      planned: 9,
    });

    const readConsumptionBar = () =>
      openTodayPage(db).riskCards.map((card) => ({
        title: card.title,
        consumptionBar: card.consumptionBar,
      }));
    const expected = [
      {
        title: "夹具-只读消耗条",
        consumptionBar: { consumed: 4, planned: 9 },
      },
    ];

    assert.deepEqual(readConsumptionBar(), expected);
    assert.deepEqual(readConsumptionBar(), expected);
    assert.equal(openTodayPageAcceptsPlanAmount, false);

    const operations = Object.entries(todayPage)
      .filter((entry) => typeof entry[1] === "function")
      .map(([name]) => name);
    const planWriters = operations.filter(
      (name) =>
        /(update|set|change|edit|save|revise|configure|write)/i.test(name) &&
        /(plan|consumption|消耗|计划)/i.test(name),
    );
    assert.deepEqual(planWriters, []);
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

test("手动新增风险卡后再次打开能看到标题，说明可以不填", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const withDescription = createRiskCard(db, {
      projectId,
      title: "夹具-带说明的卡",
      description: "夹具-先把情况写上",
    });
    const titleOnly = createRiskCard(db, {
      projectId,
      title: "夹具-只有标题",
    });
    const blankDescription = createRiskCard(db, {
      projectId,
      title: "夹具-说明是空白",
      description: "   ",
    });

    const page = openTodayPage(db);

    assert.deepEqual(
      page.riskCards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
      })),
      [
        {
          id: withDescription.id,
          title: "夹具-带说明的卡",
          description: "夹具-先把情况写上",
        },
        {
          id: titleOnly.id,
          title: "夹具-只有标题",
          description: null,
        },
        {
          id: blankDescription.id,
          title: "夹具-说明是空白",
          description: null,
        },
      ],
    );
  } finally {
    db.close();
  }
});

test("标题为空时不新增风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    createRiskCard(db, {
      projectId,
      title: "夹具-已经在列表里",
    });

    assert.throws(
      () => createRiskCard(db, { projectId, title: "" }),
      /标题不能为空/,
    );
    assert.throws(
      () =>
        createRiskCard(db, {
          projectId,
          title: "   ",
          description: "夹具-空白标题不该留下说明",
        }),
      /标题不能为空/,
    );

    const page = openTodayPage(db);
    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-已经在列表里"],
    );
  } finally {
    db.close();
  }
});

test("项目不存在时不新增风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    openTodayPage(db);
    assert.throws(
      () =>
        createRiskCard(db, {
          projectId: "missing-project",
          title: "夹具-不该留下",
          description: "夹具-也不该留下",
        }),
      /项目不存在/,
    );

    const page = openTodayPage(db);
    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      [],
    );
  } finally {
    db.close();
  }
});

test("负责人、截止时间和来源写在第一条关键节点上，不出现在风险卡上", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-口头记下的卡",
      description: "夹具-电话里说的",
      owner: "夹具-周宁",
      deadline: "2026-12-01",
      source: "夹具-电话",
      date: "2026-11-13",
    });

    const page = openTodayPage(db, {
      date: "2026-11-13",
      riskCardId: created.id,
    });

    assert.deepEqual(
      page.riskCards.map((card) => ({
        title: card.title,
        description: card.description,
      })),
      [
        {
          title: "夹具-口头记下的卡",
          description: "夹具-电话里说的",
        },
      ],
    );
    assert.equal("owner" in page.riskCards[0], false);
    assert.equal("deadline" in page.riskCards[0], false);
    assert.equal("source" in page.riskCards[0], false);
    assert.deepEqual(
      page.keyNodes.map((node) => ({
        content: node.content,
        date: node.date,
        link: node.link,
        marked: node.marked,
        owner: node.owner,
        deadline: node.deadline,
        source: node.source,
      })),
      [
        {
          content: "负责人：夹具-周宁；截止时间：2026-12-01；来源：夹具-电话",
          date: "2026-11-13",
          link: null,
          marked: true,
          owner: "夹具-周宁",
          deadline: "2026-12-01",
          source: "夹具-电话",
        },
      ],
    );
  } finally {
    db.close();
  }
});

test("只填写来源时第一条关键节点只带来源，三个都空则没有关键节点", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const sourceOnly = createRiskCard(db, {
      projectId,
      title: "夹具-只写来源",
      source: "夹具-口头",
      date: "2026-11-02",
    });
    createRiskCard(db, {
      projectId,
      title: "夹具-没有节点",
      owner: "  ",
      deadline: "",
      source: "",
    });

    const sourcePage = openTodayPage(db, {
      date: "2026-11-02",
      riskCardId: sourceOnly.id,
    });
    assert.deepEqual(
      sourcePage.keyNodes.map((node) => ({
        content: node.content,
        owner: node.owner,
        deadline: node.deadline,
        source: node.source,
        marked: node.marked,
      })),
      [
        {
          content: "来源：夹具-口头",
          owner: null,
          deadline: null,
          source: "夹具-口头",
          marked: true,
        },
      ],
    );

    const listed = openTodayPage(db, { date: "2026-11-02" });
    const withoutNode = listed.riskCards.find(
      (card) => card.title === "夹具-没有节点",
    );
    assert.ok(withoutNode);
    const reread = openTodayPage(db, {
      date: "2026-11-02",
      riskCardId: withoutNode.id,
    });
    assert.deepEqual(reread.keyNodes, []);
  } finally {
    db.close();
  }
});

test("编辑标题和说明后再次打开能看到新内容，关键节点还在", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-旧标题",
      description: "夹具-旧说明",
      owner: "夹具-周宁",
      date: "2026-11-13",
    });

    updateRiskCard(db, {
      riskCardId: created.id,
      title: "夹具-新标题",
      description: "夹具-新说明",
    });

    const page = openTodayPage(db, {
      date: "2026-11-13",
      riskCardId: created.id,
    });
    assert.deepEqual(
      page.riskCards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
      })),
      [
        {
          id: created.id,
          title: "夹具-新标题",
          description: "夹具-新说明",
        },
      ],
    );
    assert.deepEqual(
      page.keyNodes.map((node) => node.owner),
      ["夹具-周宁"],
    );
  } finally {
    db.close();
  }
});

test("标题为空时不改风险卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-保持原标题",
      description: "夹具-保持原说明",
    });

    assert.throws(
      () =>
        updateRiskCard(db, {
          riskCardId: created.id,
          title: "  ",
          description: "夹具-不该写上",
        }),
      /标题不能为空/,
    );

    const page = openTodayPage(db, { riskCardId: created.id });
    assert.deepEqual(
      page.riskCards.map((card) => ({
        title: card.title,
        description: card.description,
      })),
      [{ title: "夹具-保持原标题", description: "夹具-保持原说明" }],
    );
  } finally {
    db.close();
  }
});

test("说明改成空白后再次打开不再带说明", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-清掉说明",
      description: "夹具-原来的说明",
    });

    updateRiskCard(db, {
      riskCardId: created.id,
      title: "夹具-清掉说明",
      description: "  ",
    });

    const page = openTodayPage(db, { riskCardId: created.id });
    assert.deepEqual(
      page.riskCards.map((card) => ({
        title: card.title,
        description: card.description,
      })),
      [{ title: "夹具-清掉说明", description: null }],
    );
  } finally {
    db.close();
  }
});

test("给已有风险卡新增关键节点后再次打开能看到，且不另开卡", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-已有的卡",
      owner: "夹具-周宁",
      date: "2026-11-01",
    });
    const linked = addKeyNode(db, {
      riskCardId: created.id,
      content: "夹具-补上今天的进度",
      link: "https://example.com/fixture-progress",
      date: "2026-11-13",
    });
    addKeyNode(db, {
      riskCardId: created.id,
      content: "夹具-没有链接的进度",
      date: "2026-11-13",
    });

    const page = openTodayPage(db, {
      date: "2026-11-13",
      riskCardId: created.id,
    });

    assert.deepEqual(
      page.riskCards.map((card) => card.title),
      ["夹具-已有的卡"],
    );
    assert.equal(page.keyNodes[1]?.id, linked.id);
    assert.deepEqual(
      page.keyNodes.map((node) => ({
        content: node.content,
        date: node.date,
        link: node.link,
        marked: node.marked,
        owner: node.owner,
      })),
      [
        {
          content: "负责人：夹具-周宁",
          date: "2026-11-01",
          link: null,
          marked: false,
          owner: "夹具-周宁",
        },
        {
          content: "夹具-补上今天的进度",
          date: "2026-11-13",
          link: "https://example.com/fixture-progress",
          marked: true,
          owner: null,
        },
        {
          content: "夹具-没有链接的进度",
          date: "2026-11-13",
          link: null,
          marked: true,
          owner: null,
        },
      ],
    );
  } finally {
    db.close();
  }
});

test("关键节点内容为空时不加节点", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-节点保持原样",
    });
    addKeyNode(db, {
      riskCardId: created.id,
      content: "夹具-原节点",
      date: "2026-11-13",
    });

    assert.throws(
      () => addKeyNode(db, { riskCardId: created.id, content: "  " }),
      /关键节点内容不能为空/,
    );

    const page = openTodayPage(db, {
      date: "2026-11-13",
      riskCardId: created.id,
    });
    assert.deepEqual(
      page.keyNodes.map((node) => node.content),
      ["夹具-原节点"],
    );
  } finally {
    db.close();
  }
});

test("新增关键节点没传日期时落在今日一页当前日期上", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const projectId = openTodayPage(db).project.id;
    const created = createRiskCard(db, {
      projectId,
      title: "夹具-补一个节点",
    });
    addKeyNode(db, {
      riskCardId: created.id,
      content: "夹具-没写日期",
    });

    const page = openTodayPage(db, { riskCardId: created.id });
    assert.equal(page.keyNodes.length, 1);
    assert.equal(page.keyNodes[0]?.content, "夹具-没写日期");
    assert.equal(page.keyNodes[0]?.date, page.date);
    assert.equal(page.keyNodes[0]?.marked, true);
    assert.equal(page.keyNodes[0]?.link, null);
  } finally {
    db.close();
  }
});

test("已隐藏或已解决的风险卡不能改标题、说明或加关键节点", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const hidden = insertFixtureRiskCard(db, {
      title: "夹具-已隐藏原标题",
      hidden: true,
    });
    insertFixtureKeyNode(db, {
      riskCardId: hidden.id,
      content: "夹具-已隐藏原节点",
      date: "2026-11-01",
    });
    const resolved = insertFixtureRiskCard(db, {
      title: "夹具-已解决原标题",
      resolved: true,
    });
    insertFixtureKeyNode(db, {
      riskCardId: resolved.id,
      content: "夹具-已解决原节点",
      date: "2026-11-01",
    });

    assert.throws(
      () =>
        updateRiskCard(db, {
          riskCardId: hidden.id,
          title: "夹具-不该改隐藏",
          description: "夹具-不该写上",
        }),
      /已隐藏或已解决/,
    );
    assert.throws(
      () =>
        addKeyNode(db, {
          riskCardId: hidden.id,
          content: "夹具-不该加在隐藏卡",
          date: "2026-11-13",
        }),
      /已隐藏或已解决/,
    );
    assert.throws(
      () =>
        updateRiskCard(db, {
          riskCardId: resolved.id,
          title: "夹具-不该改解决",
        }),
      /已隐藏或已解决/,
    );
    assert.throws(
      () =>
        addKeyNode(db, {
          riskCardId: resolved.id,
          content: "夹具-不该加在解决卡",
          link: "https://example.com/should-not-land",
          date: "2026-11-13",
        }),
      /已隐藏或已解决/,
    );

    const hiddenPage = openTodayPage(db, {
      list: "hidden",
      date: "2026-11-13",
      riskCardId: hidden.id,
    });
    assert.deepEqual(
      hiddenPage.riskCards.map((card) => ({
        title: card.title,
        description: card.description,
      })),
      [{ title: "夹具-已隐藏原标题", description: null }],
    );
    assert.deepEqual(
      hiddenPage.keyNodes.map((node) => ({
        content: node.content,
        link: node.link,
      })),
      [{ content: "夹具-已隐藏原节点", link: null }],
    );

    const resolvedPage = openTodayPage(db, {
      list: "resolved",
      date: "2026-11-13",
      riskCardId: resolved.id,
    });
    assert.deepEqual(
      resolvedPage.riskCards.map((card) => ({
        title: card.title,
        description: card.description,
      })),
      [{ title: "夹具-已解决原标题", description: null }],
    );
    assert.deepEqual(
      resolvedPage.keyNodes.map((node) => node.content),
      ["夹具-已解决原节点"],
    );

    const today = openTodayPage(db, { date: "2026-11-13" });
    assert.deepEqual(
      today.riskCards.map((card) => card.title),
      [],
    );
  } finally {
    db.close();
  }
});
