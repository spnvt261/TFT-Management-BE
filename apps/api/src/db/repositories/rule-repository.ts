import type { Queryable } from "../postgres/transaction.js";
import type { RuleRecord, RuleSetRecord, RuleSetVersionRecord } from "../../domain/models/records.js";
import { conflict, notFound } from "../../core/errors/app-error.js";
import type { ModuleType } from "../../domain/models/enums.js";

export interface ListRuleSetsInput {
  groupId: string;
  modules?: ModuleType[];
  status?: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface CreateRuleSetInput {
  groupId: string;
  module: ModuleType;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  isDefault: boolean;
}

export interface UpdateRuleSetInput {
  name?: string;
  status?: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
}

export interface CreateRuleVersionRuleInput {
  code: string;
  name: string;
  description: string | null;
  ruleKind: string;
  priority: number;
  status: string;
  stopProcessingOnMatch: boolean;
  metadata: unknown;
  conditions: Array<{
    conditionKey: string;
    operator: string;
    valueJson: unknown;
    sortOrder: number;
  }>;
  actions: Array<{
    actionType: string;
    amountVnd: number;
    sourceSelectorType: string;
    sourceSelectorJson: unknown;
    destinationSelectorType: string;
    destinationSelectorJson: unknown;
    descriptionTemplate: string | null;
    sortOrder: number;
  }>;
}

export interface CreateRuleSetVersionInput {
  ruleSetId: string;
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown;
  builderType: string | null;
  builderConfig: unknown | null;
  rules: CreateRuleVersionRuleInput[];
}

function toJsonDbParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function mapRuleSet(row: {
  id: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}): RuleSetRecord {
  return {
    id: row.id,
    module: row.module as ModuleType,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRule(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rule_kind: string;
  priority: number;
  status: string;
  stop_processing_on_match: boolean;
  metadata_json: unknown;
}): RuleRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    ruleKind: row.rule_kind,
    priority: row.priority,
    status: row.status,
    stopProcessingOnMatch: row.stop_processing_on_match,
    metadata: row.metadata_json,
    conditions: [],
    actions: []
  };
}

export class RuleRepository {
  public constructor(private readonly db: Queryable) {}

  public async listRuleSets(input: ListRuleSetsInput): Promise<{ items: RuleSetRecord[]; total: number }> {
    const conditions = ["group_id = $1"];
    const params: unknown[] = [input.groupId];

    if (input.modules && input.modules.length > 0) {
      params.push(input.modules);
      conditions.push(`module = ANY($${params.length}::module_type[])`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`status = $${params.length}`);
    }

    if (input.isDefault !== undefined) {
      params.push(input.isDefault);
      conditions.push(`is_default = $${params.length}`);
    }

    if (input.search) {
      params.push(`%${input.search}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    if (input.from) {
      params.push(input.from);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (input.to) {
      params.push(input.to);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereSql = conditions.join(" AND ");

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rule_sets WHERE ${whereSql}`,
      params
    );

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const result = await this.db.query<{
      id: string;
      module: string;
      code: string;
      name: string;
      description: string | null;
      status: string;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT rs.id,
             rs.module,
             rs.code,
             rs.name,
             COALESCE(latest_version.description, rs.description) AS description,
             rs.status,
             rs.is_default,
             rs.created_at,
             rs.updated_at
      FROM rule_sets rs
      LEFT JOIN LATERAL (
        SELECT v.description
        FROM rule_set_versions v
        WHERE v.rule_set_id = rs.id
        ORDER BY v.version_no DESC
        LIMIT 1
      ) AS latest_version ON TRUE
      WHERE ${whereSql}
      ORDER BY rs.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: result.rows.map(mapRuleSet),
      total: Number(countResult.rows[0]?.count ?? "0")
    };
  }

  public async createRuleSet(input: CreateRuleSetInput): Promise<RuleSetRecord> {
    if (input.isDefault) {
      await this.db.query(
        `UPDATE rule_sets SET is_default = FALSE, updated_at = now() WHERE group_id = $1 AND module = $2`,
        [input.groupId, input.module]
      );
    }

    try {
      const result = await this.db.query<{
        id: string;
        module: string;
        code: string;
        name: string;
        description: string | null;
        status: string;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }>(
        `
        INSERT INTO rule_sets(group_id, module, code, name, description, status, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, module, code, name, description, status, is_default, created_at, updated_at
        `,
        [input.groupId, input.module, input.code, input.name, null, input.status, input.isDefault]
      );

      return mapRuleSet(result.rows[0]!);
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
        throw conflict("RULE_SET_DUPLICATE", "Rule set code already exists in this group");
      }

      throw error;
    }
  }

  public async getRuleSetById(groupId: string, ruleSetId: string): Promise<RuleSetRecord | null> {
    const result = await this.db.query<{
      id: string;
      module: string;
      code: string;
      name: string;
      description: string | null;
      status: string;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT rs.id,
             rs.module,
             rs.code,
             rs.name,
             COALESCE(latest_version.description, rs.description) AS description,
             rs.status,
             rs.is_default,
             rs.created_at,
             rs.updated_at
      FROM rule_sets rs
      LEFT JOIN LATERAL (
        SELECT v.description
        FROM rule_set_versions v
        WHERE v.rule_set_id = rs.id
        ORDER BY v.version_no DESC
        LIMIT 1
      ) AS latest_version ON TRUE
      WHERE rs.id = $1 AND rs.group_id = $2
      LIMIT 1
      `,
      [ruleSetId, groupId]
    );

    const row = result.rows[0];
    return row ? mapRuleSet(row) : null;
  }

  public async updateRuleSet(groupId: string, ruleSetId: string, input: UpdateRuleSetInput): Promise<RuleSetRecord | null> {
    if (input.isDefault === true) {
      const current = await this.getRuleSetById(groupId, ruleSetId);
      if (!current) {
        throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
      }
      await this.db.query(`UPDATE rule_sets SET is_default = FALSE, updated_at = now() WHERE group_id = $1 AND module = $2`, [
        groupId,
        current.module
      ]);
    }

    const result = await this.db.query<{
      id: string;
    }>(
      `
      UPDATE rule_sets
      SET
        name = COALESCE($3, name),
        status = COALESCE($4, status),
        is_default = COALESCE($5, is_default),
        updated_at = now()
      WHERE id = $1 AND group_id = $2
      RETURNING id
      `,
      [
        ruleSetId,
        groupId,
        input.name ?? null,
        input.status ?? null,
        input.isDefault ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.getRuleSetById(groupId, row.id);
  }

  public async listRuleSetVersions(ruleSetId: string): Promise<RuleSetVersionRecord[]> {
    const versionsResult = await this.db.query<{
      id: string;
      rule_set_id: string;
      version_no: number;
      description: string | null;
      participant_count_min: number;
      participant_count_max: number;
      effective_from: string;
      effective_to: string | null;
      is_active: boolean;
      summary_json: unknown;
      builder_type: string | null;
      builder_config_json: unknown | null;
      created_at: string;
    }>(
      `
      SELECT id, rule_set_id, version_no, description, participant_count_min, participant_count_max, effective_from, effective_to, is_active,
             summary_json, builder_type, builder_config_json, created_at
      FROM rule_set_versions
      WHERE rule_set_id = $1
      ORDER BY version_no DESC
      `,
      [ruleSetId]
    );

    return versionsResult.rows.map((row) => ({
      id: row.id,
      ruleSetId: row.rule_set_id,
      versionNo: row.version_no,
      description: row.description,
      participantCountMin: row.participant_count_min,
      participantCountMax: row.participant_count_max,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active,
      summaryJson: row.summary_json,
      builderType: row.builder_type,
      builderConfig: row.builder_config_json,
      createdAt: row.created_at,
      rules: []
    }));
  }

  public async createRuleSetVersion(input: CreateRuleSetVersionInput): Promise<RuleSetVersionRecord> {
    const versionNoResult = await this.db.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM rule_set_versions WHERE rule_set_id = $1`,
      [input.ruleSetId]
    );

    const versionNo = Number(versionNoResult.rows[0]?.next_version ?? 1);

    const versionResult = await this.db.query<{
      id: string;
      rule_set_id: string;
      version_no: number;
      description: string | null;
      participant_count_min: number;
      participant_count_max: number;
      effective_from: string;
      effective_to: string | null;
      is_active: boolean;
      summary_json: unknown;
      builder_type: string | null;
      builder_config_json: unknown | null;
      created_at: string;
    }>(
      `
      INSERT INTO rule_set_versions(
        rule_set_id, version_no, description, participant_count_min, participant_count_max, effective_from, effective_to, is_active,
        summary_json, builder_type, builder_config_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, rule_set_id, version_no, description, participant_count_min, participant_count_max, effective_from, effective_to,
                is_active, summary_json, builder_type, builder_config_json, created_at
      `,
      [
        input.ruleSetId,
        versionNo,
        input.description,
        input.participantCountMin,
        input.participantCountMax,
        input.effectiveFrom,
        input.effectiveTo,
        input.isActive,
        toJsonDbParam(input.summaryJson),
        input.builderType,
        toJsonDbParam(input.builderConfig)
      ]
    );

    const version = versionResult.rows[0]!;

    await this.db.query(
      `
      UPDATE rule_set_versions
      SET
        is_active = FALSE,
        effective_to = CASE
          WHEN effective_to IS NULL OR effective_to > $2 THEN $2
          ELSE effective_to
        END
      WHERE rule_set_id = $1
        AND id <> $3
        AND is_active = TRUE
      `,
      [input.ruleSetId, input.effectiveFrom, version.id]
    );

    for (const rule of input.rules) {
      const ruleResult = await this.db.query<{
        id: string;
      }>(
        `
        INSERT INTO rules(
          rule_set_version_id, code, name, description, rule_kind, priority, status, stop_processing_on_match, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        `,
        [
          version.id,
          rule.code,
          rule.name,
          rule.description,
          rule.ruleKind,
          rule.priority,
          rule.status,
          rule.stopProcessingOnMatch,
          toJsonDbParam(rule.metadata)
        ]
      );

      const ruleId = ruleResult.rows[0]!.id;

      for (const condition of rule.conditions) {
        await this.db.query(
          `
          INSERT INTO rule_conditions(rule_id, condition_key, operator, value_json, sort_order)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [ruleId, condition.conditionKey, condition.operator, toJsonDbParam(condition.valueJson), condition.sortOrder]
        );
      }

      for (const action of rule.actions) {
        await this.db.query(
          `
          INSERT INTO rule_actions(
            rule_id, action_type, amount_vnd, source_selector_type, source_selector_json,
            destination_selector_type, destination_selector_json, description_template, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            ruleId,
            action.actionType,
            action.amountVnd,
            action.sourceSelectorType,
            toJsonDbParam(action.sourceSelectorJson),
            action.destinationSelectorType,
            toJsonDbParam(action.destinationSelectorJson),
            action.descriptionTemplate,
            action.sortOrder
          ]
        );
      }
    }

    const detail = await this.getRuleSetVersionDetail(input.ruleSetId, version.id);
    if (!detail) {
      throw notFound("RULE_VERSION_NOT_FOUND", "Created rule version was not found");
    }

    return detail;
  }

  public async getRuleSetVersionDetail(ruleSetId: string, versionId: string): Promise<RuleSetVersionRecord | null> {
    const versionResult = await this.db.query<{
      id: string;
      rule_set_id: string;
      version_no: number;
      description: string | null;
      participant_count_min: number;
      participant_count_max: number;
      effective_from: string;
      effective_to: string | null;
      is_active: boolean;
      summary_json: unknown;
      builder_type: string | null;
      builder_config_json: unknown | null;
      created_at: string;
    }>(
      `
      SELECT id, rule_set_id, version_no, description, participant_count_min, participant_count_max, effective_from, effective_to,
             is_active, summary_json, builder_type, builder_config_json, created_at
      FROM rule_set_versions
      WHERE id = $1 AND rule_set_id = $2
      LIMIT 1
      `,
      [versionId, ruleSetId]
    );

    const versionRow = versionResult.rows[0];
    if (!versionRow) {
      return null;
    }

    const rulesResult = await this.db.query<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      rule_kind: string;
      priority: number;
      status: string;
      stop_processing_on_match: boolean;
      metadata_json: unknown;
    }>(
      `
      SELECT id, code, name, description, rule_kind, priority, status, stop_processing_on_match, metadata_json
      FROM rules
      WHERE rule_set_version_id = $1
      ORDER BY priority ASC, created_at ASC
      `,
      [versionId]
    );

    const rules = rulesResult.rows.map(mapRule);

    if (rules.length > 0) {
      const ruleIds = rules.map((item) => item.id);

      const conditionsResult = await this.db.query<{
        id: string;
        rule_id: string;
        condition_key: string;
        operator: string;
        value_json: unknown;
        sort_order: number;
      }>(
        `
        SELECT id, rule_id, condition_key, operator, value_json, sort_order
        FROM rule_conditions
        WHERE rule_id = ANY($1::uuid[])
        ORDER BY sort_order ASC, created_at ASC
        `,
        [ruleIds]
      );

      const actionsResult = await this.db.query<{
        id: string;
        rule_id: string;
        action_type: string;
        amount_vnd: number;
        source_selector_type: string;
        source_selector_json: unknown;
        destination_selector_type: string;
        destination_selector_json: unknown;
        description_template: string | null;
        sort_order: number;
      }>(
        `
        SELECT id, rule_id, action_type, amount_vnd, source_selector_type, source_selector_json,
               destination_selector_type, destination_selector_json, description_template, sort_order
        FROM rule_actions
        WHERE rule_id = ANY($1::uuid[])
        ORDER BY sort_order ASC, created_at ASC
        `,
        [ruleIds]
      );

      for (const rule of rules) {
        rule.conditions = conditionsResult.rows
          .filter((item) => item.rule_id === rule.id)
          .map((item) => ({
            id: item.id,
            conditionKey: item.condition_key,
            operator: item.operator,
            valueJson: item.value_json,
            sortOrder: item.sort_order
          }));

        rule.actions = actionsResult.rows
          .filter((item) => item.rule_id === rule.id)
          .map((item) => ({
            id: item.id,
            actionType: item.action_type,
            amountVnd: item.amount_vnd,
            sourceSelectorType: item.source_selector_type,
            sourceSelectorJson: item.source_selector_json,
            destinationSelectorType: item.destination_selector_type,
            destinationSelectorJson: item.destination_selector_json,
            descriptionTemplate: item.description_template,
            sortOrder: item.sort_order
          }));
      }
    }

    return {
      id: versionRow.id,
      ruleSetId: versionRow.rule_set_id,
      versionNo: versionRow.version_no,
      description: versionRow.description,
      participantCountMin: versionRow.participant_count_min,
      participantCountMax: versionRow.participant_count_max,
      effectiveFrom: versionRow.effective_from,
      effectiveTo: versionRow.effective_to,
      isActive: versionRow.is_active,
      summaryJson: versionRow.summary_json,
      builderType: versionRow.builder_type,
      builderConfig: versionRow.builder_config_json,
      createdAt: versionRow.created_at,
      rules
    };
  }

  public async getDefaultRuleSetByModule(groupId: string, module: ModuleType): Promise<RuleSetRecord | null> {
    const result = await this.db.query<{
      id: string;
      module: string;
      code: string;
      name: string;
      description: string | null;
      status: string;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT rs.id,
             rs.module,
             rs.code,
             rs.name,
             COALESCE(latest_version.description, rs.description) AS description,
             rs.status,
             rs.is_default,
             rs.created_at,
             rs.updated_at
      FROM rule_sets rs
      LEFT JOIN LATERAL (
        SELECT v.description
        FROM rule_set_versions v
        WHERE v.rule_set_id = rs.id
        ORDER BY v.version_no DESC
        LIMIT 1
      ) AS latest_version ON TRUE
      WHERE rs.group_id = $1 AND rs.module = $2 AND rs.is_default = TRUE AND rs.status = 'ACTIVE'
      ORDER BY rs.updated_at DESC
      LIMIT 1
      `,
      [groupId, module]
    );

    const row = result.rows[0];
    return row ? mapRuleSet(row) : null;
  }

  public async resolveVersionForMatch(input: {
    ruleSetId: string;
    module: ModuleType;
    participantCount: number;
    playedAt: string;
    versionId?: string;
  }): Promise<RuleSetVersionRecord | null> {
    if (input.versionId) {
      const versionResult = await this.db.query<{ id: string }>(
        `
        SELECT v.id
        FROM rule_set_versions v
        INNER JOIN rule_sets rs ON rs.id = v.rule_set_id
        WHERE v.id = $1
          AND v.rule_set_id = $2
          AND rs.module = $3
          AND v.participant_count_min <= $4
          AND v.participant_count_max >= $4
          AND v.effective_from <= $5
          AND (v.effective_to IS NULL OR v.effective_to >= $5)
          AND v.is_active = TRUE
        LIMIT 1
        `,
        [input.versionId, input.ruleSetId, input.module, input.participantCount, input.playedAt]
      );

      if (!versionResult.rows[0]) {
        return null;
      }

      return this.getRuleSetVersionDetail(input.ruleSetId, input.versionId);
    }

    const result = await this.db.query<{ id: string }>(
      `
      SELECT v.id
      FROM rule_set_versions v
      INNER JOIN rule_sets rs ON rs.id = v.rule_set_id
      WHERE v.rule_set_id = $1
        AND rs.module = $2
        AND v.participant_count_min <= $3
        AND v.participant_count_max >= $3
        AND v.effective_from <= $4
        AND (v.effective_to IS NULL OR v.effective_to >= $4)
        AND v.is_active = TRUE
      ORDER BY v.version_no DESC
      LIMIT 1
      `,
      [input.ruleSetId, input.module, input.participantCount, input.playedAt]
    );

    const versionId = result.rows[0]?.id;
    if (!versionId) {
      return null;
    }

    return this.getRuleSetVersionDetail(input.ruleSetId, versionId);
  }
}
