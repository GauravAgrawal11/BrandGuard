#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "=================================================="
echo " Starting BrandGuard Backend Production Build"
echo "=================================================="

# Navigate to backend directory if in project root
if [ -d "backend" ]; then
    cd backend
fi

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Django static files collection, database migrations, and initial seed
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py seed_demo

echo "=================================================="
echo " BrandGuard Build Completed Successfully!"
echo "=================================================="
