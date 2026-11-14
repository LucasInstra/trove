import { Donut } from "./Donut";
import { IconBubble } from "./editorial";
import { Icon3D } from "./Icon3D";
import { computeScore, type Score, type ScoreBreakdown } from "../domain/score";
import type { MonthPlan } from "../domain/projection";
import { useLanguage } from "../lib/language";

const VERDICT: Record<Exclude<Score["weakest"], null>, string> = {
  onTime: "score.fixOnTime",
  margin: "score.fixMargin",
  reserve: "score.fixReserve",
};

const ROWS: Array<{ key: keyof ScoreBreakdown; label: string; max: number }> = [
  { key: "onTime", label: "score.onTime", max: 40 },
  { key: "margin", label: "score.margin", max: 30 },
  { key: "reserve", label: "score.reserve", max: 30 },
];

/** The PF score: on-time bills, margin and reserve in one gauge with a verdict. */
export function ScoreCard({ plan, compact = false }: { plan: MonthPlan; compact?: boolean }) {
  const { t } = useLanguage();
  const score = computeScore(plan);
  const gauge = [
    { color: "var(--primary)", value: score.total },
    { color: "var(--bar-rest)", value: Math.max(0, 100 - score.total) },
  ];

  if (compact) {
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="chart-up" size={22} />
          <span className="compact-title">{t("score.title")}</span>
          <span className="compact-value">{score.total}/100</span>
        </div>
        <div className="compact-body">
          <Donut size={44} thickness={10} segments={gauge} />
          <span className="muted small">
            {score.weakest === null ? t("score.good") : t(VERDICT[score.weakest])}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <IconBubble name="chart-up" size="sm" />
          <h2>{t("score.title")}</h2>
        </div>
      </header>
      <div className="score-gauge">
        <Donut size={120} thickness={16} segments={gauge} centerValue={`${score.total}`} centerLabel="/ 100" />
        <ul className="score-parts">
          {ROWS.map((row) => (
            <li key={row.key}>
              <span className="muted small">{t(row.label)}</span>
              <div className="meter-track slim">
                <div
                  className="meter-fill"
                  style={{ width: `${(score.parts[row.key] / row.max) * 100}%` }}
                />
              </div>
              <span className="muted small">
                {score.parts[row.key]}/{row.max}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="muted small">
        {score.weakest === null ? t("score.good") : t(VERDICT[score.weakest])}
      </p>
    </article>
  );
}
