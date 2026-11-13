import {
  deleteRiskCardAction,
  hideRiskCardAction,
  reopenRiskCardAction,
  resolveRiskCardAction,
  restoreRiskCardAction,
} from "./card-actions";
import {
  keyNodeFactSentence,
  openTodayPage,
  type KeyNode,
  type TodayList,
} from "../src/today-page";
import {
  addKeyNodeAction,
  createRiskCardAction,
  updateRiskCardAction,
} from "../src/today-page/actions";
import { withTodayPageDatabase } from "../src/today-page/production";
import { parseTodayList, todayPageHref } from "../src/today-page/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  project?: string | string[];
  date?: string | string[];
  card?: string | string[];
  list?: string | string[];
}>;

const lists: { id: TodayList; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "hidden", label: "已隐藏" },
  { id: "resolved", label: "已解决" },
];

const emptyListCopy: Record<TodayList, string> = {
  today: "当前没有风险卡",
  hidden: "已隐藏里没有风险卡",
  resolved: "已解决里没有风险卡",
};

const editRiskCardFormId = "edit-risk-card";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const page = withTodayPageDatabase((db) =>
    openTodayPage(db, {
      projectId: firstQueryValue(query.project),
      date: firstQueryValue(query.date),
      riskCardId: firstQueryValue(query.card),
      list: parseTodayList(firstQueryValue(query.list)),
    }),
  );
  const selected =
    page.riskCards.find((card) => card.id === page.selectedRiskCardId) ?? null;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="title-block">
          <h1>今日一页</h1>
          <p className="current-project">
            当前项目
            <strong>{page.project.name}</strong>
          </p>
        </div>
        <form className="switcher" method="get" action="/">
          <label>
            项目
            <select name="project" defaultValue={page.project.id}>
              {page.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            日期
            <input type="date" name="date" defaultValue={page.date} />
          </label>
          <time dateTime={page.date}>{page.date}</time>
          <input type="hidden" name="list" value={page.list} />
          {page.selectedRiskCardId ? (
            <input type="hidden" name="card" value={page.selectedRiskCardId} />
          ) : null}
          <button type="submit">打开</button>
        </form>
      </header>
      {page.dataGaps.length > 0 ? (
        <section className="data-gaps" aria-labelledby="gaps-heading">
          <h2 id="gaps-heading">数据缺口</h2>
          <ul>
            {page.dataGaps.map((gap) => (
              <li key={gap.topic}>
                <p className="data-gap-topic">
                  <strong>{gap.topic}</strong>
                  <span>{gap.present ? "已有" : "缺失"}</span>
                </p>
                <p className="data-gap-record">{gap.record}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="board">
        <section className="list-pane" aria-labelledby="risk-heading">
          <h2 id="risk-heading">风险卡</h2>
          <nav className="list-switch" aria-label="风险卡列表">
            {lists.map((item) => {
              const current = item.id === page.list;
              return (
                <a
                  key={item.id}
                  href={todayPageHref({
                    projectId: page.project.id,
                    date: page.date,
                    list: item.id,
                  })}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          {page.riskCards.length === 0 ? (
            <p className="empty">{emptyListCopy[page.list]}</p>
          ) : (
            <ol className="risk-list">
              {page.riskCards.map((card) => {
                const isSelected = card.id === page.selectedRiskCardId;
                return (
                  <li key={card.id} className="risk-item">
                    <a
                      className={
                        isSelected ? "risk-card is-selected" : "risk-card"
                      }
                      href={todayPageHref({
                        projectId: page.project.id,
                        date: page.date,
                        list: page.list,
                        riskCardId: card.id,
                      })}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <p className="risk-card-title">{card.title}</p>
                      {card.consumptionBar ? (
                        <div
                          className="consumption-bar"
                          role="meter"
                          aria-label="消耗条"
                          aria-valuemin={0}
                          aria-valuemax={card.consumptionBar.planned}
                          aria-valuenow={card.consumptionBar.consumed}
                          aria-valuetext={`已消耗 ${card.consumptionBar.consumed}，计划 ${card.consumptionBar.planned}`}
                        >
                          <p className="consumption-bar-scale">
                            <span>已消耗 {card.consumptionBar.consumed}</span>
                            <span>计划 {card.consumptionBar.planned}</span>
                          </p>
                          <div className="consumption-bar-track">
                            <div
                              className="consumption-bar-fill"
                              style={{
                                width: `${consumptionFillPercent(card.consumptionBar)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </a>
                    <div className="card-actions">
                      <CardActions
                        list={page.list}
                        riskCardId={card.id}
                        projectId={page.project.id}
                        date={page.date}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {page.list === "today" ? (
            <form className="editor" action={createRiskCardAction}>
              <h3>新增风险卡</h3>
              <input type="hidden" name="projectId" value={page.project.id} />
              <input type="hidden" name="date" value={page.date} />
              <label>
                标题
                <input name="title" required />
              </label>
              <label>
                说明
                <textarea name="description" rows={2} />
              </label>
              <label>
                负责人
                <input name="owner" />
              </label>
              <label>
                截止时间
                <input name="deadline" type="date" />
              </label>
              <label>
                来源
                <input name="source" />
              </label>
              <button type="submit">新增风险卡</button>
            </form>
          ) : null}
        </section>
        <section className="detail-pane" aria-labelledby="nodes-heading">
          <h2 id="nodes-heading">关键节点</h2>
          {selected ? (
            <>
              <p className="selected-title">{selected.title}</p>
              {selected.description ? (
                <p className="selected-description">{selected.description}</p>
              ) : null}
              {page.keyNodes.length === 0 ? (
                <p className="empty">当前没有关键节点</p>
              ) : (
                <ol className="key-nodes">
                  {page.keyNodes.map((node) => (
                    <li
                      key={node.id}
                      className={node.marked ? "key-node is-marked" : "key-node"}
                    >
                      <div className="key-node-meta">
                        <time dateTime={node.date}>{node.date}</time>
                        {node.marked ? (
                          <span className="key-node-mark">当天</span>
                        ) : null}
                      </div>
                      {node.owner || node.deadline || node.source ? (
                        <dl className="key-node-facts">
                          {node.owner ? (
                            <div>
                              <dt>负责人</dt>
                              <dd>{node.owner}</dd>
                            </div>
                          ) : null}
                          {node.deadline ? (
                            <div>
                              <dt>截止时间</dt>
                              <dd>{node.deadline}</dd>
                            </div>
                          ) : null}
                          {node.source ? (
                            <div>
                              <dt>来源</dt>
                              <dd>{node.source}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                      {nodeBody(node)}
                    </li>
                  ))}
                </ol>
              )}
              {page.list === "today" ? (
                <>
                  <form
                    id={editRiskCardFormId}
                    className="editor"
                    action={updateRiskCardAction}
                  >
                    <h3>编辑标题和说明</h3>
                    <input type="hidden" name="projectId" value={page.project.id} />
                    <input type="hidden" name="date" value={page.date} />
                    <input type="hidden" name="riskCardId" value={selected.id} />
                    <label>
                      标题
                      <input name="title" required defaultValue={selected.title} />
                    </label>
                    <label>
                      说明
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={selected.description ?? ""}
                      />
                    </label>
                    <button type="submit">保存标题和说明</button>
                  </form>
                  <form className="editor" action={addKeyNodeAction}>
                    <h3>新增关键节点</h3>
                    <input type="hidden" name="projectId" value={page.project.id} />
                    <input type="hidden" name="date" value={page.date} />
                    <input type="hidden" name="riskCardId" value={selected.id} />
                    <p className="editor-note">记在 {page.date}</p>
                    <label>
                      内容
                      <textarea name="content" required rows={3} />
                    </label>
                    <label>
                      链接
                      <input name="link" type="url" />
                    </label>
                    <label>
                      负责人
                      <input name="owner" />
                    </label>
                    <label>
                      截止时间
                      <input name="deadline" type="date" />
                    </label>
                    <label>
                      来源
                      <input name="source" />
                    </label>
                    <button type="submit">新增关键节点</button>
                  </form>
                </>
              ) : null}
            </>
          ) : (
            <p className="empty">未选中风险卡</p>
          )}
        </section>
      </div>
    </main>
  );
}

function consumptionFillPercent(bar: {
  consumed: number;
  planned: number;
}): number {
  if (bar.planned <= 0) return 0;
  const ratio = (bar.consumed / bar.planned) * 100;
  if (ratio < 0) return 0;
  if (ratio > 100) return 100;
  return ratio;
}

function CardActions({
  list,
  riskCardId,
  projectId,
  date,
}: {
  list: TodayList;
  riskCardId: string;
  projectId: string;
  date: string;
}) {
  if (list === "hidden") {
    return (
      <>
        <CardActionForm
          action={restoreRiskCardAction}
          label="恢复"
          riskCardId={riskCardId}
          projectId={projectId}
          date={date}
          list={list}
        />
        <DeleteRiskCardControl
          riskCardId={riskCardId}
          projectId={projectId}
          date={date}
          list={list}
        />
      </>
    );
  }
  if (list === "resolved") {
    return (
      <>
        <CardActionForm
          action={reopenRiskCardAction}
          label="重新打开"
          riskCardId={riskCardId}
          projectId={projectId}
          date={date}
          list={list}
        />
        <DeleteRiskCardControl
          riskCardId={riskCardId}
          projectId={projectId}
          date={date}
          list={list}
        />
      </>
    );
  }
  return (
    <>
      <a
        className="card-action"
        href={`${todayPageHref({
          projectId,
          date,
          list,
          riskCardId,
        })}#${editRiskCardFormId}`}
      >
        改
      </a>
      <DeleteRiskCardControl
        riskCardId={riskCardId}
        projectId={projectId}
        date={date}
        list={list}
      />
      <CardActionForm
        action={hideRiskCardAction}
        label="隐藏"
        riskCardId={riskCardId}
        projectId={projectId}
        date={date}
        list={list}
      />
      <CardActionForm
        action={resolveRiskCardAction}
        label="解决"
        riskCardId={riskCardId}
        projectId={projectId}
        date={date}
        list={list}
      />
    </>
  );
}

function CardActionForm({
  action,
  label,
  riskCardId,
  projectId,
  date,
  list,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  riskCardId: string;
  projectId: string;
  date: string;
  list: TodayList;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="riskCardId" value={riskCardId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="list" value={list} />
      <button type="submit" className="card-action">
        {label}
      </button>
    </form>
  );
}

function DeleteRiskCardControl({
  riskCardId,
  projectId,
  date,
  list,
}: {
  riskCardId: string;
  projectId: string;
  date: string;
  list: TodayList;
}) {
  return (
    <details className="delete-confirm">
      <summary className="card-action">删</summary>
      <div className="delete-panel">
        <p>删除后不可恢复。</p>
        <form action={deleteRiskCardAction}>
          <input type="hidden" name="riskCardId" value={riskCardId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="list" value={list} />
          <button type="submit" className="card-action">
            确认删除
          </button>
        </form>
        <a
          href={todayPageHref({
            projectId,
            date,
            list,
            riskCardId,
          })}
        >
          取消
        </a>
      </div>
    </details>
  );
}

function nodeBody(node: KeyNode) {
  if (nodeContentRepeatsFacts(node)) return null;
  if (node.link) {
    return (
      <a className="key-node-link" href={node.link}>
        {node.content}
      </a>
    );
  }
  return <p className="key-node-content">{node.content}</p>;
}

function nodeContentRepeatsFacts(node: KeyNode): boolean {
  const facts = keyNodeFactSentence(node);
  return facts.length > 0 && node.content === facts;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  if (!picked) return undefined;
  return picked;
}
