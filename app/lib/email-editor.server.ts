import { blankTemplate } from "../../src/editor/default-document"
import { defaultTemplates } from "../../src/templates/default-templates"
import type {
  EditorBootstrapData,
  EmailDocument,
  EmailTemplateRecord,
  EmailTemplateVersionRecord,
} from "../../src/templates/types"

const TEMPLATE_TABLE = "email_templates"
const VERSION_TABLE = "email_template_versions"

type TemplateRow = {
  id: string
  user_id: string
  name: string
  status: string
  summary: string
  updated_at: number
  document_json: string
}

type VersionRow = {
  id: string
  template_id: string
  template_name: string
  version_number: number
  created_at: number
  document_json: string
}

type EditorMutation =
  | { intent: "create_template"; name?: string }
  | { intent: "save_template"; templateId: string; document: EmailDocument }
  | { intent: "save_version"; templateId: string; document: EmailDocument }
  | { intent: "restore_version"; templateId: string; versionId: string }
  | { intent: "delete_template"; templateId: string }

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString()
}

function parseDocument(raw: string): EmailDocument {
  return JSON.parse(raw) as EmailDocument
}

function toTemplateRecord(row: TemplateRow): EmailTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status as EmailTemplateRecord["status"],
    summary: row.summary,
    updatedAt: toIso(row.updated_at),
    document: parseDocument(row.document_json),
  }
}

function toVersionRecord(row: VersionRow): EmailTemplateVersionRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    versionNumber: row.version_number,
    createdAt: toIso(row.created_at),
    document: parseDocument(row.document_json),
  }
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function summarizeDocument(document: EmailDocument): string {
  const firstTextBlock = document.blocks.find((block) => block.type === "text")

  if (firstTextBlock?.type === "text" && firstTextBlock.content.trim()) {
    return firstTextBlock.content.trim().slice(0, 96)
  }

  if (document.previewText.trim()) {
    return document.previewText.trim().slice(0, 96)
  }

  return "未命名邮件草稿。"
}

async function isStorageReady(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name IN (?, ?)`
    )
    .bind(TEMPLATE_TABLE, VERSION_TABLE)
    .all<{ name: string }>()

  return rows.results.length === 2
}

async function createVersionSnapshot(
  db: D1Database,
  userId: string,
  templateId: string,
  templateName: string,
  document: EmailDocument
) {
  const next = await db
    .prepare(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM ${VERSION_TABLE}
       WHERE template_id = ?`
    )
    .bind(templateId)
    .first<{ next_version: number }>()

  const createdAt = Date.now()

  await db
    .prepare(
      `INSERT INTO ${VERSION_TABLE} (
        id,
        template_id,
        user_id,
        template_name,
        version_number,
        document_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId("tmplver"),
      templateId,
      userId,
      templateName,
      next?.next_version ?? 1,
      JSON.stringify(document),
      createdAt
    )
    .run()
}

async function seedDefaultTemplates(db: D1Database, userId: string) {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${TEMPLATE_TABLE} WHERE user_id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ count: number }>()

  if ((existing?.count ?? 0) > 0) {
    return
  }

  const starters = [blankTemplate, ...defaultTemplates]

  for (const template of starters) {
    const createdAt = Date.now()
    const summary = summarizeDocument(template.document)

    await db
      .prepare(
        `INSERT INTO ${TEMPLATE_TABLE} (
          id,
          user_id,
          name,
          status,
          summary,
          document_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        template.id,
        userId,
        template.name,
        template.status,
        summary,
        JSON.stringify({
          ...template.document,
          updatedAt: toIso(createdAt),
        }),
        createdAt,
        createdAt
      )
      .run()

    await createVersionSnapshot(
      db,
      userId,
      template.id,
      template.name,
      {
        ...template.document,
        updatedAt: toIso(createdAt),
      }
    )
  }
}

async function listTemplates(db: D1Database, userId: string) {
  const rows = await db
    .prepare(
      `SELECT id, user_id, name, status, summary, updated_at, document_json
       FROM ${TEMPLATE_TABLE}
       WHERE user_id = ?
         AND deleted_at IS NULL
       ORDER BY updated_at DESC`
    )
    .bind(userId)
    .all<TemplateRow>()

  return rows.results.map((row) => toTemplateRecord(row))
}

async function listVersions(db: D1Database, userId: string) {
  const rows = await db
    .prepare(
      `SELECT id, template_id, template_name, version_number, created_at, document_json
       FROM ${VERSION_TABLE}
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<VersionRow>()

  return rows.results.reduce<Record<string, EmailTemplateVersionRecord[]>>(
    (acc, row) => {
      const version = toVersionRecord(row)
      acc[version.templateId] = [...(acc[version.templateId] ?? []), version]
      return acc
    },
    {}
  )
}

export async function loadEditorBootstrap(
  db: D1Database,
  userId: string
): Promise<EditorBootstrapData> {
  const ready = await isStorageReady(db)

  if (!ready) {
    return {
      storageReady: false,
      storageMessage:
        "编辑器数据表还没有创建。完成迁移前会使用本地临时模式。",
      templates: [blankTemplate, ...defaultTemplates],
      versionsByTemplate: {},
    }
  }

  await seedDefaultTemplates(db, userId)

  return {
    storageReady: true,
    storageMessage: null,
    templates: await listTemplates(db, userId),
    versionsByTemplate: await listVersions(db, userId),
  }
}

export async function mutateEditorStorage(
  db: D1Database,
  userId: string,
  mutation: EditorMutation
) {
  const ready = await isStorageReady(db)
  if (!ready) {
    throw new Error("编辑器云端存储尚未就绪，请先完成迁移。")
  }

  if (mutation.intent === "create_template") {
    const createdAt = Date.now()
    const templateId = createId("tmpl")
    const name = mutation.name?.trim() || "未命名草稿"
    const document: EmailDocument = {
      ...blankTemplate.document,
      id: templateId,
      name,
      subject: "",
      previewText: "",
      updatedAt: toIso(createdAt),
      blocks: blankTemplate.document.blocks.map((block) => ({ ...block })),
    }

    await db
      .prepare(
        `INSERT INTO ${TEMPLATE_TABLE} (
          id,
          user_id,
          name,
          status,
          summary,
          document_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        templateId,
        userId,
        name,
        "draft",
        summarizeDocument(document),
        JSON.stringify(document),
        createdAt,
        createdAt
      )
      .run()

    await createVersionSnapshot(db, userId, templateId, name, document)
  }

  if (mutation.intent === "save_template") {
    const updatedAt = Date.now()
    const summary = summarizeDocument(mutation.document)

    await db
      .prepare(
        `UPDATE ${TEMPLATE_TABLE}
         SET name = ?,
             summary = ?,
             document_json = ?,
             updated_at = ?
         WHERE id = ?
           AND user_id = ?
           AND deleted_at IS NULL`
      )
      .bind(
        mutation.document.name,
        summary,
        JSON.stringify({
          ...mutation.document,
          updatedAt: toIso(updatedAt),
        }),
        updatedAt,
        mutation.templateId,
        userId
      )
      .run()
  }

  if (mutation.intent === "save_version") {
    const template = await db
      .prepare(
        `SELECT name
         FROM ${TEMPLATE_TABLE}
         WHERE id = ?
           AND user_id = ?
           AND deleted_at IS NULL`
      )
      .bind(mutation.templateId, userId)
      .first<{ name: string }>()

    if (!template) {
      throw new Error("找不到模板。")
    }

    await createVersionSnapshot(
      db,
      userId,
      mutation.templateId,
      template.name,
      mutation.document
    )
  }

  if (mutation.intent === "restore_version") {
    const version = await db
      .prepare(
        `SELECT template_name, document_json
         FROM ${VERSION_TABLE}
         WHERE id = ?
           AND template_id = ?
           AND user_id = ?`
      )
      .bind(mutation.versionId, mutation.templateId, userId)
      .first<{ template_name: string; document_json: string }>()

    if (!version) {
      throw new Error("找不到版本。")
    }

    const restoredDocument = parseDocument(version.document_json)
    const updatedAt = Date.now()

    await createVersionSnapshot(
      db,
      userId,
      mutation.templateId,
      version.template_name,
      restoredDocument
    )

    await db
      .prepare(
        `UPDATE ${TEMPLATE_TABLE}
         SET name = ?,
             summary = ?,
             document_json = ?,
             updated_at = ?
         WHERE id = ?
           AND user_id = ?
           AND deleted_at IS NULL`
      )
      .bind(
        restoredDocument.name,
        summarizeDocument(restoredDocument),
        JSON.stringify({
          ...restoredDocument,
          updatedAt: toIso(updatedAt),
        }),
        updatedAt,
        mutation.templateId,
        userId
      )
      .run()
  }

  if (mutation.intent === "delete_template") {
    const deletedAt = Date.now()

    await db
      .prepare(
        `UPDATE ${TEMPLATE_TABLE}
         SET deleted_at = ?
         WHERE id = ?
           AND user_id = ?
           AND deleted_at IS NULL`
      )
      .bind(deletedAt, mutation.templateId, userId)
      .run()
  }

  return loadEditorBootstrap(db, userId)
}
