import { openTodayPage } from "../src/today-page";
import { withTodayPageDatabase } from "../src/today-page/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  project?: string | string[];
  date?: string | string[];
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
                  <li
                    key={card.id}
                    className={isSelected ? "risk-card is-selected" : "risk-card"}
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
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className="detail-pane" aria-labelledby="selected-heading">
          <h2 id="selected-heading">已选风险卡</h2>
          {selected ? (
            <p className="selected-title">{selected.title}</p>
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

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  if (!picked) return undefined;
  return picked;
}
