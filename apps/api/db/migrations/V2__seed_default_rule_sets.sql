-- Deterministic local/demo seed baseline.
-- The seed is idempotent and safe to re-run.

INSERT INTO groups(id, code, name, timezone, currency_code)
VALUES ('11111111-1111-1111-1111-111111111111', 'TFT_FRIENDS', 'TFT Friends', 'Asia/Ho_Chi_Minh', 'VND')
ON CONFLICT (code) DO NOTHING;

INSERT INTO players(id, display_name, slug)
VALUES
  ('22222222-2222-2222-2222-222222222221', 'Sơn', 'son'),
  ('22222222-2222-2222-2222-222222222222', 'Tiến', 'tien'),
  ('22222222-2222-2222-2222-222222222223', 'Đức', 'duc'),
  ('22222222-2222-2222-2222-222222222224', 'Dương', 'duong')
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_members(group_id, player_id, is_primary, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', TRUE, TRUE),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', TRUE, TRUE),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', TRUE, TRUE),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', TRUE, TRUE)
ON CONFLICT (group_id, player_id) DO NOTHING;

INSERT INTO ledger_accounts(id, group_id, account_type, player_id, name)
VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'FUND_MAIN', NULL, 'TFT Fund Main'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'SYSTEM_HOLDING', NULL, 'System Holding'),

  ('33333333-3333-3333-3333-333333333341', '11111111-1111-1111-1111-111111111111', 'PLAYER_DEBT', '22222222-2222-2222-2222-222222222221', 'An Match Stakes'),
  ('33333333-3333-3333-3333-333333333342', '11111111-1111-1111-1111-111111111111', 'PLAYER_DEBT', '22222222-2222-2222-2222-222222222222', 'Binh Match Stakes'),
  ('33333333-3333-3333-3333-333333333343', '11111111-1111-1111-1111-111111111111', 'PLAYER_DEBT', '22222222-2222-2222-2222-222222222223', 'Chi Match Stakes'),
  ('33333333-3333-3333-3333-333333333344', '11111111-1111-1111-1111-111111111111', 'PLAYER_DEBT', '22222222-2222-2222-2222-222222222224', 'Dung Match Stakes'),

  ('33333333-3333-3333-3333-333333333351', '11111111-1111-1111-1111-111111111111', 'PLAYER_FUND_OBLIGATION', '22222222-2222-2222-2222-222222222221', 'An Group Fund Obligation'),
  ('33333333-3333-3333-3333-333333333352', '11111111-1111-1111-1111-111111111111', 'PLAYER_FUND_OBLIGATION', '22222222-2222-2222-2222-222222222222', 'Binh Group Fund Obligation'),
  ('33333333-3333-3333-3333-333333333353', '11111111-1111-1111-1111-111111111111', 'PLAYER_FUND_OBLIGATION', '22222222-2222-2222-2222-222222222223', 'Chi Group Fund Obligation'),
  ('33333333-3333-3333-3333-333333333354', '11111111-1111-1111-1111-111111111111', 'PLAYER_FUND_OBLIGATION', '22222222-2222-2222-2222-222222222224', 'Dung Group Fund Obligation')
ON CONFLICT (group_id, account_type, player_id) DO NOTHING;

-- INSERT INTO rule_sets(id, group_id, module, code, name, description, status, is_default)
-- VALUES
--   ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'MATCH_STAKES', 'MATCH_STAKES_DEFAULT', 'Match Stakes Default', 'Default Match Stakes rule set for 3/4 players', 'ACTIVE', TRUE),
--   ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', 'GROUP_FUND', 'GROUP_FUND_DEFAULT', 'Group Fund Default', 'Default Group Fund rule set for 3 players', 'ACTIVE', TRUE)
-- ON CONFLICT (group_id, code) DO NOTHING;

-- INSERT INTO rule_set_versions(
--   id, rule_set_id, version_no, participant_count_min, participant_count_max, effective_from, is_active, summary_json
-- )
-- VALUES
--   ('55555555-5555-5555-5555-555555555531', '44444444-4444-4444-4444-444444444441', 1, 3, 3, now(), TRUE, '{"name":"Match Stakes 3-player default"}'::jsonb),
--   ('55555555-5555-5555-5555-555555555532', '44444444-4444-4444-4444-444444444441', 2, 4, 4, now(), TRUE, '{"name":"Match Stakes 4-player default"}'::jsonb),
--   ('55555555-5555-5555-5555-555555555533', '44444444-4444-4444-4444-444444444442', 1, 3, 3, now(), TRUE, '{"name":"Group Fund 3-player default"}'::jsonb)
-- ON CONFLICT (rule_set_id, version_no) DO NOTHING;

-- -- Match Stakes 3-player rules
-- INSERT INTO rules(id, rule_set_version_id, code, name, description, rule_kind, priority, status, stop_processing_on_match)
-- VALUES
--   ('66666666-6666-6666-6666-666666666631', '55555555-5555-5555-5555-555555555531', 'MS3_BASE_WINNER', '3P Winner Base', 'Winner receives 100000 from rank2 and rank3', 'BASE_RELATIVE_RANK', 100, 'ACTIVE', FALSE),
--   ('66666666-6666-6666-6666-666666666632', '55555555-5555-5555-5555-555555555531', 'MS3_TOP1_TOP2_PENALTY', 'Top1-Top2 Penalty', 'Top2 pays Top1 10000', 'PAIR_CONDITION_MODIFIER', 200, 'ACTIVE', FALSE),
--   ('66666666-6666-6666-6666-666666666633', '55555555-5555-5555-5555-555555555531', 'MS3_TOP8_PENALTY', 'Top8 Penalty', 'Placement 8 pays best participant 10000', 'ABSOLUTE_PLACEMENT_MODIFIER', 300, 'ACTIVE', FALSE)
-- ON CONFLICT (rule_set_version_id, code) DO NOTHING;

-- INSERT INTO rule_conditions(rule_id, condition_key, operator, value_json, sort_order)
-- VALUES
--   ('66666666-6666-6666-6666-666666666631', 'participantCount', 'EQ', '3'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666631', 'subjectRelativeRank', 'EQ', '1'::jsonb, 2),
--   ('66666666-6666-6666-6666-666666666632', 'participantCount', 'EQ', '3'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666632', 'matchContainsAbsolutePlacements', 'CONTAINS', '[1,2]'::jsonb, 2),
--   ('66666666-6666-6666-6666-666666666633', 'participantCount', 'EQ', '3'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666633', 'matchContainsAbsolutePlacements', 'CONTAINS', '[8]'::jsonb, 2)
-- ON CONFLICT DO NOTHING;

-- INSERT INTO rule_actions(
--   id, rule_id, action_type, amount_vnd,
--   source_selector_type, source_selector_json,
--   destination_selector_type, destination_selector_json,
--   description_template, sort_order
-- )
-- VALUES
--   ('77777777-7777-7777-7777-777777777631', '66666666-6666-6666-6666-666666666631', 'TRANSFER', 50000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":2}'::jsonb, 'SUBJECT_PLAYER', '{}'::jsonb, 'Base 3P: rank2 pays winner 50000', 1),
--   ('77777777-7777-7777-7777-777777777632', '66666666-6666-6666-6666-666666666631', 'TRANSFER', 50000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":3}'::jsonb, 'SUBJECT_PLAYER', '{}'::jsonb, 'Base 3P: rank3 pays winner 50000', 2),
--   ('77777777-7777-7777-7777-777777777633', '66666666-6666-6666-6666-666666666632', 'TRANSFER', 10000, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":2}'::jsonb, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":1}'::jsonb, 'Penalty: top2 pays top1 10000', 1),
--   ('77777777-7777-7777-7777-777777777634', '66666666-6666-6666-6666-666666666633', 'TRANSFER', 10000, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":8}'::jsonb, 'BEST_PARTICIPANT', '{}'::jsonb, 'Penalty: top8 pays best participant 10000', 1)
-- ON CONFLICT (id) DO NOTHING;

-- -- Match Stakes 4-player rules
-- INSERT INTO rules(id, rule_set_version_id, code, name, description, rule_kind, priority, status, stop_processing_on_match)
-- VALUES
--   ('66666666-6666-6666-6666-666666666641', '55555555-5555-5555-5555-555555555532', 'MS4_BASE', '4P Base Distribution', 'Rank3 and rank4 pay rank1 and rank2', 'BASE_RELATIVE_RANK', 100, 'ACTIVE', FALSE),
--   ('66666666-6666-6666-6666-666666666642', '55555555-5555-5555-5555-555555555532', 'MS4_TOP1_TOP2_PENALTY', 'Top1-Top2 Penalty', 'Top2 pays Top1 10000', 'PAIR_CONDITION_MODIFIER', 200, 'ACTIVE', FALSE),
--   ('66666666-6666-6666-6666-666666666643', '55555555-5555-5555-5555-555555555532', 'MS4_TOP8_PENALTY', 'Top8 Penalty', 'Placement 8 pays best participant 10000', 'ABSOLUTE_PLACEMENT_MODIFIER', 300, 'ACTIVE', FALSE)
-- ON CONFLICT (rule_set_version_id, code) DO NOTHING;

-- INSERT INTO rule_conditions(rule_id, condition_key, operator, value_json, sort_order)
-- VALUES
--   ('66666666-6666-6666-6666-666666666641', 'participantCount', 'EQ', '4'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666642', 'participantCount', 'EQ', '4'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666642', 'matchContainsAbsolutePlacements', 'CONTAINS', '[1,2]'::jsonb, 2),
--   ('66666666-6666-6666-6666-666666666643', 'participantCount', 'EQ', '4'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666643', 'matchContainsAbsolutePlacements', 'CONTAINS', '[8]'::jsonb, 2)
-- ON CONFLICT DO NOTHING;

-- INSERT INTO rule_actions(
--   id, rule_id, action_type, amount_vnd,
--   source_selector_type, source_selector_json,
--   destination_selector_type, destination_selector_json,
--   description_template, sort_order
-- )
-- VALUES
--   ('77777777-7777-7777-7777-777777777641', '66666666-6666-6666-6666-666666666641', 'TRANSFER', 35000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":3}'::jsonb, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":1}'::jsonb, 'Base 4P: rank3 pays rank1 35000', 1),
--   ('77777777-7777-7777-7777-777777777642', '66666666-6666-6666-6666-666666666641', 'TRANSFER', 35000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":4}'::jsonb, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":1}'::jsonb, 'Base 4P: rank4 pays rank1 35000', 2),
--   ('77777777-7777-7777-7777-777777777643', '66666666-6666-6666-6666-666666666641', 'TRANSFER', 15000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":3}'::jsonb, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":2}'::jsonb, 'Base 4P: rank3 pays rank2 15000', 3),
--   ('77777777-7777-7777-7777-777777777644', '66666666-6666-6666-6666-666666666641', 'TRANSFER', 15000, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":4}'::jsonb, 'PLAYER_BY_RELATIVE_RANK', '{"relativeRank":2}'::jsonb, 'Base 4P: rank4 pays rank2 15000', 4),
--   ('77777777-7777-7777-7777-777777777645', '66666666-6666-6666-6666-666666666642', 'TRANSFER', 10000, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":2}'::jsonb, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":1}'::jsonb, 'Penalty: top2 pays top1 10000', 1),
--   ('77777777-7777-7777-7777-777777777646', '66666666-6666-6666-6666-666666666643', 'TRANSFER', 10000, 'PLAYER_BY_ABSOLUTE_PLACEMENT', '{"placement":8}'::jsonb, 'BEST_PARTICIPANT', '{}'::jsonb, 'Penalty: top8 pays best participant 10000', 1)
-- ON CONFLICT (id) DO NOTHING;

-- -- Group Fund 3-player rules
-- INSERT INTO rules(id, rule_set_version_id, code, name, description, rule_kind, priority, status, stop_processing_on_match)
-- VALUES
--   ('66666666-6666-6666-6666-666666666651', '55555555-5555-5555-5555-555555555533', 'GF3_RANK2_CONTRIBUTION', 'Rank2 Contribution', 'Rank2 pays 10000 to fund', 'FUND_CONTRIBUTION', 100, 'ACTIVE', FALSE),
--   ('66666666-6666-6666-6666-666666666652', '55555555-5555-5555-5555-555555555533', 'GF3_RANK3_CONTRIBUTION', 'Rank3 Contribution', 'Rank3 pays 20000 to fund', 'FUND_CONTRIBUTION', 110, 'ACTIVE', FALSE)
-- ON CONFLICT (rule_set_version_id, code) DO NOTHING;

-- INSERT INTO rule_conditions(rule_id, condition_key, operator, value_json, sort_order)
-- VALUES
--   ('66666666-6666-6666-6666-666666666651', 'participantCount', 'EQ', '3'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666651', 'subjectRelativeRank', 'EQ', '2'::jsonb, 2),
--   ('66666666-6666-6666-6666-666666666652', 'participantCount', 'EQ', '3'::jsonb, 1),
--   ('66666666-6666-6666-6666-666666666652', 'subjectRelativeRank', 'EQ', '3'::jsonb, 2)
-- ON CONFLICT DO NOTHING;

-- INSERT INTO rule_actions(
--   id, rule_id, action_type, amount_vnd,
--   source_selector_type, source_selector_json,
--   destination_selector_type, destination_selector_json,
--   description_template, sort_order
-- )
-- VALUES
--   ('77777777-7777-7777-7777-777777777651', '66666666-6666-6666-6666-666666666651', 'POST_TO_FUND', 10000, 'SUBJECT_PLAYER', '{}'::jsonb, 'FUND_ACCOUNT', '{}'::jsonb, 'Group fund: rank2 contributes 10000', 1),
--   ('77777777-7777-7777-7777-777777777652', '66666666-6666-6666-6666-666666666652', 'POST_TO_FUND', 20000, 'SUBJECT_PLAYER', '{}'::jsonb, 'FUND_ACCOUNT', '{}'::jsonb, 'Group fund: rank3 contributes 20000', 1)
-- ON CONFLICT (id) DO NOTHING;
