# Smart Restaurant Platform — Standalone Go Backend API

خادم منصة المطاعم الذكية المستقل المبني بلغة Go وإطار العمل Gin مع قاعدة بيانات PostgreSQL ونظام التنبيهات اللحظية عبر WebSockets.

---

## 1. Stack & Architecture

- **Language:** Go 1.26+
- **HTTP Framework:** Gin (`github.com/gin-gonic/gin`)
- **Database:** PostgreSQL 18 / 16 (with connection pooling)
- **Real-time Engine:** WebSockets (`github.com/gorilla/websocket`) with Room/Restaurant filtering & automatic reconnection
- **Authentication:** JWT (`github.com/golang-jwt/jwt/v5`) + Bcrypt
- **Architectural Layers:** Handlers $\rightarrow$ Services $\rightarrow$ Repositories $\rightarrow$ Database

---

## 2. API Endpoints

### Health & Real-time:
- `GET /health` — فحص جاهزية الخادم وقاعدة البيانات
- `GET /api/v1/ws` — قناة الـ WebSockets اللحظية (تدعم `?restaurantId=rest-01` أو `?orderId=...`)

### Customer & Menu Endpoints:
- `GET /api/v1/restaurants/:restaurantSlug` — بيانات المطعم وساعات العمل
- `GET /api/v1/restaurants/:restaurantSlug/tables/:tableToken` — التحقق من رمز الطاولة (QR)
- `GET /api/v1/restaurants/:restaurantSlug/menu` — قائمة الطعام والأصناف ومجموعات الخيارات
- `GET /api/v1/restaurants/:restaurantSlug/categories` — تصنيفات المنيو
- `GET /api/v1/restaurants/:restaurantSlug/products` — البحث وتصفية المنتجات
- `GET /api/v1/products/:productId` — تفاصيل منتج محدد

### Orders & Workflow:
- `POST /api/v1/orders` — إنشاء وحفظ طلب جديد (مع التحقق الصارم من صحة الأسعار ومجموعات الخيارات)
- `GET /api/v1/orders/:orderId` — تفاصيل الطلب ولقطات الأسعار التاريخية
- `GET /api/v1/orders/:orderId/events` — سجل أحداث وحالات الطلب (Audit Trail)
- `PATCH /api/v1/orders/:orderId/status` — انتقال دورة حياة الطلب (`CONFIRMED`, `PREPARING`, `READY`, `SERVED`)
- `POST /api/v1/orders/:orderId/cancel` — إلغاء الطلب مع توثيق السبب والمشرف المسؤول

### Dashboard Endpoints:
- `GET /api/v1/dashboard/orders` — الطلبات النشطة الحالية مرتبة FIFO
- `GET /api/v1/dashboard/orders/history` — سجل الطلبات المنتهية (`SERVED`, `CANCELLED`)
- `POST /api/v1/dashboard/orders/simulate` — توليد ومحاكاة طلب مصري جديد فوري
- `POST /api/v1/auth/login` — تسجيل دخول موظفي الصالة والمطبخ
- `GET /api/v1/auth/me` — استرجاع بيانات المشرف المسجل

---

## 3. How to Run Locally

### Option A: Direct Local Execution (Fastest & Zero Setup):
1. قاعدة البيانات المحلية تعمل تلقائياً على المنفذ `5433` باسم `smart_restaurant`.
2. تشغيل السيرفر:
```powershell
cd D:\smart-restaurant-api
go run cmd\api\main.go
```
أو تشغيل الملف التنفيذي المترجم مباشرة:
```powershell
.\smart-restaurant-api.exe
```

### Option B: Docker Compose:
```bash
docker compose up -d
```

---

## 4. Testing

تشغيل كافة اختبارات الـ Unit Tests والـ Integration Tests:
```powershell
go test -v ./test/...
```
