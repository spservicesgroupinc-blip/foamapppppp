#!/bin/bash

# Cloud Run Deployment Script for Foam CRM App
# This script builds and deploys the application to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}ERROR: PROJECT_ID environment variable is not set${NC}"
    echo "Please set PROJECT_ID to your Google Cloud Project ID"
    echo "Example: export PROJECT_ID=my-gcp-project"
    exit 1
fi

# Set default values
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-foamapppppp}
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo -e "${GREEN}=== Foam CRM Cloud Run Deployment ===${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Name: $SERVICE_NAME"
echo "Image: $IMAGE_NAME"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Enable required APIs
echo -e "${GREEN}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    --project="${PROJECT_ID}" || true

# Create Artifact Registry repository if it doesn't exist
echo -e "${GREEN}Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create "${SERVICE_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" 2>/dev/null || echo "Repository already exists"

# Configure Docker authentication
echo -e "${GREEN}Configuring Docker authentication...${NC}"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Build the Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -t "${IMAGE_NAME}:latest" .

# Push the image to Artifact Registry
echo -e "${GREEN}Pushing image to Artifact Registry...${NC}"
docker push "${IMAGE_NAME}:latest"

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_NAME}:latest" \
    --platform=managed \
    --region="${REGION}" \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --project="${PROJECT_ID}"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format='value(status.url)')

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "Service URL: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo "To view logs:"
echo "  gcloud logs read --project=${PROJECT_ID} --limit=50"
echo ""
echo "To delete the service:"
echo "  gcloud run services delete ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
