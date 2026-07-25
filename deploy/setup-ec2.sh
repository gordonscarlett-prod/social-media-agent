#!/bin/bash
# Run this script once on a fresh Ubuntu 22.04 EC2 instance
# Usage: bash setup-ec2.sh

set -e

echo "=== Installing system packages ==="
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv nginx git curl

echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Cloning repository ==="
cd /home/ubuntu
git clone https://github.com/gordonscarlett-prod/social-media-agent.git
cd social-media-agent

echo "=== Setting up Python virtual environment ==="
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
cd ..

echo "=== Creating upload directory ==="
mkdir -p backend/uploads

echo "=== Building frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Installing systemd service ==="
sudo cp deploy/social-media-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable social-media-agent

echo "=== Configuring nginx ==="
sudo cp deploy/nginx.conf /etc/nginx/sites-available/social-media-agent
sudo ln -sf /etc/nginx/sites-available/social-media-agent /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "=== NEXT STEPS ==="
echo "1. Copy your .env file:           scp .env ubuntu@<EC2-IP>:/home/ubuntu/social-media-agent/backend/.env"
echo "2. Copy google_credentials.json:  scp backend/google_credentials.json ubuntu@<EC2-IP>:/home/ubuntu/social-media-agent/backend/"
echo "3. Start the backend service:     sudo systemctl start social-media-agent"
echo "4. Check service status:          sudo systemctl status social-media-agent"
echo "5. Authorize Google Drive:        Open http://<EC2-IP>/api/drive/auth in your browser"
