-- AvoiD Raid Operations — versioned game knowledge schema.
-- Storage adapters may target local Postgres/SQLite-equivalent semantics later;
-- domain/services must not depend directly on SQL.

create table if not exists knowledge_revision (
  revision text primary key,
  model_version text not null,
  game text not null,
  season text,
  patch text,
  build text,
  generated_at bigint not null,
  activated_at bigint,
  status text not null check (status in ('candidate','active','retired')),
  content_hash text not null,
  evidence_contract_json text not null
);

create table if not exists game_entity (
  revision text not null references knowledge_revision(revision),
  entity_key text not null,
  entity_type text not null,
  external_id text,
  name text,
  encounter_id integer,
  payload_json text not null,
  valid_from text,
  valid_to text,
  primary key (revision, entity_key)
);

create index if not exists idx_game_entity_type on game_entity(revision, entity_type);
create index if not exists idx_game_entity_encounter on game_entity(revision, encounter_id);
create index if not exists idx_game_entity_external on game_entity(entity_type, external_id);

create table if not exists game_entity_reference (
  revision text not null,
  entity_key text not null,
  provider text not null,
  reference_kind text not null,
  reference_id text,
  url text,
  payload_json text,
  primary key (revision, entity_key, provider, reference_kind, reference_id),
  foreign key (revision, entity_key) references game_entity(revision, entity_key)
);

create table if not exists derived_snapshot_revision (
  snapshot_key text primary key,
  report_code text,
  encounter_id integer,
  product_type text not null,
  knowledge_revision text references knowledge_revision(revision),
  evidence_revision text,
  derived_at bigint not null,
  stale integer not null default 0,
  stale_reason text
);

create index if not exists idx_derived_knowledge on derived_snapshot_revision(knowledge_revision, stale);
