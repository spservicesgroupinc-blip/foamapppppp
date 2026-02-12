# Google Cloud Run Deployment Guide

This guide will help you deploy the Foam CRM application to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**: Create one at [cloud.google.com](https://cloud.google.com)
2. **Google Cloud SDK**: Install from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)
3. **Docker**: Install from [docker.com](https://www.docker.com/get-started)
4. **Billing Enabled**: Your Google Cloud project must have billing enabled

## Initial Setup

### 1. Install Google Cloud SDK

**macOS:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:** Download and run the installer from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth configure-docker
```

### 3. Create or Select a Project

Create a new project:
```bash
gcloud projects create YOUR-PROJECT-ID --name="Foam CRM"
```

Or list existing projects:
```bash
gcloud projects list
```

Set your project:
```bash
gcloud config set project YOUR-PROJECT-ID
```

### 4. Enable Billing

Visit the [Google Cloud Console](https://console.cloud.google.com/billing) to enable billing for your project.

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

1. Set your project ID:
   ```bash
   export PROJECT_ID=your-gcp-project-id
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

The script will handle everything automatically!

### Option 2: Manual Deployment

1. **Enable Required APIs:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
   ```

2. **Set Environment Variables:**
   ```bash
   export PROJECT_ID=your-gcp-project-id
   export REGION=us-central1
   export SERVICE_NAME=foamapppppp
   ```

3. **Create Artifact Registry Repository:**
   ```bash
   gcloud artifacts repositories create ${SERVICE_NAME} \
     --repository-format=docker \
     --location=${REGION}
   ```

4. **Configure Docker Authentication:**
   ```bash
   gcloud auth configure-docker ${REGION}-docker.pkg.dev
   ```

5. **Build Docker Image:**
   ```bash
   docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest .
   ```

6. **Push to Artifact Registry:**
   ```bash
   docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest
   ```

7. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy ${SERVICE_NAME} \
     --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest \
     --platform=managed \
     --region=${REGION} \
     --allow-unauthenticated \
     --port=8080 \
     --memory=512Mi \
     --cpu=1 \
     --min-instances=0 \
     --max-instances=10
   ```

## Configuration

### Environment Variables

To add environment variables (e.g., GEMINI_API_KEY):

**Using gcloud:**
```bash
gcloud run services update foamapppppp \
  --region=us-central1 \
  --set-env-vars="GEMINI_API_KEY=your-api-key-here"
```

**Using Secret Manager (Recommended for sensitive data):**
```bash
# Create secret
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secret
gcloud run services update foamapppppp \
  --region=us-central1 \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest"
```

### Custom Domain

1. **Verify domain ownership** in Google Cloud Console
2. **Map domain to service:**
   ```bash
   gcloud run domain-mappings create \
     --service=foamapppppp \
     --domain=yourdomain.com \
     --region=us-central1
   ```
3. **Update DNS records** as instructed by the output

### Scaling Configuration

Modify `cloudrun.yaml` to customize scaling:

```yaml
annotations:
  autoscaling.knative.dev/minScale: '0'  # Minimum instances
  autoscaling.knative.dev/maxScale: '10' # Maximum instances
```

Then apply:
```bash
gcloud run services replace cloudrun.yaml
```

## Monitoring and Logs

### View Logs

**Recent logs:**
```bash
gcloud logs read --limit=50
```

**Live logs:**
```bash
gcloud logs tail
```

**Filter by service:**
```bash
gcloud logs read --filter="resource.labels.service_name=foamapppppp" --limit=50
```

### Monitoring Dashboard

Visit: [console.cloud.google.com/run](https://console.cloud.google.com/run)

## Cost Optimization

Cloud Run pricing is based on:
- **Requests**: First 2 million requests/month are free
- **Compute Time**: Charged per 100ms of CPU/memory usage
- **Network**: Egress charges may apply

**Tips to minimize costs:**
1. Set `minScale: 0` to scale to zero when not in use
2. Use appropriate memory/CPU limits (default: 512Mi/1 CPU)
3. Enable CPU throttling for cost savings
4. Use Cloud CDN for static assets

Estimated cost for low-traffic usage: **$0-5/month**

## Troubleshooting

### Build Fails

If Docker build fails:
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t test-build .
```

### Deployment Fails

Check service status:
```bash
gcloud run services describe foamapppppp --region=us-central1
```

View error logs:
```bash
gcloud logs read --filter="resource.labels.service_name=foamapppppp" --limit=20
```

### Container Won't Start

1. Test locally first:
   ```bash
   docker build -t test-build .
   docker run -p 8080:8080 test-build
   curl http://localhost:8080
   ```

2. Check Cloud Run logs for errors:
   ```bash
   gcloud logs read --filter="severity>=ERROR" --limit=50
   ```

## Updating the Application

To deploy updates:

1. **Make your code changes**

2. **Rebuild and redeploy:**
   ```bash
   ./deploy.sh
   ```

   Or manually:
   ```bash
   docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest .
   docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest
   gcloud run deploy ${SERVICE_NAME} \
     --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest \
     --region=${REGION}
   ```

## Cleanup

To delete all resources:

```bash
# Delete Cloud Run service
gcloud run services delete foamapppppp --region=us-central1

# Delete Artifact Registry repository
gcloud artifacts repositories delete foamapppppp --location=us-central1

# Delete Docker images locally
docker rmi $(docker images | grep foamapppppp | awk '{print $3}')
```

## Support

For issues with:
- **Google Cloud Run**: [cloud.google.com/run/docs](https://cloud.google.com/run/docs)
- **Docker**: [docs.docker.com](https://docs.docker.com)
- **This Application**: Open an issue in the repository

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use Secret Manager** for API keys and sensitive data
3. **Enable IAM authentication** for production (remove `--allow-unauthenticated`)
4. **Use VPC** for private services
5. **Enable Cloud Armor** for DDoS protection
6. **Regular updates** of dependencies and base images

## Next Steps

After deployment:
1. ✅ Test your application at the provided Cloud Run URL
2. ✅ Set up custom domain (optional)
3. ✅ Configure environment variables
4. ✅ Set up monitoring and alerts
5. ✅ Configure backup strategy
6. ✅ Review security settings
