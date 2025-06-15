#!/bin/bash

# AegisX Platform Development Services Management Script

set -e

DOCKER_COMPOSE_FILE="docker-compose.yml"
# Use default project name (directory name)
PROJECT_NAME=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2:-$GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Start all services
start_services() {
    print_info "Starting AegisX development services..."
    
    check_docker
    
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    print_success "All services started successfully!"
    print_info "Services available at:"
    echo "  📊 PostgreSQL: localhost:5432"
    echo "  🔴 Redis: localhost:6379"
    echo "  🐰 RabbitMQ: localhost:5672 (Management: http://localhost:15672)"
    echo "  📦 MinIO: http://localhost:9000 (Console: http://localhost:9001)"
    echo "  🔧 pgAdmin: http://localhost:5050"
}

# Stop all services
stop_services() {
    print_info "Stopping AegisX development services..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    print_success "All services stopped!"
}

# Restart all services
restart_services() {
    print_info "Restarting AegisX development services..."
    
    stop_services
    start_services
}

# Show status of services
status_services() {
    print_info "AegisX development services status:"
    
    docker-compose -f $DOCKER_COMPOSE_FILE ps
}

# Show logs
logs_services() {
    local service=${1:-}
    
    if [ -n "$service" ]; then
        print_info "Showing logs for $service..."
        docker-compose -f $DOCKER_COMPOSE_FILE logs -f $service
    else
        print_info "Showing logs for all services..."
        docker-compose -f $DOCKER_COMPOSE_FILE logs -f
    fi
}

# Clean up (remove containers and volumes)
clean_services() {
    print_warning "This will remove all containers and volumes. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_info "Cleaning up AegisX development services..."
        
        docker-compose -f $DOCKER_COMPOSE_FILE down -v --remove-orphans
        docker volume prune -f
        
        print_success "Cleanup completed!"
    else
        print_info "Cleanup cancelled."
    fi
}

# Setup MinIO buckets
setup_minio() {
    print_info "Setting up MinIO buckets..."
    
    # Wait for MinIO to be ready
    sleep 5
    
    docker exec aegisx-minio mc alias set local http://localhost:9000 admin password123
    docker exec aegisx-minio mc mb local/uploads --ignore-existing
    docker exec aegisx-minio mc mb local/avatars --ignore-existing
    docker exec aegisx-minio mc mb local/documents --ignore-existing
    
    print_success "MinIO buckets created!"
}

# Test database connection
test_db() {
    print_info "Testing database connection..."
    
    docker exec aegisx-postgres psql -U postgres -d aegisx_db -c "SELECT 'Database connection successful!' as status;"
    
    if [ $? -eq 0 ]; then
        print_success "Database connection test passed!"
    else
        print_error "Database connection test failed!"
    fi
}

# Show help
show_help() {
    echo "AegisX Platform Development Services Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start all development services"
    echo "  stop      Stop all development services"  
    echo "  restart   Restart all development services"
    echo "  status    Show status of all services"
    echo "  logs      Show logs for all services (or specific service)"
    echo "  clean     Remove all containers and volumes"
    echo "  setup     Setup additional configurations (MinIO buckets)"
    echo "  test-db   Test database connection"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs postgres"
    echo "  $0 status"
}

# Main script logic
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        status_services
        ;;
    logs)
        logs_services $2
        ;;
    clean)
        clean_services
        ;;
    setup)
        setup_minio
        ;;
    test-db)
        test_db
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac 