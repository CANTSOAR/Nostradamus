.PHONY: ssh-linuxone deploy-linuxone

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
