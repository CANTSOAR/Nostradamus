.PHONY: ssh-linuxone deploy-linuxone backend frontend dev kill

backend:
	cargo run --release

frontend:
	cd frontend && npm run dev

dev:
	make -j 2 backend frontend

kill:
	@echo "Killing backend and frontend processes..."
	-pkill -f Nostradamus || true
	-pkill -f vite || true
	@echo "All processes terminated."

ssh-linuxone:
	chmod 400 akash.pem
	ssh -i akash.pem linux1@148.100.78.94

deploy-linuxone:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building backend for release..."
	cargo build --release
	@echo "Deploying to IBM LinuxONE..."
	chmod 400 akash.pem
	scp -i akash.pem -r frontend/dist linux1@148.100.78.94:~/palantir-at-home/frontend/
	scp -i akash.pem target/release/palantir-at-home linux1@148.100.78.94:~/palantir-at-home/
	@echo "Deployment complete."
