import { openTodayPage } from "../src/today-page";
import { withTodayPageDatabase } from "../src/today-page/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  project?: string | string[];
  date?: string | string[];
  card?: string | string[];
}>;

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
          {page.selectedRiskCardId ? (
            <input type="hidden" name="card" value={page.selectedRiskCardId} />
          ) : null}
          <button type="submit">打开</button>
        </form>
      </header>
      <div className="board">
        <section className="list-pane" aria-labelledby="risk-heading">
          <h2 id="risk-heading">风险卡</h2>
          {page.riskCards.length === 0 ? (
            <p className="empty">当前没有风险卡</p>
          ) : (
            <ol className="risk-list">
              {page.riskCards.map((card) => {
                const isSelected = card.id === page.selectedRiskCardId;
                return (
                  <li key={card.id}>
                    <a
                      className={
                        isSelected ? "risk-card is-selected" : "risk-card"
                      }
                      href={todayPageHref({
                        projectId: page.project.id,
                        date: page.date,
                        riskCardId: card.id,
                      })}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      {card.title}
                    </a>
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

function todayPageHref(input: {
  projectId: string;
  date: string;
  riskCardId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("project", input.projectId);
  params.set("date", input.date);
  if (input.riskCardId) params.set("card", input.riskCardId);
  return `/?${params.toString()}`;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  if (!picked) return undefined;
  return picked;
}
