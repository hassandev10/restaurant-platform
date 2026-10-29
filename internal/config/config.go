package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	CORSAllowedOrigins []string
	Environment        string
}

func LoadConfig() *Config {
	// Try loading .env file if it exists
	if err := godotenv.Load(); err != nil {
		// Non-fatal: environment variables may already be set
		log.Println("Note: .env file not found or could not be loaded, using process environment")
	}

	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5433/smart_restaurant?sslmode=disable")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-smart-restaurant-egypt-2026")
	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,*")
	environment := getEnv("ENVIRONMENT", "development")

	var corsList []string
	for _, origin := range strings.Split(corsRaw, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			corsList = append(corsList, origin)
		}
	}

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		JWTSecret:          jwtSecret,
		CORSAllowedOrigins: corsList,
		Environment:        environment,
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
