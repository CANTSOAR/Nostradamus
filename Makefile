.PHONY: ssh-linuxone

ssh-linuxone:
	chmod 400 akash.pem
	ssh -i akash.pem linux1@148.100.78.94
