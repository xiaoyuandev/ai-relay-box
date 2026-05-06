package localgateway

import "net/http"

const DefaultRuntimeKind = RuntimeKindAIMiniGateway

func NewAdapter(runtimeKind string, client *http.Client) GatewayAdapter {
	switch normalizeRuntimeKind(runtimeKind) {
	case RuntimeKindAIMiniGateway:
		return NewAIMiniGatewayAdapter(client)
	default:
		return NewUnsupportedAdapter(runtimeKind)
	}
}

func normalizeRuntimeKind(runtimeKind string) string {
	if runtimeKind == "" {
		return DefaultRuntimeKind
	}
	return runtimeKind
}
