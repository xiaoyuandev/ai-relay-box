package localgateway

import (
	"context"
	"fmt"
	"sync"
)

type RuntimeConfig struct {
	Executable  string
	Host        string
	Port        int
	DataDir     string
	Environment map[string]string
	Arguments   []string
}

type Manager struct {
	mu           sync.RWMutex
	service      *Service
	adapter      GatewayAdapter
	runtime      RuntimeConfig
	lastSync     SyncResult
	lastSyncErr  string
	runtimeError string
}

func NewManager(service *Service, adapter GatewayAdapter, runtime RuntimeConfig) *Manager {
	return &Manager{
		service: service,
		adapter: adapter,
		runtime: runtime,
	}
}

func (m *Manager) Bootstrap(ctx context.Context) error {
	if !m.runtimeConfigured() {
		return nil
	}

	_, err := m.adapter.StartRuntime(ctx, StartRuntimeInput{
		Executable:  m.runtime.Executable,
		Host:        m.runtime.Host,
		Port:        m.runtime.Port,
		DataDir:     m.runtime.DataDir,
		Environment: m.runtime.Environment,
		Arguments:   m.runtime.Arguments,
	})
	if err != nil {
		m.mu.Lock()
		m.runtimeError = err.Error()
		m.mu.Unlock()
		return err
	}

	m.mu.Lock()
	m.runtimeError = ""
	m.mu.Unlock()
	return nil
}

func (m *Manager) GetRuntimeStatus(ctx context.Context) (RuntimeStatus, error) {
	if !m.runtimeConfigured() {
		return RuntimeStatus{
			RuntimeKind: RuntimeKindAIMiniGateway,
			State:       RuntimeStateStopped,
			Managed:     true,
			Running:     false,
			Healthy:     false,
			APIBase:     buildAPIBase(m.runtime.Host, m.runtime.Port),
			Host:        m.runtime.Host,
			Port:        m.runtime.Port,
			LastError:   "local gateway runtime executable is not configured",
		}, nil
	}

	status, err := m.adapter.GetRuntimeStatus(ctx)
	if err != nil {
		return RuntimeStatus{}, err
	}

	m.mu.RLock()
	runtimeError := m.runtimeError
	m.mu.RUnlock()

	if status.Host == "" {
		status.Host = m.runtime.Host
	}
	if status.Port == 0 {
		status.Port = m.runtime.Port
	}
	if status.APIBase == "" {
		status.APIBase = buildAPIBase(m.runtime.Host, m.runtime.Port)
	}
	if status.LastError == "" {
		status.LastError = runtimeError
	}

	return status, nil
}

func (m *Manager) GetCapabilities(ctx context.Context) (RuntimeCapabilities, error) {
	if !m.runtimeConfigured() {
		return RuntimeCapabilities{}, nil
	}
	return m.adapter.GetCapabilities(ctx)
}

func (m *Manager) ListSources(ctx context.Context) ([]ModelSource, error) {
	return m.service.ListSources(ctx)
}

func (m *Manager) CreateSource(ctx context.Context, input CreateModelSourceInput) (ModelSource, error) {
	item, err := m.service.CreateSource(ctx, input)
	if err != nil {
		return ModelSource{}, err
	}

	if err := m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusPending, ""); err != nil {
		return ModelSource{}, err
	}

	refreshed, err := m.service.GetSourceByID(ctx, item.ID)
	if err != nil {
		return ModelSource{}, err
	}
	return *refreshed, nil
}

func (m *Manager) UpdateSource(ctx context.Context, id string, input UpdateModelSourceInput) (ModelSource, error) {
	item, err := m.service.UpdateSource(ctx, id, input)
	if err != nil {
		return ModelSource{}, err
	}

	if err := m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusPending, ""); err != nil {
		return ModelSource{}, err
	}

	refreshed, err := m.service.GetSourceByID(ctx, item.ID)
	if err != nil {
		return ModelSource{}, err
	}
	return *refreshed, nil
}

func (m *Manager) DeleteSource(ctx context.Context, id string) error {
	if err := m.service.DeleteSource(ctx, id); err != nil {
		return err
	}

	return m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusPending, "")
}

func (m *Manager) ListSelectedModels(ctx context.Context) ([]SelectedModel, error) {
	return m.service.ListSelectedModels(ctx)
}

func (m *Manager) ReplaceSelectedModels(ctx context.Context, items []SelectedModel) ([]SelectedModel, error) {
	selected, err := m.service.ReplaceSelectedModels(ctx, items)
	if err != nil {
		return nil, err
	}

	if err := m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusPending, ""); err != nil {
		return nil, err
	}

	return selected, nil
}

func (m *Manager) Sync(ctx context.Context) (SyncResult, error) {
	input, err := m.service.BuildSyncInput(ctx)
	if err != nil {
		return SyncResult{}, err
	}

	if !m.runtimeConfigured() {
		syncErr := "local gateway runtime executable is not configured"
		_ = m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusError, syncErr)
		return SyncResult{}, &AdapterError{
			Code:        AdapterErrorInvalidConfig,
			Operation:   "sync_runtime",
			RuntimeKind: RuntimeKindAIMiniGateway,
			Message:     syncErr,
		}
	}

	status, err := m.adapter.GetRuntimeStatus(ctx)
	if err != nil {
		return SyncResult{}, err
	}
	if !status.Running {
		if _, err := m.adapter.StartRuntime(ctx, StartRuntimeInput{
			Executable:  m.runtime.Executable,
			Host:        m.runtime.Host,
			Port:        m.runtime.Port,
			DataDir:     m.runtime.DataDir,
			Environment: m.runtime.Environment,
			Arguments:   m.runtime.Arguments,
		}); err != nil {
			_ = m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusError, err.Error())
			return SyncResult{}, err
		}
	}

	if err := m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusPending, ""); err != nil {
		return SyncResult{}, err
	}

	result, err := m.adapter.SyncFromProductState(ctx, input)
	if err != nil {
		_ = m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusError, err.Error())
		m.mu.Lock()
		m.lastSyncErr = err.Error()
		m.lastSync = SyncResult{}
		m.mu.Unlock()
		return SyncResult{}, err
	}

	if err := m.service.UpdateAllSourcesSyncState(ctx, SourceSyncStatusSynced, ""); err != nil {
		return SyncResult{}, err
	}

	m.mu.Lock()
	m.lastSync = result
	m.lastSyncErr = ""
	m.mu.Unlock()

	return result, nil
}

func (m *Manager) GetLastSyncResult() (SyncResult, string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastSync, m.lastSyncErr
}

func (m *Manager) runtimeConfigured() bool {
	return m.adapter != nil && m.service != nil && m.runtime.Executable != "" && m.runtime.Host != "" && m.runtime.Port > 0 && m.runtime.DataDir != ""
}

func (m *Manager) String() string {
	return fmt.Sprintf("localgateway.Manager(runtime=%s:%d)", m.runtime.Host, m.runtime.Port)
}
