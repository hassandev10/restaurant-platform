export const CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080",
  defaultRestaurantSlug: process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG || "demo-restaurant",
  ordersDashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001",
  customerFrontendUrl: process.env.NEXT_PUBLIC_CUSTOMER_URL || "http://localhost:3000",
} as const;
