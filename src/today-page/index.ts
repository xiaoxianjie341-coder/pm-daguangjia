import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ANKER_PROJECT_ID = "anker";
const ANKER_PROJECT_NAME = "安克 · A30 睡眠耳机";

export type Project = {
  id: string;
  name: string;
};

export type ConsumptionBar = {
  readonly consumed: number;
  readonly planned: number;
};

export type RiskCard = {
  id: string;
  title: string;
  description: string | null;
  consumptionBar: ConsumptionBar | null;
};

export type KeyNode = {
  id: string;
  content: string;
  date: string;
  link: string | null;
  marked: boolean;
  owner: string | null;
  deadline: string | null;
  source: string | null;
};

export type TodayList = "today" | "hidden" | "resolved";

export type DataGap = {
  topic: "项目" | "风险卡" | "关键节点" | "消耗条";
  present: boolean;
  record: string;
};

const ANKER_DATA_GAPS: readonly DataGap[] = [
  {
    topic: "项目",
    present: true,
    record: "项目 安克 · A30 睡眠耳机 已在。",
  },
  {
    topic: "风险卡",
    present: false,
    record:
      "没有可复核的安克快照，因此没有写入风险卡。K 进度超阈值和 FS 进度超阈值没有找到可核对的事件，所以没有对应的风险卡。应落成风险卡的待办没有找到可核对的条目，因此没有新增。",
  },
  {
    topic: "关键节点",
    present: false,
    record: "没有可复核的安克快照，因此没有写入关键节点。",
  },
  {
    topic: "消耗条",
    present: false,
    record: "已消耗和计划都缺失，因此安克不展示消耗条。",
  },
];

export type TodayPage = {
  project: Project;
  date: string;
  list: TodayList;
  projects: Project[];
  riskCards: RiskCard[];
  selectedRiskCardId: string | null;
  keyNodes: KeyNode[];
  dataGaps: readonly DataGap[];
};

export type OpenTodayPageInput = {
  projectId?: string;
  date?: string;
  riskCardId?: string;
  list?: TodayList;
};

export function openTodayPage(
  db: DatabaseSync,
  input: OpenTodayPageInput = {},
): TodayPage {
  ensureTodayPageSchema(db);
  const projects = db
    .prepare(`SELECT id, name FROM projects ORDER BY rowid ASC`)
    .all() as Project[];
  const project = resolveProject(projects, input.projectId);
  const list = input.list ?? "today";
  // 日期不筛选列表。日期只标出当天的关键节点。list 决定读今日、已隐藏还是已解决。
  const riskCards = readRiskCards(db, project.id, list);
  const selectedRiskCardId = resolveSelectedRiskCardId(
    riskCards,
    input.riskCardId,
  );
  const date = displayDate(input.date);
  return {
    project,
    date,
    list,
    projects,
    riskCards,
    selectedRiskCardId,
    keyNodes: readKeyNodes(db, selectedRiskCardId, date),
    dataGaps: project.id === ANKER_PROJECT_ID ? ANKER_DATA_GAPS : [],
  };
}

type RiskCardRow = {
  id: string;
  title: string;
  description: string | null;
  consumed: number | null;
  planned: number | null;
};

function readRiskCards(
  db: DatabaseSync,
  projectId: string,
  list: TodayList,
): RiskCard[] {
  const stateClause =
    list === "hidden"
      ? "hidden = 1 AND resolved = 0"
      : list === "resolved"
        ? "resolved = 1"
        : "hidden = 0 AND resolved = 0";
  const rows = db
    .prepare(
      `SELECT id, title, description, consumed, planned
       FROM risk_cards
       WHERE project_id = ? AND ${stateClause}
       ORDER BY rowid ASC`,
    )
    .all(projectId) as RiskCardRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    consumptionBar: consumptionBar(row.consumed, row.planned),
  }));
}

function consumptionBar(
  consumed: number | null,
  planned: number | null,
): ConsumptionBar | null {
  if (consumed == null || planned == null) return null;
  return { consumed, planned };
}

export function deleteRiskCard(
  db: DatabaseSync,
  input: { riskCardId: string; confirmed: boolean },
): void {
  if (input.confirmed !== true) {
    throw new Error("删除风险卡需要确认");
  }
  ensureTodayPageSchema(db);
  const existing = db
    .prepare(`SELECT id FROM risk_cards WHERE id = ?`)
    .get(input.riskCardId) as { id: string } | undefined;
  if (!existing) {
    throw new Error("风险卡不存在");
  }
  db.exec("BEGIN");
  try {
    db.prepare(`DELETE FROM key_nodes WHERE risk_card_id = ?`).run(
      input.riskCardId,
    );
    db.prepare(`DELETE FROM risk_cards WHERE id = ?`).run(input.riskCardId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function reopenRiskCard(
  db: DatabaseSync,
  input: { riskCardId: string },
): void {
  ensureTodayPageSchema(db);
  const result = db
    .prepare(`UPDATE risk_cards SET hidden = 0, resolved = 0 WHERE id = ?`)
    .run(input.riskCardId);
  if (result.changes !== 1) {
    throw new Error("风险卡不存在");
  }
}

export function resolveRiskCard(
  db: DatabaseSync,
  input: { riskCardId: string },
): void {
  ensureTodayPageSchema(db);
  const result = db
    .prepare(`UPDATE risk_cards SET resolved = 1 WHERE id = ?`)
    .run(input.riskCardId);
  if (result.changes !== 1) {
    throw new Error("风险卡不存在");
  }
}

export function restoreRiskCard(
  db: DatabaseSync,
  input: { riskCardId: string },
): void {
  ensureTodayPageSchema(db);
  const result = db
    .prepare(`UPDATE risk_cards SET hidden = 0, resolved = 0 WHERE id = ?`)
    .run(input.riskCardId);
  if (result.changes !== 1) {
    throw new Error("风险卡不存在");
  }
}

export function hideRiskCard(
  db: DatabaseSync,
  input: { riskCardId: string },
): void {
  ensureTodayPageSchema(db);
  const result = db
    .prepare(`UPDATE risk_cards SET hidden = 1 WHERE id = ?`)
    .run(input.riskCardId);
  if (result.changes !== 1) {
    throw new Error("风险卡不存在");
  }
}

type KeyNodeRow = {
  id: string;
  content: string;
  node_date: string;
  link: string | null;
  owner: string | null;
  deadline: string | null;
  source: string | null;
};

function readKeyNodes(
  db: DatabaseSync,
  riskCardId: string | null,
  date: string,
): KeyNode[] {
  if (!riskCardId) return [];
  const rows = db
    .prepare(
      `SELECT id, content, node_date, link, owner, deadline, source
       FROM key_nodes
       WHERE risk_card_id = ?
       ORDER BY rowid ASC`,
    )
    .all(riskCardId) as KeyNodeRow[];
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    date: row.node_date,
    link: row.link ? row.link : null,
    marked: row.node_date === date,
    owner: row.owner ? row.owner : null,
    deadline: row.deadline ? row.deadline : null,
    source: row.source ? row.source : null,
  }));
}

function resolveSelectedRiskCardId(
  riskCards: RiskCard[],
  riskCardId: string | undefined,
): string | null {
  if (riskCardId && riskCards.some((card) => card.id === riskCardId)) {
    return riskCardId;
  }
  return riskCards[0]?.id ?? null;
}

function resolveProject(
  projects: Project[],
  projectId: string | undefined,
): Project {
  if (!projectId) {
    const anker = projects.find((project) => project.id === ANKER_PROJECT_ID);
    if (!anker) {
      throw new Error("默认项目安克不存在");
    }
    return anker;
  }
  const found = projects.find((project) => project.id === projectId);
  if (!found) {
    throw new Error(`项目不存在: ${projectId}`);
  }
  return found;
}

function displayDate(date: string | undefined): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type CreateRiskCardInput = {
  projectId: string;
  title: string;
  description?: string;
  owner?: string;
  deadline?: string;
  source?: string;
  date?: string;
};

export function createRiskCard(
  db: DatabaseSync,
  input: CreateRiskCardInput,
): { id: string } {
  ensureTodayPageSchema(db);
  const title = requiredTitle(input.title);
  const project = db
    .prepare(`SELECT id FROM projects WHERE id = ?`)
    .get(input.projectId) as { id: string } | undefined;
  if (!project) {
    throw new Error(`项目不存在: ${input.projectId}`);
  }
  const description = optionalText(input.description);
  const owner = optionalText(input.owner);
  const deadline = optionalText(input.deadline);
  const source = optionalText(input.source);
  const date = displayDate(input.date);
  const id = randomUUID();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO risk_cards (
         id, project_id, title, hidden, resolved, created_on, description
       ) VALUES (?, ?, ?, 0, 0, ?, ?)`,
    ).run(id, input.projectId, title, date, description);
    if (owner || deadline || source) {
      db.prepare(
        `INSERT INTO key_nodes (
           id, risk_card_id, content, node_date, link, owner, deadline, source
         ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).run(
        randomUUID(),
        id,
        openingNodeContent({ owner, deadline, source }),
        date,
        owner,
        deadline,
        source,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { id };
}

function openingNodeContent(input: {
  owner: string | null;
  deadline: string | null;
  source: string | null;
}): string {
  const parts: string[] = [];
  if (input.owner) parts.push(`负责人：${input.owner}`);
  if (input.deadline) parts.push(`截止时间：${input.deadline}`);
  if (input.source) parts.push(`来源：${input.source}`);
  return parts.join("；");
}

export type UpdateRiskCardInput = {
  riskCardId: string;
  title: string;
  description?: string;
};

export function updateRiskCard(
  db: DatabaseSync,
  input: UpdateRiskCardInput,
): void {
  ensureTodayPageSchema(db);
  assertRiskCardMutable(db, input.riskCardId);
  const title = requiredTitle(input.title);
  if (input.description === undefined) {
    db.prepare(`UPDATE risk_cards SET title = ? WHERE id = ?`).run(
      title,
      input.riskCardId,
    );
    return;
  }
  db.prepare(
    `UPDATE risk_cards SET title = ?, description = ? WHERE id = ?`,
  ).run(title, optionalText(input.description), input.riskCardId);
}

export type AddKeyNodeInput = {
  riskCardId: string;
  content: string;
  link?: string;
  date?: string;
};

export function addKeyNode(
  db: DatabaseSync,
  input: AddKeyNodeInput,
): { id: string } {
  ensureTodayPageSchema(db);
  assertRiskCardMutable(db, input.riskCardId);
  const content = requiredNodeContent(input.content);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO key_nodes (
       id, risk_card_id, content, node_date, link, owner, deadline, source
     ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)`,
  ).run(
    id,
    input.riskCardId,
    content,
    displayDate(input.date),
    optionalText(input.link),
  );
  return { id };
}

function assertRiskCardMutable(db: DatabaseSync, riskCardId: string): void {
  const card = db
    .prepare(`SELECT id, hidden, resolved FROM risk_cards WHERE id = ?`)
    .get(riskCardId) as
    | { id: string; hidden: number; resolved: number }
    | undefined;
  if (!card) {
    throw new Error("风险卡不存在");
  }
  if (card.hidden || card.resolved) {
    throw new Error("已隐藏或已解决的风险卡不能修改");
  }
}

function requiredNodeContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("关键节点内容不能为空");
  }
  return trimmed;
}

function requiredTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("标题不能为空");
  }
  return trimmed;
}

function optionalText(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ensureTodayPageSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS risk_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_on TEXT NOT NULL,
      description TEXT,
      consumed REAL,
      planned REAL
    );
    CREATE TABLE IF NOT EXISTS key_nodes (
      id TEXT PRIMARY KEY,
      risk_card_id TEXT NOT NULL,
      content TEXT NOT NULL,
      node_date TEXT NOT NULL,
      link TEXT,
      owner TEXT,
      deadline TEXT,
      source TEXT
    );
  `);
  ensureColumn(db, "risk_cards", "description", "TEXT");
  ensureColumn(db, "risk_cards", "consumed", "REAL");
  ensureColumn(db, "risk_cards", "planned", "REAL");
  ensureColumn(db, "key_nodes", "owner", "TEXT");
  ensureColumn(db, "key_nodes", "deadline", "TEXT");
  ensureColumn(db, "key_nodes", "source", "TEXT");
  db.prepare(
    `INSERT INTO projects (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`,
  ).run(ANKER_PROJECT_ID, ANKER_PROJECT_NAME);
}

function ensureColumn(
  db: DatabaseSync,
  table: "risk_cards" | "key_nodes",
  column: string,
  definition: string,
): void {
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (item) => item.name,
    ),
  );
  if (!columns.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
