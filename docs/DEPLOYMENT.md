# PageSense Deployment Guide

## Production Deployment Options

### Option 1: Docker Compose (Recommended for Small-Medium Scale)

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

#### Steps

1. **Clone and Configure**
```bash
git clone <repository-url>
cd pagesense
cp backend/.env.example backend/.env
```

2. **Edit Production Environment**
```bash
nano backend/.env
```

Set production values:
```env
API_ENV=production
DEBUG=False
SECRET_KEY=<generate-secure-random-key>
JWT_SECRET_KEY=<generate-secure-random-key>
GROQ_API_KEY=<your-groq-api-key>
DATABASE_URL=postgresql://pagesense:secure_password@postgres:5432/pagesense
```

3. **Update docker-compose.yml for Production**
```yaml
# Set secure passwords
environment:
  POSTGRES_PASSWORD: <secure-password>
```

4. **Start Services**
```bash
docker-compose up -d
```

5. **Verify Deployment**
```bash
# Check all services are running
docker-compose ps

# Check logs
docker-compose logs -f backend

# Test API
curl http://localhost:8000/health
```

6. **Setup Nginx Reverse Proxy** (Optional but recommended)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Kubernetes Deployment

#### Prerequisites
- Kubernetes cluster (GKE, EKS, AKS)
- kubectl configured
- Helm 3+

#### Steps

1. **Create Namespace**
```bash
kubectl create namespace pagesense
```

2. **Create Secrets**
```bash
kubectl create secret generic pagesense-secrets \
  --from-literal=groq-api-key=<your-key> \
  --from-literal=jwt-secret=<your-secret> \
  -n pagesense
```

3. **Deploy PostgreSQL** (using Helm)
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql \
  --set auth.database=pagesense \
  --set auth.username=pagesense \
  -n pagesense
```

4. **Deploy Redis**
```bash
helm install redis bitnami/redis \
  --set auth.enabled=false \
  -n pagesense
```

5. **Deploy Qdrant**
```bash
kubectl apply -f k8s/qdrant-deployment.yaml -n pagesense
```

6. **Deploy Backend**
```bash
kubectl apply -f k8s/backend-deployment.yaml -n pagesense
kubectl apply -f k8s/backend-service.yaml -n pagesense
```

7. **Setup Ingress**
```bash
kubectl apply -f k8s/ingress.yaml -n pagesense
```

### Option 3: Cloud Platform Deployment

#### AWS Deployment (ECS + RDS)

1. **Setup RDS PostgreSQL**
```bash
aws rds create-db-instance \
  --db-instance-identifier pagesense-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username pagesense \
  --master-user-password <secure-password>
```

2. **Setup ElastiCache Redis**
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id pagesense-redis \
  --engine redis \
  --cache-node-type cache.t3.micro
```

3. **Push Docker Image to ECR**
```bash
aws ecr create-repository --repository-name pagesense-backend

docker build -t pagesense-backend backend/
docker tag pagesense-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/pagesense-backend:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/pagesense-backend:latest
```

4. **Create ECS Task Definition**
```json
{
  "family": "pagesense-backend",
  "containerDefinitions": [{
    "name": "backend",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/pagesense-backend:latest",
    "environment": [
      {"name": "DATABASE_URL", "value": "postgresql://..."},
      {"name": "REDIS_URL", "value": "redis://..."}
    ],
    "secrets": [
      {"name": "GROQ_API_KEY", "valueFrom": "arn:aws:secretsmanager:..."}
    ]
  }]
}
```

5. **Create ECS Service**
```bash
aws ecs create-service \
  --cluster pagesense \
  --service-name backend \
  --task-definition pagesense-backend \
  --desired-count 2
```

#### Google Cloud Platform (Cloud Run)

1. **Build and Push Image**
```bash
gcloud builds submit --tag gcr.io/<project-id>/pagesense-backend backend/
```

2. **Deploy to Cloud Run**
```bash
gcloud run deploy pagesense-backend \
  --image gcr.io/<project-id>/pagesense-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=<url>,REDIS_URL=<url> \
  --set-secrets GROQ_API_KEY=groq-key:latest
```

## Chrome Extension Distribution

### Chrome Web Store Publishing

1. **Prepare Extension**
```bash
cd frontend/chrome-extension
npm run build
cd dist
zip -r ../pagesense-extension.zip *
```

2. **Create Developer Account**
- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- Pay one-time $5 registration fee

3. **Upload Extension**
- Click "New Item"
- Upload `pagesense-extension.zip`
- Fill in store listing details
- Submit for review

4. **Update manifest.json for production**
```json
{
  "name": "PageSense - AI Page Summarizer",
  "version": "1.0.0",
  "oauth2": {
    "client_id": "<your-oauth-client-id>",
    "scopes": ["openid", "email", "profile"]
  }
}
```

### Enterprise Distribution

For private enterprise distribution:

1. **Package Extension**
```bash
cd frontend/chrome-extension/dist
google-chrome --pack-extension=. --pack-extension-key=../key.pem
```

2. **Host CRX File**
- Upload `.crx` file to your server
- Create update manifest XML

3. **Configure Update URL**
```json
{
  "update_url": "https://yourdomain.com/updates.xml"
}
```

## Monitoring & Observability

### Setup Prometheus + Grafana

1. **Add to docker-compose.yml**
```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
```

2. **Configure Prometheus** (`prometheus.yml`)
```yaml
scrape_configs:
  - job_name: 'pagesense'
    static_configs:
      - targets: ['backend:9090']
```

### Setup Sentry Error Tracking

1. **Add to .env**
```env
SENTRY_DSN=https://<key>@sentry.io/<project>
```

2. **Sentry will auto-capture errors** (already integrated in main.py)

## SSL/TLS Setup

### Using Let's Encrypt

1. **Install Certbot**
```bash
apt-get install certbot python3-certbot-nginx
```

2. **Get Certificate**
```bash
certbot --nginx -d api.yourdomain.com
```

3. **Auto-renewal**
```bash
certbot renew --dry-run
```

## Backup Strategy

### Database Backups

1. **Automated PostgreSQL Backup**
```bash
# Add to cron
0 2 * * * docker exec pagesense-postgres pg_dump -U pagesense pagesense > /backups/pagesense-$(date +\%Y\%m\%d).sql
```

2. **Qdrant Vector DB Backup**
```bash
# Snapshot Qdrant data
docker exec pagesense-qdrant tar -czf /qdrant/backup.tar.gz /qdrant/storage
```

### Restore Procedure

```bash
# Restore PostgreSQL
docker exec -i pagesense-postgres psql -U pagesense pagesense < backup.sql

# Restore Qdrant
docker exec pagesense-qdrant tar -xzf /qdrant/backup.tar.gz
```

## Performance Optimization

### Database Indexing

Already included in models, but verify:
```sql
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_chat_user_id ON chats(user_id);
CREATE INDEX idx_message_chat_id ON messages(chat_id);
```

### Redis Caching

Cache configuration is already optimized in `redis_client.py`:
- Summary cache TTL: 24 hours
- Rate limit windows: 60 seconds

### Connection Pooling

Already configured in `database.py`:
- Pool size: 20
- Max overflow: 40

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] API key rotation policy
- [ ] Monitor suspicious activity

## Scaling Considerations

### Horizontal Scaling

1. **Backend**: Run multiple instances behind load balancer
2. **Database**: Use read replicas for queries
3. **Redis**: Use Redis Cluster for distributed cache
4. **Qdrant**: Shard vector collections

### Vertical Scaling

- Increase container resources in docker-compose
- Upgrade database instance type
- Add more RAM for vector operations

## Cost Optimization

### Groq API Usage
- Cache summaries aggressively
- Use smaller models for simple tasks
- Implement request queuing
- Monitor token usage

### Infrastructure
- Use spot instances where possible
- Auto-scaling based on demand
- Compress responses (GZip enabled)
- CDN for static assets

## Health Checks

Monitor these endpoints:
- `GET /health` - API health
- `GET /api/v1/embed/health` - Embeddings service
- Database connectivity
- Redis connectivity
- Qdrant connectivity

## Troubleshooting

### Common Issues

**Issue**: Extension can't connect to API
- Check CORS configuration
- Verify API_BASE_URL in background.js
- Check network tab in DevTools

**Issue**: Slow summarization
- Check Groq API status
- Monitor database query performance
- Review Redis cache hit rate

**Issue**: Out of memory
- Increase container memory limits
- Optimize chunk sizes
- Clear old vector embeddings