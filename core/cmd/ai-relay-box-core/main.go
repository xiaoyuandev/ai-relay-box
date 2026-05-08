package main

import (
	"log"

	"github.com/xiaoyuandev/ai-relay-box/core/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
