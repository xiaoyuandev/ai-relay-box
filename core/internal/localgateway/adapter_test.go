package localgateway

import (
	"context"
	"errors"
	"testing"
)

var _ GatewayAdapter = (*mockGatewayAdapter)(nil)

type mockGatewayAdapter struct{}

func (m *mockGatewayAdapter) RuntimeKind() string {
	return RuntimeKindAIMiniGateway
}

func (m *mockGatewayAdapter) StartRuntime(context.Context, StartRuntimeInput) (RuntimeStatus, error) {
	return RuntimeStatus{RuntimeKind: RuntimeKindAIMiniGateway, State: RuntimeStateRunning}, nil
}

func (m *mockGatewayAdapter) StopRuntime(context.Context) error {
	return nil
}

func (m *mockGatewayAdapter) GetRuntimeStatus(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{RuntimeKind: RuntimeKindAIMiniGateway, State: RuntimeStateRunning}, nil
}

func (m *mockGatewayAdapter) GetCapabilities(context.Context) (RuntimeCapabilities, error) {
	return RuntimeCapabilities{SupportsAdminAPI: true}, nil
}

func (m *mockGatewayAdapter) ListModelSources(context.Context) ([]RuntimeModelSource, error) {
	return nil, nil
}

func (m *mockGatewayAdapter) ListModelSourceCapabilities(context.Context) ([]ModelSourceCapability, error) {
	return nil, nil
}

func (m *mockGatewayAdapter) CheckModelSourceHealth(context.Context, string) (ModelSourceHealthcheck, error) {
	return ModelSourceHealthcheck{}, nil
}

func (m *mockGatewayAdapter) CreateModelSource(context.Context, RuntimeModelSourceInput) (RuntimeModelSource, error) {
	return RuntimeModelSource{}, nil
}

func (m *mockGatewayAdapter) UpdateModelSource(context.Context, string, RuntimeModelSourceInput) (RuntimeModelSource, error) {
	return RuntimeModelSource{}, nil
}

func (m *mockGatewayAdapter) DeleteModelSource(context.Context, string) error {
	return nil
}

func (m *mockGatewayAdapter) ListSelectedModels(context.Context) ([]SelectedModel, error) {
	return nil, nil
}

func (m *mockGatewayAdapter) ReplaceSelectedModels(context.Context, []SelectedModel) ([]SelectedModel, error) {
	return nil, nil
}

func (m *mockGatewayAdapter) SyncFromProductState(context.Context, SyncInput) (SyncResult, error) {
	return SyncResult{}, nil
}

func TestIsAdapterErrorCode(t *testing.T) {
	t.Parallel()

	root := errors.New("root cause")
	err := &AdapterError{
		Code:        AdapterErrorSyncFailed,
		Operation:   "sync",
		RuntimeKind: RuntimeKindAIMiniGateway,
		Message:     "sync failed",
		Retryable:   true,
		Err:         root,
	}

	if !IsAdapterErrorCode(err, AdapterErrorSyncFailed) {
		t.Fatal("expected adapter error code match")
	}

	wrapped := errors.Join(errors.New("wrapper"), err)
	if !IsAdapterErrorCode(wrapped, AdapterErrorSyncFailed) {
		t.Fatal("expected wrapped adapter error code match")
	}

	if IsAdapterErrorCode(err, AdapterErrorConflict) {
		t.Fatal("did not expect conflict error code match")
	}
}

func TestNewAdapter(t *testing.T) {
	t.Parallel()

	if _, ok := NewAdapter("", nil).(*AIMiniGatewayAdapter); !ok {
		t.Fatal("expected default adapter to be ai-mini-gateway")
	}

	if _, ok := NewAdapter(RuntimeKindAIMiniGateway, nil).(*AIMiniGatewayAdapter); !ok {
		t.Fatal("expected ai-mini-gateway adapter")
	}

	unsupported, ok := NewAdapter("portkey", nil).(*UnsupportedAdapter)
	if !ok {
		t.Fatal("expected unsupported adapter")
	}
	if unsupported.RuntimeKind() != "portkey" {
		t.Fatalf("unexpected unsupported runtime kind: %s", unsupported.RuntimeKind())
	}
}
