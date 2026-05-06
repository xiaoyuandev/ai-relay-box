package localgateway

import "context"

type UnsupportedAdapter struct {
	runtimeKind string
}

func NewUnsupportedAdapter(runtimeKind string) *UnsupportedAdapter {
	return &UnsupportedAdapter{
		runtimeKind: normalizeRuntimeKind(runtimeKind),
	}
}

func (a *UnsupportedAdapter) RuntimeKind() string {
	return a.runtimeKind
}

func (a *UnsupportedAdapter) StartRuntime(context.Context, StartRuntimeInput) (RuntimeStatus, error) {
	return RuntimeStatus{}, a.unsupported("start_runtime")
}

func (a *UnsupportedAdapter) StopRuntime(context.Context) error {
	return a.unsupported("stop_runtime")
}

func (a *UnsupportedAdapter) GetRuntimeStatus(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{
		RuntimeKind: a.runtimeKind,
		State:       RuntimeStateError,
		Managed:     true,
		Running:     false,
		Healthy:     false,
		LastError:   "runtime kind is not supported by the current build",
	}, nil
}

func (a *UnsupportedAdapter) GetCapabilities(context.Context) (RuntimeCapabilities, error) {
	return RuntimeCapabilities{}, a.unsupported("get_capabilities")
}

func (a *UnsupportedAdapter) ListModelSources(context.Context) ([]RuntimeModelSource, error) {
	return nil, a.unsupported("list_model_sources")
}

func (a *UnsupportedAdapter) ListModelSourceCapabilities(context.Context) ([]ModelSourceCapability, error) {
	return nil, a.unsupported("list_model_source_capabilities")
}

func (a *UnsupportedAdapter) CheckModelSourceHealth(context.Context, string) (ModelSourceHealthcheck, error) {
	return ModelSourceHealthcheck{}, a.unsupported("check_model_source_health")
}

func (a *UnsupportedAdapter) CreateModelSource(context.Context, RuntimeModelSourceInput) (RuntimeModelSource, error) {
	return RuntimeModelSource{}, a.unsupported("create_model_source")
}

func (a *UnsupportedAdapter) UpdateModelSource(context.Context, string, RuntimeModelSourceInput) (RuntimeModelSource, error) {
	return RuntimeModelSource{}, a.unsupported("update_model_source")
}

func (a *UnsupportedAdapter) DeleteModelSource(context.Context, string) error {
	return a.unsupported("delete_model_source")
}

func (a *UnsupportedAdapter) ListSelectedModels(context.Context) ([]SelectedModel, error) {
	return nil, a.unsupported("list_selected_models")
}

func (a *UnsupportedAdapter) ReplaceSelectedModels(context.Context, []SelectedModel) ([]SelectedModel, error) {
	return nil, a.unsupported("replace_selected_models")
}

func (a *UnsupportedAdapter) SyncFromProductState(context.Context, SyncInput) (SyncResult, error) {
	return SyncResult{}, a.unsupported("sync_from_product_state")
}

func (a *UnsupportedAdapter) unsupported(operation string) error {
	return &AdapterError{
		Code:        AdapterErrorUnsupported,
		Operation:   operation,
		RuntimeKind: a.runtimeKind,
		Message:     "runtime kind is not supported by the current build",
	}
}
