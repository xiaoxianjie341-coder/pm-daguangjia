import { openTodayPage, type KeyNode } from "../src/today-page";
import {
  addKeyNodeAction,
  createRiskCardAction,
  updateRiskCardAction,
} from "../src/today-page/actions";
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
              <form className="editor" action={updateRiskCardAction}>
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
                <button type="submit">新增关键节点</button>
              </form>
            </>
          ) : (
            <p className="empty">未选中风险卡</p>
          )}
        </section>
      </div>
    </main>
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
  const parts: string[] = [];
  if (node.owner) parts.push(`负责人：${node.owner}`);
  if (node.deadline) parts.push(`截止时间：${node.deadline}`);
  if (node.source) parts.push(`来源：${node.source}`);
  return parts.length > 0 && node.content === parts.join("；");
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
