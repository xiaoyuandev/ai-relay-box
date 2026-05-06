package localgateway

import (
	"errors"
	"fmt"
)

type AdapterErrorCode string

const (
	AdapterErrorUnavailable   AdapterErrorCode = "runtime_unavailable"
	AdapterErrorUnsupported   AdapterErrorCode = "unsupported_capability"
	AdapterErrorInvalidConfig AdapterErrorCode = "invalid_runtime_config"
	AdapterErrorConflict      AdapterErrorCode = "runtime_conflict"
	AdapterErrorSyncFailed    AdapterErrorCode = "runtime_sync_failed"
	AdapterErrorUpstream      AdapterErrorCode = "runtime_upstream_error"
)

type AdapterError struct {
	Code        AdapterErrorCode `json:"code"`
	Operation   string           `json:"operation"`
	RuntimeKind string           `json:"runtime_kind"`
	Message     string           `json:"message"`
	Retryable   bool             `json:"retryable"`
	Err         error            `json:"-"`
}

func (e *AdapterError) Error() string {
	if e == nil {
		return ""
	}

	message := e.Message
	if message == "" && e.Err != nil {
		message = e.Err.Error()
	}
	if e.Operation == "" {
		return string(e.Code) + ": " + message
	}

	return fmt.Sprintf("%s (%s): %s", e.Code, e.Operation, message)
}

func (e *AdapterError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func IsAdapterErrorCode(err error, code AdapterErrorCode) bool {
	var adapterErr *AdapterError
	if !errors.As(err, &adapterErr) {
		return false
	}
	return adapterErr.Code == code
}
