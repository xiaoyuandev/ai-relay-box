package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/xiaoyuandev/clash-for-ai/core/internal/credential"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/gateway"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/health"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/localgateway"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/provider"
	"github.com/xiaoyuandev/clash-for-ai/core/internal/storage"
)

func TestLocalGatewayRuntimeEndpointWithoutExecutable(t *testing.T) {
	t.Parallel()

	handler := newTestRouter(t, nil, localgateway.RuntimeConfig{
		Host:    "127.0.0.1",
		Port:    3457,
		DataDir: filepath.Join(t.TempDir(), "runtime"),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/local-gateway/runtime", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Runtime localgateway.RuntimeStatus `json:"runtime"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode runtime payload: %v", err)
	}

	if payload.Runtime.State != localgateway.RuntimeStateStopped {
		t.Fatalf("unexpected runtime state: %+v", payload.Runtime)
	}
	if payload.Runtime.LastError == "" {
		t.Fatalf("expected runtime last error: %+v", payload.Runtime)
	}
}

func TestLocalGatewaySourceAndSyncEndpoints(t *testing.T) {
	t.Parallel()

	adapter := &localgatewaySpyAdapter{
		mockGatewayAdapter: mockGatewayAdapter{},
		runtimeStatus: localgateway.RuntimeStatus{
			RuntimeKind: localgateway.RuntimeKindAIMiniGateway,
			State:       localgateway.RuntimeStateRunning,
			Running:     true,
			Healthy:     true,
			APIBase:     "http://127.0.0.1:3457",
		},
		syncResult: localgateway.SyncResult{
			AppliedSources:        1,
			AppliedSelectedModels: 1,
			LastSyncedAt:          "2026-05-01T00:00:00Z",
		},
	}
	handler := newTestRouter(t, adapter, localgateway.RuntimeConfig{
		Executable: "/tmp/ai-mini-gateway",
		Host:       "127.0.0.1",
		Port:       3457,
		DataDir:    filepath.Join(t.TempDir(), "runtime"),
	})

	createBody := bytes.NewBufferString(`{
		"name":"OpenAI Direct",
		"base_url":"https://api.openai.com/v1",
		"api_key":"sk-test-openai",
		"provider_type":"openai-compatible",
		"default_model_id":"gpt-4.1",
		"enabled":true,
		"position":0
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/local-gateway/sources", createBody)
	createRec := httptest.NewRecorder()
	handler.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("unexpected create status: %d body=%s", createRec.Code, createRec.Body.String())
	}

	selectedBody := bytes.NewBufferString(`[{"model_id":"gpt-4.1","position":0}]`)
	selectedReq := httptest.NewRequest(http.MethodPut, "/api/local-gateway/selected-models", selectedBody)
	selectedRec := httptest.NewRecorder()
	handler.ServeHTTP(selectedRec, selectedReq)
	if selectedRec.Code != http.StatusOK {
		t.Fatalf("unexpected selected status: %d body=%s", selectedRec.Code, selectedRec.Body.String())
	}

	syncReq := httptest.NewRequest(http.MethodPost, "/api/local-gateway/sync", nil)
	syncRec := httptest.NewRecorder()
	handler.ServeHTTP(syncRec, syncReq)
	if syncRec.Code != http.StatusOK {
		t.Fatalf("unexpected sync status: %d body=%s", syncRec.Code, syncRec.Body.String())
	}

	if len(adapter.syncInputs) != 1 {
		t.Fatalf("unexpected sync count: %d", len(adapter.syncInputs))
	}
	if len(adapter.syncInputs[0].Sources) != 1 {
		t.Fatalf("unexpected synced sources: %+v", adapter.syncInputs[0].Sources)
	}
	if adapter.syncInputs[0].Sources[0].APIKey != "sk-test-openai" {
		t.Fatalf("unexpected synced api key: %s", adapter.syncInputs[0].Sources[0].APIKey)
	}
}

func newTestRouter(t *testing.T, adapter localgateway.GatewayAdapter, runtime localgateway.RuntimeConfig) http.Handler {
	t.Helper()

	sqliteStore, err := storage.NewSQLite(filepath.Join(t.TempDir(), "router.db"))
	if err != nil {
		t.Fatalf("create sqlite store: %v", err)
	}
	t.Cleanup(func() { _ = sqliteStore.Close() })

	credentialStore := credential.NewInMemoryStore()
	providerService := provider.NewService(provider.NewInMemoryRepository(), credentialStore)
	healthService := health.NewService(providerService, credentialStore)
	gatewayHandler := gateway.NewHandler(providerService, credentialStore, nil)
	localService := localgateway.NewService(localgateway.NewSQLiteRepository(sqliteStore.DB), credentialStore)
	if adapter == nil {
		adapter = &localgatewaySpyAdapter{
			mockGatewayAdapter: mockGatewayAdapter{},
		}
	}
	manager := localgateway.NewManager(localService, adapter, runtime)

	return NewRouter(providerService, healthService, nil, manager, gatewayHandler)
}

type localgatewaySpyAdapter struct {
	mockGatewayAdapter
	runtimeStatus localgateway.RuntimeStatus
	syncResult    localgateway.SyncResult
	syncInputs    []localgateway.SyncInput
}

func (s *localgatewaySpyAdapter) GetRuntimeStatus(context.Context) (localgateway.RuntimeStatus, error) {
	return s.runtimeStatus, nil
}

func (s *localgatewaySpyAdapter) StartRuntime(context.Context, localgateway.StartRuntimeInput) (localgateway.RuntimeStatus, error) {
	return s.runtimeStatus, nil
}

func (s *localgatewaySpyAdapter) SyncFromProductState(_ context.Context, input localgateway.SyncInput) (localgateway.SyncResult, error) {
	s.syncInputs = append(s.syncInputs, input)
	return s.syncResult, nil
}

type mockGatewayAdapter struct{}

func (m mockGatewayAdapter) RuntimeKind() string {
	return localgateway.RuntimeKindAIMiniGateway
}

func (m mockGatewayAdapter) StartRuntime(context.Context, localgateway.StartRuntimeInput) (localgateway.RuntimeStatus, error) {
	return localgateway.RuntimeStatus{RuntimeKind: localgateway.RuntimeKindAIMiniGateway}, nil
}

func (m mockGatewayAdapter) StopRuntime(context.Context) error {
	return nil
}

func (m mockGatewayAdapter) GetRuntimeStatus(context.Context) (localgateway.RuntimeStatus, error) {
	return localgateway.RuntimeStatus{RuntimeKind: localgateway.RuntimeKindAIMiniGateway}, nil
}

func (m mockGatewayAdapter) GetCapabilities(context.Context) (localgateway.RuntimeCapabilities, error) {
	return localgateway.RuntimeCapabilities{}, nil
}

func (m mockGatewayAdapter) ListModelSources(context.Context) ([]localgateway.RuntimeModelSource, error) {
	return nil, nil
}

func (m mockGatewayAdapter) ListModelSourceCapabilities(context.Context) ([]localgateway.ModelSourceCapability, error) {
	return nil, nil
}

func (m mockGatewayAdapter) CreateModelSource(context.Context, localgateway.RuntimeModelSourceInput) (localgateway.RuntimeModelSource, error) {
	return localgateway.RuntimeModelSource{}, nil
}

func (m mockGatewayAdapter) UpdateModelSource(context.Context, string, localgateway.RuntimeModelSourceInput) (localgateway.RuntimeModelSource, error) {
	return localgateway.RuntimeModelSource{}, nil
}

func (m mockGatewayAdapter) DeleteModelSource(context.Context, string) error {
	return nil
}

func (m mockGatewayAdapter) ListSelectedModels(context.Context) ([]localgateway.SelectedModel, error) {
	return nil, nil
}

func (m mockGatewayAdapter) ReplaceSelectedModels(context.Context, []localgateway.SelectedModel) ([]localgateway.SelectedModel, error) {
	return nil, nil
}

func (m mockGatewayAdapter) SyncFromProductState(context.Context, localgateway.SyncInput) (localgateway.SyncResult, error) {
	return localgateway.SyncResult{}, nil
}
