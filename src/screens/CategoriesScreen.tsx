import { useState } from "react";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icons";
import { ScreenHeader } from "./PlannerScreens";
import type { Category, CategoryInput } from "../lib/api";
import { useLanguage } from "../lib/language";

const KINDS = ["expense", "income", "transfer"] as const;

function descendantsOf(categories: Category[], id: number): Set<number> {
  const found = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (category.parentId != null && found.has(category.parentId) && !found.has(category.id)) {
        found.add(category.id);
        grew = true;
      }
    }
  }
  return found;
}

function CategoryDialog({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial?: Category | null;
  categories: Category[];
  onClose: () => void;
  onSave: (input: CategoryInput) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "expense");
  const [color, setColor] = useState(initial?.color ?? "#8b93a1");
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const blocked = initial ? descendantsOf(categories, initial.id) : new Set<number>();

  return (
    <Dialog title={initial ? t("categories.edit") : t("categories.new")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === "") return;
          onSave({
            id: initial?.id ?? null,
            name: name.trim(),
            kind,
            color,
            parentId,
            emoji: emoji.trim(),
            sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
          });
        }}
      >
        <label className="field">
          <span>{t("categories.name")}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t("categories.kind")}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {t(`categories.kind_${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("categories.color")}</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("categories.parent")}</span>
          <select
            value={parentId ?? ""}
            onChange={(event) => setParentId(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">{t("categories.noParent")}</option>
            {categories
              .filter((category) => !blocked.has(category.id))
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji ? `${category.emoji} ` : ""}{category.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>{t("categories.emoji")}</span>
          <input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} placeholder="🏷" />
        </label>
        <label className="field">
          <span>{t("categories.sortOrder")}</span>
          <input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} />
        </label>
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
 * The category tree: roots with their children underneath, archived ones
 * parked at the bottom with a way back. Deleting is blocked server-side
 * while anything points at the category.
 */
export function CategoriesScreen({
  categories,
  onSave,
  onDelete,
  onArchive,
}: {
  categories: Category[];
  onSave: (input: CategoryInput) => void;
  onDelete: (id: number) => void;
  onArchive: (id: number, archived: boolean) => void;
}) {
  const { t } = useLanguage();
  const [dialog, setDialog] = useState<{ category?: Category | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);
  const roots = active
    .filter((category) => category.parentId == null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const childrenOf = (id: number) =>
    active
      .filter((category) => category.parentId === id)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

  const row = (category: Category, depth: number) => (
    <li key={category.id} className="installment" style={depth > 0 ? { paddingLeft: 24 } : undefined}>
      <div className="installment-head">
        <span className="installment-name">
          <span className="dot" style={{ background: category.color }} />
          {category.emoji ? `${category.emoji} ` : ""}{category.name}
        </span>
        <span className="muted small">{t(`categories.kind_${category.kind}` as const)}</span>
        <span className="tx-actions">
          <button
            type="button"
            className="icon-button"
            title={t("common.edit")}
            aria-label={`${t("common.edit")}: ${category.name}`}
            onClick={() => setDialog({ category })}
          >
            <Icon name="pencil" size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={t("categories.archive")}
            aria-label={`${t("categories.archive")}: ${category.name}`}
            onClick={() => onArchive(category.id, true)}
          >
            <Icon name="x" size={15} />
          </button>
          <button
            type="button"
            className="icon-button danger"
            title={t("common.delete")}
            aria-label={`${t("common.delete")}: ${category.name}`}
            onClick={() => setConfirmDelete(category)}
          >
            <Icon name="trash" size={15} />
          </button>
        </span>
      </div>
    </li>
  );

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.settingsGroup")}
        title={t("nav.categories")}
        description={t("categories.description")}
        action={{ label: t("categories.new"), onClick: () => setDialog({ category: null }) }}
      />

      {roots.length === 0 && archived.length === 0 ? (
        <article className="card">
          <p className="card-empty">{t("categories.empty")}</p>
        </article>
      ) : null}

      {roots.length > 0 ? (
        <article className="card">
          <ul className="installment-list">
            {roots.flatMap((root) => [row(root, 0), ...childrenOf(root.id).map((child) => row(child, 1))])}
          </ul>
        </article>
      ) : null}

      {archived.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("categories.archived")}</h2>
            </div>
          </header>
          <ul className="installment-list">
            {archived.map((category) => (
              <li key={category.id} className="installment">
                <div className="installment-head">
                  <span className="installment-name muted">{category.name}</span>
                  <button
                    type="button"
                    className="outline-button small-button"
                    onClick={() => onArchive(category.id, false)}
                  >
                    {t("categories.restore")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {dialog ? (
        <CategoryDialog
          initial={dialog.category ?? null}
          categories={categories}
          onClose={() => setDialog(null)}
          onSave={(input) => {
            onSave(input);
            setDialog(null);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog title={t("categories.confirmDeleteTitle", { name: confirmDelete.name })} onClose={() => setConfirmDelete(null)}>
          <p className="muted">{t("categories.confirmDeleteDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDelete(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
