package localgateway

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
)

func TestAIMiniGatewayAdapterGetCapabilities(t *testing.T) {
	t.Parallel()

	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/capabilities" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		return jsonResponse(http.StatusOK, map[string]any{
			"supports_openai_compatible":      true,
			"supports_anthropic_compatible":   true,
			"supports_models_api":             true,
			"supports_stream":                 true,
			"supports_admin_api":              true,
			"supports_model_source_admin":     true,
			"supports_selected_model_admin":   true,
			"supports_source_capabilities":    true,
			"supports_atomic_source_sync":     true,
			"supports_runtime_version":        true,
			"supports_explicit_source_health": true,
		}), nil
	})}

	adapter := NewAIMiniGatewayAdapter(client)
	adapter.status = RuntimeStatus{
		RuntimeKind: RuntimeKindAIMiniGateway,
		State:       RuntimeStateRunning,
		Running:     true,
		Healthy:     true,
		APIBase:     "http://runtime.test",
	}

	caps, err := adapter.GetCapabilities(context.Background())
	if err != nil {
		t.Fatalf("get capabilities: %v", err)
	}

	if !caps.SupportsOpenAICompatible || !caps.SupportsSelectedModelAdmin {
		t.Fatalf("unexpected capabilities: %+v", caps)
	}
	if !caps.SupportsAtomicSourceSync || !caps.SupportsRuntimeVersion || !caps.SupportsExplicitSourceHealth {
		t.Fatalf("expected extended capabilities: %+v", caps)
	}
}

func TestAIMiniGatewayAdapterGetRuntimeStatusParsesMetadata(t *testing.T) {
	t.Parallel()

	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/health" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		return jsonResponse(http.StatusOK, map[string]any{
			"status":       "ok",
			"version":      "1.2.3",
			"commit":       "abcdef1",
			"runtime_kind": RuntimeKindAIMiniGateway,
		}), nil
	})}

	adapter := NewAIMiniGatewayAdapter(client)
	adapter.status = RuntimeStatus{
		RuntimeKind: RuntimeKindAIMiniGateway,
		State:       RuntimeStateRunning,
		Running:     true,
		Healthy:     true,
		APIBase:     "http://runtime.test",
	}

	status, err := adapter.GetRuntimeStatus(context.Background())
	if err != nil {
		t.Fatalf("get runtime status: %v", err)
	}

	if status.Version != "1.2.3" || status.Commit != "abcdef1" {
		t.Fatalf("unexpected runtime metadata: %+v", status)
	}
}

func TestAIMiniGatewayAdapterSyncFromProductStateAtomic(t *testing.T) {
	t.Parallel()

	state := newFakeAIMiniGatewayRuntime(true)
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return state.roundTrip(t, r)
	})}

	adapter := NewAIMiniGatewayAdapter(client)
	adapter.status = RuntimeStatus{
		RuntimeKind: RuntimeKindAIMiniGateway,
		State:       RuntimeStateRunning,
		Running:     true,
		Healthy:     true,
		APIBase:     "http://runtime.test",
	}

	result, err := adapter.SyncFromProductState(context.Background(), SyncInput{
		Sources: []SyncModelSource{
			{
				ID:              "source-b",
				Name:            "Anthropic",
				BaseURL:         "https://api.anthropic.com/v1",
				APIKey:          "sk-ant",
				ProviderType:    "anthropic-compatible",
				DefaultModelID:  "claude-sonnet-4-0",
				ExposedModelIDs: []string{"claude-haiku-4-0"},
				Enabled:         true,
				Position:        1,
			},
			{
				ID:             "source-a",
				Name:           "OpenAI",
				BaseURL:        "https://api.openai.com/v1",
				APIKey:         "sk-openai",
				ProviderType:   "openai-compatible",
				DefaultModelID: "gpt-4.1",
				Enabled:        true,
				Position:       0,
			},
		},
		SelectedModels: []SelectedModel{
			{ModelID: "claude-sonnet-4-0", Position: 4},
			{ModelID: "gpt-4.1", Position: 9},
		},
	})
	if err != nil {
		t.Fatalf("sync from product state: %v", err)
	}

	if result.AppliedSources != 2 {
		t.Fatalf("unexpected applied sources: %d", result.AppliedSources)
	}
	if result.AppliedSelectedModels != 2 {
		t.Fatalf("unexpected applied selected models: %d", result.AppliedSelectedModels)
	}

	state.mu.Lock()
	defer state.mu.Unlock()

	if len(state.sources) != 2 {
		t.Fatalf("unexpected runtime source count: %d", len(state.sources))
	}
	if state.sources[0].Name != "OpenAI" || state.sources[1].Name != "Anthropic" {
		t.Fatalf("unexpected runtime source order: %+v", state.sources)
	}
	if state.sources[0].ExternalID != "source-a" || state.sources[1].ExternalID != "source-b" {
		t.Fatalf("unexpected runtime external ids: %+v", state.sources)
	}
	if len(state.selectedModels) != 2 {
		t.Fatalf("unexpected runtime selected models: %+v", state.selectedModels)
	}
	if state.selectedModels[0].ModelID != "claude-sonnet-4-0" || state.selectedModels[0].Position != 0 {
		t.Fatalf("unexpected first runtime selected model: %+v", state.selectedModels[0])
	}
}

func TestAIMiniGatewayAdapterSyncFromProductStateFallsBackToLegacy(t *testing.T) {
	t.Parallel()

	state := newFakeAIMiniGatewayRuntime(false)
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return state.roundTrip(t, r)
	})}

	adapter := NewAIMiniGatewayAdapter(client)
	adapter.status = RuntimeStatus{
		RuntimeKind: RuntimeKindAIMiniGateway,
		State:       RuntimeStateRunning,
		Running:     true,
		Healthy:     true,
		APIBase:     "http://runtime.test",
	}

	_, err := adapter.SyncFromProductState(context.Background(), SyncInput{
		Sources: []SyncModelSource{
			{
				ID:             "source-a",
				ExternalID:     "source-a",
				Name:           "OpenAI",
				BaseURL:        "https://api.openai.com/v1",
				APIKey:         "sk-openai",
				ProviderType:   "openai-compatible",
				DefaultModelID: "gpt-4.1",
				Enabled:        true,
				Position:       0,
			},
		},
		SelectedModels: []SelectedModel{
			{ModelID: "gpt-4.1", Position: 0},
		},
	})
	if err != nil {
		t.Fatalf("sync from product state fallback: %v", err)
	}

	state.mu.Lock()
	defer state.mu.Unlock()

	if len(state.sources) != 1 || state.sources[0].Name != "OpenAI" {
		t.Fatalf("unexpected legacy runtime sources: %+v", state.sources)
	}
	if len(state.selectedModels) != 1 || state.selectedModels[0].ModelID != "gpt-4.1" {
		t.Fatalf("unexpected legacy runtime selected models: %+v", state.selectedModels)
	}
}

func TestAIMiniGatewayAdapterCheckModelSourceHealthResolvesExternalID(t *testing.T) {
	t.Parallel()

	state := newFakeAIMiniGatewayRuntime(true)
	state.sources = []RuntimeModelSource{
		{
			ID:             "src-1",
			ExternalID:     "local-source-1777774771452514000",
			Name:           "DeepSeek",
			BaseURL:        "https://api.deepseek.com",
			ProviderType:   "openai-compatible",
			DefaultModelID: "deepseek-chat",
			Enabled:        true,
			Position:       0,
		},
	}
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return state.roundTrip(t, r)
	})}

	adapter := NewAIMiniGatewayAdapter(client)
	adapter.status = RuntimeStatus{
		RuntimeKind: RuntimeKindAIMiniGateway,
		State:       RuntimeStateRunning,
		Running:     true,
		Healthy:     true,
		APIBase:     "http://runtime.test",
	}

	result, err := adapter.CheckModelSourceHealth(context.Background(), "local-source-1777774771452514000")
	if err != nil {
		t.Fatalf("check model source health: %v", err)
	}

	if result.Status != "ok" || result.StatusCode != http.StatusOK {
		t.Fatalf("unexpected healthcheck result: %+v", result)
	}
}

func TestNormalizeSelectedModels(t *testing.T) {
	t.Parallel()

	items := normalizeSelectedModels([]SelectedModel{
		{ModelID: "b", Position: 4},
		{ModelID: "a", Position: 7},
	})

	if len(items) != 2 {
		t.Fatalf("unexpected items length: %d", len(items))
	}
	if items[0].Position != 0 || items[1].Position != 1 {
		t.Fatalf("unexpected normalized positions: %+v", items)
	}

	if !slices.Equal([]string{items[0].ModelID, items[1].ModelID}, []string{"b", "a"}) {
		t.Fatalf("unexpected normalized order: %+v", items)
	}
}

type fakeAIMiniGatewayRuntime struct {
	mu             sync.Mutex
	atomicSync     bool
	nextID         int
	sources        []RuntimeModelSource
	selectedModels []SelectedModel
}

func newFakeAIMiniGatewayRuntime(atomicSync bool) *fakeAIMiniGatewayRuntime {
	return &fakeAIMiniGatewayRuntime{
		atomicSync: atomicSync,
		nextID:     1,
		sources: []RuntimeModelSource{
			{
				ID:             "src-existing",
				ExternalID:     "source-existing",
				Name:           "Legacy",
				BaseURL:        "https://legacy.example/v1",
				ProviderType:   "openai-compatible",
				DefaultModelID: "legacy-model",
				Enabled:        true,
				Position:       0,
			},
		},
	}
}

func (f *fakeAIMiniGatewayRuntime) roundTrip(t *testing.T, r *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/capabilities":
		return jsonResponse(http.StatusOK, map[string]any{
			"supports_openai_compatible":      true,
			"supports_anthropic_compatible":   true,
			"supports_models_api":             true,
			"supports_stream":                 true,
			"supports_admin_api":              true,
			"supports_model_source_admin":     true,
			"supports_selected_model_admin":   true,
			"supports_source_capabilities":    true,
			"supports_atomic_source_sync":     f.atomicSync,
			"supports_runtime_version":        true,
			"supports_explicit_source_health": true,
		}), nil
	case r.Method == http.MethodPut && r.URL.Path == "/admin/runtime/sync":
		var input struct {
			Sources []struct {
				ExternalID      string   `json:"external_id"`
				Name            string   `json:"name"`
				BaseURL         string   `json:"base_url"`
				ProviderType    string   `json:"provider_type"`
				DefaultModelID  string   `json:"default_model_id"`
				ExposedModelIDs []string `json:"exposed_model_ids"`
				Enabled         bool     `json:"enabled"`
				Position        int      `json:"position"`
			} `json:"sources"`
			SelectedModels []SelectedModel `json:"selected_models"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Fatalf("decode runtime sync: %v", err)
		}
		f.sources = make([]RuntimeModelSource, 0, len(input.Sources))
		for index, source := range input.Sources {
			f.sources = append(f.sources, RuntimeModelSource{
				ID:              "src-" + strconv.Itoa(index+1),
				ExternalID:      source.ExternalID,
				Name:            source.Name,
				BaseURL:         source.BaseURL,
				ProviderType:    source.ProviderType,
				DefaultModelID:  source.DefaultModelID,
				ExposedModelIDs: append([]string(nil), source.ExposedModelIDs...),
				Enabled:         source.Enabled,
				Position:        index,
				APIKeyMasked:    "sk-****",
			})
		}
		f.selectedModels = append([]SelectedModel(nil), input.SelectedModels...)
		return jsonResponse(http.StatusOK, SyncResult{
			AppliedSources:        len(f.sources),
			AppliedSelectedModels: len(f.selectedModels),
			LastSyncedAt:          "2026-05-02T00:00:00Z",
		}), nil
	case r.Method == http.MethodGet && r.URL.Path == "/admin/model-sources":
		return jsonResponse(http.StatusOK, f.sources), nil
	case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/healthcheck") && strings.HasPrefix(r.URL.Path, "/admin/model-sources/"):
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/admin/model-sources/"), "/healthcheck")
		id = strings.TrimSuffix(id, "/")
		for _, item := range f.sources {
			if item.ID != id {
				continue
			}
			return jsonResponse(http.StatusOK, ModelSourceHealthcheck{
				Status:     "ok",
				StatusCode: http.StatusOK,
				LatencyMS:  12,
				Summary:    "HTTP 200",
				CheckedAt:  "2026-05-04T00:00:00Z",
			}), nil
		}
		return jsonResponse(http.StatusNotFound, map[string]any{
			"error":   "not_found",
			"message": "resource not found",
		}), nil
	case r.Method == http.MethodPost && r.URL.Path == "/admin/model-sources":
		var input RuntimeModelSourceInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Fatalf("decode create source: %v", err)
		}
		item := RuntimeModelSource{
			ID:              "src-" + strconv.Itoa(f.nextID),
			ExternalID:      input.ExternalID,
			Name:            input.Name,
			BaseURL:         input.BaseURL,
			ProviderType:    input.ProviderType,
			DefaultModelID:  input.DefaultModelID,
			ExposedModelIDs: append([]string(nil), input.ExposedModelIDs...),
			Enabled:         input.Enabled,
			Position:        len(f.sources),
			APIKeyMasked:    "sk-****",
		}
		f.nextID++
		f.sources = append(f.sources, item)
		return jsonResponse(http.StatusCreated, item), nil
	case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/admin/model-sources/"):
		id := strings.TrimPrefix(r.URL.Path, "/admin/model-sources/")
		next := make([]RuntimeModelSource, 0, len(f.sources))
		for _, item := range f.sources {
			if item.ID == id {
				continue
			}
			next = append(next, item)
		}
		f.sources = next
		for index := range f.sources {
			f.sources[index].Position = index
		}
		return jsonResponse(http.StatusNoContent, nil), nil
	case r.Method == http.MethodPut && r.URL.Path == "/admin/selected-models":
		var input []SelectedModel
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Fatalf("decode selected models: %v", err)
		}
		f.selectedModels = append([]SelectedModel(nil), input...)
		return jsonResponse(http.StatusOK, f.selectedModels), nil
	case r.Method == http.MethodGet && r.URL.Path == "/admin/selected-models":
		return jsonResponse(http.StatusOK, f.selectedModels), nil
	default:
		t.Fatalf("unexpected runtime request: %s %s", r.Method, r.URL.Path)
		return nil, nil
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(status int, payload any) *http.Response {
	if payload == nil {
		return &http.Response{
			StatusCode: status,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(nil)),
		}
	}

	body, _ := json.Marshal(payload)
	return &http.Response{
		StatusCode: status,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(bytes.NewReader(body)),
	}
}
