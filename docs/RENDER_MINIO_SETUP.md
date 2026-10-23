# MinIO Deployment Guide for Render

## Overview

Render doesn't have native MinIO support, but you can deploy MinIO using a Docker-based approach or use alternative S3-compatible storage solutions.

## Option 1: MinIO via Docker on Render (Recommended for Testing)

### Step 1: Create a Dockerfile for MinIO

Create `docker/minio.Dockerfile`:

```dockerfile
FROM minio/minio:latest

# Set default credentials (will be overridden by environment variables)
ENV MINIO_ROOT_USER=admin
ENV MINIO_ROOT_PASSWORD=changeme

# Expose MinIO API and Console ports
EXPOSE 9000 9001

# Start MinIO server with console
CMD ["server", "/data", "--console-address", ":9001"]
```

### Step 2: Create Render Service

1. Go to Render Dashboard → New → Docker Service
2. Configure:
   - **Name**: `asset-management-minio`
   - **Region**: Choose closest to your API
   - **Dockerfile Path**: `docker/minio.Dockerfile`
   - **Instance Type**: Free (for testing) or Standard
   - **Add Persistent Disk**: 10GB (for file storage)

### Step 3: Set Environment Variables

Add these environment variables to your MinIO Render service:

```
MINIO_ROOT_USER=your_secure_username
MINIO_ROOT_PASSWORD=your_secure_password_32_chars_min
```

**Important**: The password must be at least 8 characters. For production, use 32+ characters.

### Step 4: Get Render Service Details

After deployment:
- Copy the service URL (e.g., `https://asset-management-minio.onrender.com`)
- MinIO API: `https://asset-management-minio.onrender.com:9000`
- MinIO Console: `https://asset-management-minio.onrender.com:9001`

### Step 5: Create Initial Bucket

Access the MinIO Console at `https://asset-management-minio.onrender.com:9001`:
- Login with your credentials
- Create a bucket named `assets`
- Set bucket policy to public or private based on your needs

---

## Option 2: Use Render's Native Storage (Alternative)

### Option 2A: Render Disk Storage

For simpler deployments, you can use Render's built-in disk storage instead of MinIO:

1. Add a persistent disk to your API service
2. Use `STORAGE_DRIVER=local` in environment variables
3. Set `LOCAL_UPLOAD_DIR=/opt/render/project/upload`
4. Set `LOCAL_BASE_URL=https://your-api.onrender.com`

**Limitations**:
- Files are lost if you redeploy (unless you persist to disk)
- No S3 API compatibility
- Single service only

### Option 2B: AWS S3 (Production Recommended)

For production, use AWS S3 directly:

```env
STORAGE_DRIVER=s3
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

---

## Configure Your API for Render MinIO

### Step 1: Update Environment Variables

Add these to your API's Render environment variables:

```env
STORAGE_DRIVER=minio
MINIO_ENDPOINT=https://asset-management-minio.onrender.com
MINIO_BUCKET=assets
MINIO_ACCESS_KEY=your_secure_username
MINIO_SECRET_KEY=your_secure_password_32_chars_min
```

**Note**: If using HTTP, change endpoint to `http://asset-management-minio.onrender.com`

### Step 2: Update CORS Settings (if needed)

If you encounter CORS issues, configure MinIO to allow your API domain:

```bash
# Access MinIO via mc CLI
mc alias set render https://asset-management-minio.onrender.com:9000 your_secure_username your_secure_password

# Set CORS policy
mc admin policy set render --cors='{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-api.onrender.com"],
      "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}' assets
```

---

## Important Considerations

### Render Free Tier Limitations
- MinIO Docker service may not work on free tier (requires persistent disk)
- Free tier services spin down after inactivity
- Consider using paid Standard tier for production

### Production Recommendations
1. **Use AWS S3** instead of self-hosted MinIO for better reliability
2. Enable SSL/TLS for all connections
3. Use strong credentials (32+ character passwords)
4. Set up bucket policies for security
5. Configure lifecycle policies for old files
6. Enable versioning if needed

### Network Configuration
- Ensure your API can reach the MinIO service
- If using private services, configure Render's networking
- Consider using Render's private services for enhanced security

---

## Troubleshooting

### Connection Refused
- Check if MinIO service is running
- Verify endpoint URL (include `:9000` for API)
- Check firewall/security settings

### Authentication Failed
- Verify credentials match between services
- Check for typos in environment variables
- Ensure password meets minimum length requirements

### Bucket Not Found
- Create the bucket via MinIO Console first
- Verify bucket name matches configuration
- Check bucket permissions

### SSL/TLS Issues
- Use `http://` for development
- Use `https://` for production with valid certificates
- If using self-signed certs, configure Node.js to accept them

---

## Example: Full Render Environment Variables

For your API service:

```env
NODE_ENV=production
PORT=8000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/asset-management
JWT_ACCESS_SECRET=your-32-char-secret
JWT_REFRESH_SECRET=your-32-char-secret
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=30d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=https://your-frontend.onrender.com

# Storage - MinIO on Render
STORAGE_DRIVER=minio
MINIO_ENDPOINT=https://asset-management-minio.onrender.com
MINIO_BUCKET=assets
MINIO_ACCESS_KEY=your_secure_username
MINIO_SECRET_KEY=your_secure_password_32_chars_min
```

---

## Additional Resources

- [Render Docker Services](https://render.com/docs/docker-services)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [AWS SDK for S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
