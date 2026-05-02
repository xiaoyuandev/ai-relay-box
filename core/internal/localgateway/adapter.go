package localgateway

import "context"

const (
	RuntimeKindAIMiniGateway = "ai-mini-gateway"
)

// GatewayAdapter isolates the current product contract from any specific
// third-party local gateway runtime.
type GatewayAdapter interface {
	RuntimeKind() string
	StartRuntime(ctx context.Context, input StartRuntimeInput) (RuntimeStatus, error)
	StopRuntime(ctx context.Context) error
	GetRuntimeStatus(ctx context.Context) (RuntimeStatus, error)
	GetCapabilities(ctx context.Context) (RuntimeCapabilities, error)
	ListModelSources(ctx context.Context) ([]RuntimeModelSource, error)
	ListModelSourceCapabilities(ctx context.Context) ([]ModelSourceCapability, error)
	CheckModelSourceHealth(ctx context.Context, id string) (ModelSourceHealthcheck, error)
	CreateModelSource(ctx context.Context, input RuntimeModelSourceInput) (RuntimeModelSource, error)
	UpdateModelSource(ctx context.Context, id string, input RuntimeModelSourceInput) (RuntimeModelSource, error)
	DeleteModelSource(ctx context.Context, id string) error
	ListSelectedModels(ctx context.Context) ([]SelectedModel, error)
	ReplaceSelectedModels(ctx context.Context, items []SelectedModel) ([]SelectedModel, error)
	SyncFromProductState(ctx context.Context, input SyncInput) (SyncResult, error)
}
