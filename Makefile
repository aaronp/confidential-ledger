# Confidential Ledger Suite Makefile

.PHONY: install dev build test clean help

# Default target
help:
	@echo "Available targets:"
	@echo "  install  - Install dependencies using bun"
	@echo "  dev      - Start development server"
	@echo "  build    - Build for production"
	@echo "  test     - Run tests"
	@echo "  clean    - Clean build artifacts"
	@echo "  help     - Show this help message"

# Install dependencies
install:
	@echo "Installing dependencies..."
	bun install

# Start development server (depends on install)
dev: install
	@echo "Starting development server..."
	bun run dev

# Build for production
build: install
	@echo "Building for production..."
	bun run build

# Run tests
test: install
	@echo "Running tests..."
	bun run test

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf node_modules
	rm -f bun.lockb
