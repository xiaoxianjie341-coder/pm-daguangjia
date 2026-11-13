import {
  deleteRiskCardAction,
  hideRiskCardAction,
  reopenRiskCardAction,
  resolveRiskCardAction,
  restoreRiskCardAction,
} from "./card-actions";
import { openTodayPage, type TodayList } from "../src/today-page";
import { withTodayPageDatabase } from "../src/today-page/production";

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
      list: parseList(firstQueryValue(query.list)),
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
                      {card.title}
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
        </section>
        <section className="detail-pane" aria-labelledby="nodes-heading">
          <h2 id="nodes-heading">关键节点</h2>
          {selected ? (
            <>
              <p className="selected-title">{selected.title}</p>
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
                      {node.link ? (
                        <a className="key-node-link" href={node.link}>
                          {node.content}
                        </a>
                      ) : (
                        <p className="key-node-content">{node.content}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="empty">未选中风险卡</p>
          )}
        </section>
      </div>
    </main>
  );
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
      <button type="button" className="card-action">
        改
      </button>
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

function todayPageHref(input: {
  projectId: string;
  date: string;
  list: TodayList;
  riskCardId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("project", input.projectId);
  params.set("date", input.date);
  params.set("list", input.list);
  if (input.riskCardId) params.set("card", input.riskCardId);
  return `/?${params.toString()}`;
}

function parseList(value: string | undefined): TodayList | undefined {
  if (value === "today" || value === "hidden" || value === "resolved") {
    return value;
  }
  return undefined;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  if (!picked) return undefined;
  return picked;
}
