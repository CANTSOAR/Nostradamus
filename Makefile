.PHONY: all backend frontend clean

# Default target runs both concurrently
all:
	@echo "Starting Nostradamus MVP (Backend + Frontend)..."
	@make -j 2 backend frontend

backend:
	@echo "Starting Rust Backend..."
	cargo run --release

frontend:
	@echo "Starting React Frontend..."
	cd frontend && npm run dev

clean:
	@echo "Cleaning project..."
	cargo clean
	rm -rf frontend/node_modules
	rm -rf frontend/dist
