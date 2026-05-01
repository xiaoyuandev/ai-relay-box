package localgateway

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

var ErrModelSourceNotFound = errors.New("local gateway model source not found")

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (r *SQLiteRepository) ListSources(ctx context.Context) ([]ModelSource, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, base_url, api_key_ref, provider_type, default_model_id, exposed_model_ids_json,
       enabled, position, api_key_masked, last_sync_status, last_sync_error, created_at, updated_at
FROM local_gateway_model_sources
ORDER BY position ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list local gateway model sources: %w", err)
	}
	defer rows.Close()

	items := []ModelSource{}
	for rows.Next() {
		item, err := scanModelSource(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate local gateway model sources: %w", err)
	}

	return items, nil
}

func (r *SQLiteRepository) GetSourceByID(ctx context.Context, id string) (*ModelSource, error) {
	row := r.db.QueryRowContext(ctx, `
SELECT id, name, base_url, api_key_ref, provider_type, default_model_id, exposed_model_ids_json,
       enabled, position, api_key_masked, last_sync_status, last_sync_error, created_at, updated_at
FROM local_gateway_model_sources
WHERE id = ?`, id)

	item, err := scanModelSource(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrModelSourceNotFound
		}
		return nil, err
	}

	return &item, nil
}

func (r *SQLiteRepository) CreateSource(ctx context.Context, item ModelSource) (ModelSource, error) {
	exposedModelIDsJSON, err := json.Marshal(item.ExposedModelIDs)
	if err != nil {
		return ModelSource{}, fmt.Errorf("marshal local gateway exposed model ids: %w", err)
	}

	_, err = r.db.ExecContext(ctx, `
INSERT INTO local_gateway_model_sources (
	id, name, base_url, api_key_ref, provider_type, default_model_id, exposed_model_ids_json,
	enabled, position, api_key_masked, last_sync_status, last_sync_error, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID,
		item.Name,
		item.BaseURL,
		item.APIKeyRef,
		item.ProviderType,
		item.DefaultModelID,
		string(exposedModelIDsJSON),
		boolToInt(item.Enabled),
		item.Position,
		item.APIKeyMasked,
		item.LastSyncStatus,
		item.LastSyncError,
		item.CreatedAt,
		item.UpdatedAt,
	)
	if err != nil {
		return ModelSource{}, fmt.Errorf("insert local gateway model source: %w", err)
	}

	return item, nil
}

func (r *SQLiteRepository) UpdateSource(ctx context.Context, item ModelSource) (ModelSource, error) {
	exposedModelIDsJSON, err := json.Marshal(item.ExposedModelIDs)
	if err != nil {
		return ModelSource{}, fmt.Errorf("marshal local gateway exposed model ids: %w", err)
	}

	result, err := r.db.ExecContext(ctx, `
UPDATE local_gateway_model_sources
SET name = ?, base_url = ?, api_key_ref = ?, provider_type = ?, default_model_id = ?, exposed_model_ids_json = ?,
    enabled = ?, position = ?, api_key_masked = ?, last_sync_status = ?, last_sync_error = ?, created_at = ?, updated_at = ?
WHERE id = ?`,
		item.Name,
		item.BaseURL,
		item.APIKeyRef,
		item.ProviderType,
		item.DefaultModelID,
		string(exposedModelIDsJSON),
		boolToInt(item.Enabled),
		item.Position,
		item.APIKeyMasked,
		item.LastSyncStatus,
		item.LastSyncError,
		item.CreatedAt,
		item.UpdatedAt,
		item.ID,
	)
	if err != nil {
		return ModelSource{}, fmt.Errorf("update local gateway model source: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return ModelSource{}, fmt.Errorf("rows affected for local gateway source update: %w", err)
	}
	if affected == 0 {
		return ModelSource{}, ErrModelSourceNotFound
	}

	return item, nil
}

func (r *SQLiteRepository) DeleteSource(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM local_gateway_model_sources WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete local gateway model source: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected for local gateway source delete: %w", err)
	}
	if affected == 0 {
		return ErrModelSourceNotFound
	}

	return nil
}

func (r *SQLiteRepository) ListSelectedModels(ctx context.Context) ([]SelectedModel, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT model_id, position
FROM local_gateway_selected_models
ORDER BY position ASC, model_id ASC`)
	if err != nil {
		return nil, fmt.Errorf("list local gateway selected models: %w", err)
	}
	defer rows.Close()

	items := []SelectedModel{}
	for rows.Next() {
		var item SelectedModel
		if err := rows.Scan(&item.ModelID, &item.Position); err != nil {
			return nil, fmt.Errorf("scan local gateway selected model: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate local gateway selected models: %w", err)
	}

	return items, nil
}

func (r *SQLiteRepository) ReplaceSelectedModels(ctx context.Context, items []SelectedModel) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin replace local gateway selected models tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `DELETE FROM local_gateway_selected_models`); err != nil {
		return fmt.Errorf("delete local gateway selected models: %w", err)
	}

	for index, item := range items {
		if _, err := tx.ExecContext(ctx, `
INSERT INTO local_gateway_selected_models (model_id, position)
VALUES (?, ?)`,
			item.ModelID,
			index,
		); err != nil {
			return fmt.Errorf("insert local gateway selected model: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit replace local gateway selected models tx: %w", err)
	}

	return nil
}

type modelSourceScanner interface {
	Scan(dest ...any) error
}

func scanModelSource(scanner modelSourceScanner) (ModelSource, error) {
	var (
		item                ModelSource
		exposedModelIDsJSON string
		enabled             int
	)

	if err := scanner.Scan(
		&item.ID,
		&item.Name,
		&item.BaseURL,
		&item.APIKeyRef,
		&item.ProviderType,
		&item.DefaultModelID,
		&exposedModelIDsJSON,
		&enabled,
		&item.Position,
		&item.APIKeyMasked,
		&item.LastSyncStatus,
		&item.LastSyncError,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return ModelSource{}, err
	}

	item.Enabled = enabled == 1
	if exposedModelIDsJSON == "" {
		item.ExposedModelIDs = []string{}
	} else if err := json.Unmarshal([]byte(exposedModelIDsJSON), &item.ExposedModelIDs); err != nil {
		return ModelSource{}, fmt.Errorf("decode local gateway exposed model ids: %w", err)
	}

	return item, nil
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
