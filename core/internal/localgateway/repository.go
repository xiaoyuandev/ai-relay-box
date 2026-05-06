package localgateway

import "context"

type Repository interface {
	ListSources(ctx context.Context) ([]ModelSource, error)
	GetSourceByID(ctx context.Context, id string) (*ModelSource, error)
	CreateSource(ctx context.Context, item ModelSource) (ModelSource, error)
	UpdateSource(ctx context.Context, item ModelSource) (ModelSource, error)
	DeleteSource(ctx context.Context, id string) error
	NormalizeSourcePositions(ctx context.Context) error
	UpdateSourcesSyncState(ctx context.Context, ids []string, status string, syncError string) error
	ListSelectedModels(ctx context.Context) ([]SelectedModel, error)
	ReplaceSelectedModels(ctx context.Context, items []SelectedModel) error
}
