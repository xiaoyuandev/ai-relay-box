package localgateway

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/xiaoyuandev/clash-for-ai/core/internal/credential"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/storage"
)

func TestManagerCreateSourceMarksPending(t *testing.T) {
	t.Parallel()

	manager := newTestManager(t, &mockGatewayAdapter{})

	item, err := manager.CreateSource(context.Background(), CreateModelSourceInput{
		Name:           "OpenAI Direct",
		BaseURL:        "https://api.openai.com/v1",
		APIKey:         "sk-test-openai",
		ProviderType:   "openai-compatible",
		DefaultModelID: "gpt-4.1",
		Enabled:        true,
		Position:       0,
	})
	if err != nil {
		t.Fatalf("create source: %v", err)
	}

	if item.LastSyncStatus != SourceSyncStatusPending {
		t.Fatalf("unexpected source sync status: %s", item.LastSyncStatus)
	}
}

func TestManagerSyncMarksSourcesSynced(t *testing.T) {
	t.Parallel()

	adapter := &spyGatewayAdapter{
		runtimeStatus: RuntimeStatus{
			RuntimeKind: RuntimeKindAIMiniGateway,
			State:       RuntimeStateRunning,
			Running:     true,
			Healthy:     true,
			APIBase:     "http://127.0.0.1:3457",
		},
		syncResult: SyncResult{
			AppliedSources:        1,
			AppliedSelectedModels: 1,
			LastSyncedAt:          "2026-05-01T00:00:00Z",
		},
	}
	manager := newTestManager(t, adapter)
	manager.runtime.Executable = "/tmp/ai-mini-gateway"

	item, err := manager.CreateSource(context.Background(), CreateModelSourceInput{
		Name:           "OpenAI Direct",
		BaseURL:        "https://api.openai.com/v1",
		APIKey:         "sk-test-openai",
		ProviderType:   "openai-compatible",
		DefaultModelID: "gpt-4.1",
		Enabled:        true,
		Position:       0,
	})
	if err != nil {
		t.Fatalf("create source: %v", err)
	}

	if _, err := manager.ReplaceSelectedModels(context.Background(), []SelectedModel{
		{ModelID: "gpt-4.1", Position: 0},
	}); err != nil {
		t.Fatalf("replace selected models: %v", err)
	}

	result, err := manager.Sync(context.Background())
	if err != nil {
		t.Fatalf("sync: %v", err)
	}

	if result.AppliedSources != 1 || result.AppliedSelectedModels != 1 {
		t.Fatalf("unexpected sync result: %+v", result)
	}

	sources, err := manager.ListSources(context.Background())
	if err != nil {
		t.Fatalf("list sources: %v", err)
	}
	if len(sources) != 1 {
		t.Fatalf("unexpected sources length: %d", len(sources))
	}
	if sources[0].LastSyncStatus != SourceSyncStatusSynced {
		t.Fatalf("unexpected synced status: %s", sources[0].LastSyncStatus)
	}

	if len(adapter.syncInputs) != 1 {
		t.Fatalf("unexpected sync input count: %d", len(adapter.syncInputs))
	}
	if len(adapter.syncInputs[0].Sources) != 1 || adapter.syncInputs[0].Sources[0].ID != item.ID {
		t.Fatalf("unexpected synced sources: %+v", adapter.syncInputs[0].Sources)
	}
	if adapter.syncInputs[0].Sources[0].APIKey != "sk-test-openai" {
		t.Fatalf("unexpected synced api key: %s", adapter.syncInputs[0].Sources[0].APIKey)
	}
}

func TestManagerStatusUsesAdapterRuntimeKindWhenUnconfigured(t *testing.T) {
	t.Parallel()

	manager := newTestManager(t, NewUnsupportedAdapter("portkey"))
	status, err := manager.GetRuntimeStatus(context.Background())
	if err != nil {
		t.Fatalf("get runtime status: %v", err)
	}

	if status.RuntimeKind != "portkey" {
		t.Fatalf("unexpected runtime kind: %s", status.RuntimeKind)
	}
}

func newTestManager(t *testing.T, adapter GatewayAdapter) *Manager {
	t.Helper()

	sqliteStore, err := storage.NewSQLite(filepath.Join(t.TempDir(), "manager.db"))
	if err != nil {
		t.Fatalf("create sqlite store: %v", err)
	}
	t.Cleanup(func() { _ = sqliteStore.Close() })

	service := NewService(NewSQLiteRepository(sqliteStore.DB), credential.NewInMemoryStore())
	return NewManager(service, adapter, RuntimeConfig{
		Host:    "127.0.0.1",
		Port:    3457,
		DataDir: filepath.Join(t.TempDir(), "runtime"),
	})
}

type spyGatewayAdapter struct {
	mockGatewayAdapter
	runtimeStatus RuntimeStatus
	syncResult    SyncResult
	syncInputs    []SyncInput
}

func (s *spyGatewayAdapter) GetRuntimeStatus(context.Context) (RuntimeStatus, error) {
	return s.runtimeStatus, nil
}

func (s *spyGatewayAdapter) StartRuntime(context.Context, StartRuntimeInput) (RuntimeStatus, error) {
	s.runtimeStatus.Running = true
	s.runtimeStatus.State = RuntimeStateRunning
	return s.runtimeStatus, nil
}

func (s *spyGatewayAdapter) SyncFromProductState(_ context.Context, input SyncInput) (SyncResult, error) {
	s.syncInputs = append(s.syncInputs, input)
	return s.syncResult, nil
}
