import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import { parseCents } from "./PlannerDialogs";
import type { Category, Rule, RuleInput } from "../lib/api";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";

const TARGETS = ["merchant", "description", "both"] as const;
const SIGNS = ["any", "in", "out"] as const;

function RuleDialog({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial: Rule | null;
  categories: Category[];
  onClose: () => void;
  onSave: (input: RuleInput) => void;
}) {
  const { t } = useLanguage();
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(initial?.target ?? "both");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? 0);
  const [sign, setSign] = useState<(typeof SIGNS)[number]>(initial?.sign ?? "any");
  const [min, setMin] = useState(
    initial?.minAmountCents != null ? (initial.minAmountCents / 100).toFixed(2) : "",
  );
  const [max, setMax] = useState(
    initial?.maxAmountCents != null ? (initial.maxAmountCents / 100).toFixed(2) : "",
  );
  const [priority, setPriority] = useState(initial?.priority ?? 0);

  return (
    <Dialog title={initial ? t("rules.edit") : t("rules.new")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (pattern.trim() === "" || categoryId === 0) return;
          const minCents = min.trim() === "" ? null : parseCents(min);
          const maxCents = max.trim() === "" ? null : parseCents(max);
          if (minCents !== null && maxCents !== null && minCents > maxCents) return;
          onSave({
            id: initial?.id ?? null,
            pattern: pattern.trim(),
            target,
            categoryId,
            sign,
            minAmountCents: minCents,
            maxAmountCents: maxCents,
            priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
          });
        }}
      >
        <label className="field">
          <span>{t("rules.pattern")}</span>
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder={t("rules.patternHint")}
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>{t("rules.target")}</span>
            <select value={target} onChange={(event) => setTarget(event.target.value as typeof target)}>
              {TARGETS.map((option) => (
                <option key={option} value={option}>
                  {t(`rules.target_${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("planner.category")}</span>
            <select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryName(t, category.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("rules.sign")}</span>
            <select value={sign} onChange={(event) => setSign(event.target.value as typeof sign)}>
              {SIGNS.map((option) => (
                <option key={option} value={option}>
                  {t(`rules.sign_${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("rules.priority")}</span>
            <input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} />
          </label>
          <label className="field">
            <span>{t("rules.minAmount")}</span>
            <input value={min} onChange={(event) => setMin(event.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>{t("rules.maxAmount")}</span>
            <input value={max} onChange={(event) => setMax(event.target.value)} inputMode="decimal" />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Auto-categorization rules, parked with the categories they assign. First
 * match by priority wins on every import; "apply now" re-runs the book over
 * whatever is still uncategorized.
 */
export function RulesManager({
  rules,
  categories,
  onSave,
  onDelete,
  onApply,
}: {
  rules: Rule[];
  categories: Category[];
  onSave: (input: RuleInput) => void;
  onDelete: (id: number) => void;
  onApply: () => Promise<number>;
}) {
  const { t } = useLanguage();
  const [dialog, setDialog] = useState<{ rule: Rule | null } | null>(null);
  const [applied, setApplied] = useState<string>("");

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("rules.title")}</h2>
        </div>
        <span className="muted">{t("rules.desc")}</span>
      </header>
      <div className="row">
        <button type="button" className="outline-button small-button" onClick={() => setDialog({ rule: null })}>
          <Icon name="plus" size={14} />
          {t("rules.new")}
        </button>
        <button
          type="button"
          className="outline-button small-button"
          onClick={() =>
            void onApply().then((count) => setApplied(t("rules.applied", { count })))
          }
        >
          {t("rules.apply")}
        </button>
        {applied ? <span className="muted small">{applied}</span> : null}
      </div>
      {rules.length > 0 ? (
        <ul className="installment-list">
          {rules.map((rule) => (
            <li key={rule.id} className="installment">
              <div className="installment-head">
                <span className="installment-name">
                  <span className="dot" style={{ background: rule.categoryColor }} />
                  {rule.pattern} → {categoryName(t, rule.categoryName)}
                </span>
                <span className="muted small">
                  {t(`rules.target_${rule.target}`)} · {t(`rules.sign_${rule.sign}`)}
                </span>
                <span className="tx-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title={t("common.edit")}
                    aria-label={`${t("common.edit")}: ${rule.pattern}`}
                    onClick={() => setDialog({ rule })}
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title={t("common.delete")}
                    aria-label={`${t("common.delete")}: ${rule.pattern}`}
                    onClick={() => onDelete(rule.id)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card-empty">{t("rules.empty")}</p>
      )}
      {dialog ? (
        <RuleDialog
          initial={dialog.rule}
          categories={categories}
          onClose={() => setDialog(null)}
          onSave={(input) => {
            onSave(input);
            setDialog(null);
          }}
        />
      ) : null}
    </article>
  );
}
