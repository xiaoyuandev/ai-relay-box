package localgateway

type ModelSource struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	BaseURL         string   `json:"base_url"`
	APIKeyRef       string   `json:"-"`
	APIKey          string   `json:"api_key"`
	ProviderType    string   `json:"provider_type"`
	DefaultModelID  string   `json:"default_model_id"`
	ExposedModelIDs []string `json:"exposed_model_ids"`
	Enabled         bool     `json:"enabled"`
	Position        int      `json:"position"`
	APIKeyMasked    string   `json:"api_key_masked"`
	LastSyncStatus  string   `json:"last_sync_status"`
	LastSyncError   string   `json:"last_sync_error,omitempty"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

type SelectedModel struct {
	ModelID  string `json:"model_id"`
	Position int    `json:"position"`
}
