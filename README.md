# Smart Restaurant Admin Frontend (منظومة إدارة المطعم الذكي)

واجهة الإدارة والتحكم المستقلة (Standalone Admin Client) المبنية باستخدام Next.js App Router و React 19 و TypeScript و Tailwind CSS مع دعم كامل للغة العربية (RTL-First).

---

## 1. بنية المشروع وهيكل الملفات (Architecture)

```
smart-restaurant-admin/
├── src/
│   ├── app/                    # مسارات Next.js App Router
│   │   ├── layout.tsx          # المخطط العام وتطبيق خطوط Cairo & Tajawal و Sonner
│   │   ├── globals.css         # متغيرات التصميم وقواعد Tailwind
│   │   ├── page.tsx            # التوجيه التلقائي للوحة التحكم أو صفحة الدخول
│   │   ├── login/              # شاشة تسجيل دخول المشرفين والمدراء
│   │   ├── dashboard/          # اللوحة القيادية والمؤشرات الحية
│   │   ├── menu/               # إدارة قائمة الطعام والتصنيفات والأصناف
│   │   ├── tables/             # إدارة الطاولات والجلسات ورموز QR
│   │   ├── orders/             # استعراض وتدقيق سجل الفواتير والطلبات
│   │   ├── settings/           # إعدادات وهوية المطعم وساعات العمل
│   │   ├── analytics/          # عقود التحليلات والمؤشرات المشتقة
│   │   └── promotions/         # عقود العروض الترويجية والكوبونات
│   ├── components/             # المكونات القابلة لإعادة الاستخدام
│   │   ├── layout/             # Sidebar القابل للطي، Header، و AdminLayout
│   │   └── shared/             # AuthGuard، LoadingState، ErrorState، ContractUnavailableBanner
│   ├── features/               # الوحدات الوظيفية لكل شاشة
│   ├── services/               # استدعاءات الـ APIs وعقود الخادم
│   ├── lib/                    # عميل الـ API المركزي، إدارة الجلسات الآمنة، والمتحكمات
│   ├── context/                # سياق التحقق من صلاحيات المشرفين AuthContext
│   └── types/                  # نماذج TypeScript المتطابقة مع Go Backend
└── test/                       # اختبارات التكامل والوحدات الشاملة (21 اختباراً)
```

---

## 2. المسارات المنشأة في الواجهة (Routes Created)

| المسار | الوصف |
| :--- | :--- |
| `/login` | شاشة تسجيل دخول المشرفين مع التحقق من الهوية وربط خادم Go (`POST /api/v1/auth/login`) |
| `/dashboard` | اللوحة القيادية: المبيعات، إشغال الطاولات، الأصناف الأكثر طلباً، وتصفية التواريخ |
| `/menu` | إدارة قائمة الطعام: بحث، تصفية بالتصنيف، تعديل الأسعار، ومجموعات الخيارات، ومعاينة منيو الزبائن |
| `/tables` | إدارة الطاولات: متابعة الجلسات الحية، تعديل السعة، وتوليد وتحميل بطاقات الـ QR المشفرة |
| `/orders` | سجل الطلبات الشامل: تصفية الحالات والتواريخ، سجل الأحداث (Audit Trail)، ورابط شاشة المطبخ |
| `/settings` | إعدادات المطعم: الاسم، الشعار، ساعات العمل، حالة استقبال الطلبات، ورابط المنيو العام |
| `/analytics` | شاشة التحليلات: توثيق عقود الـ APIs المطلوبة وحساب المؤشرات المشتقة من البيانات الحية |
| `/promotions` | شاشة العروض الترويجية: توثيق عقود الكوبونات ومواصفات جدول PostgreSQL المقترح |

---

## 3. نقاط نهاية Go Backend المستهلكة (Consumed Endpoints)

- `POST /api/v1/auth/login` — تسجيل دخول المشرف واستخراج رمز الـ JWT
- `GET /api/v1/auth/me` — استرجاع وتأكيد هوية المشرف بواسطة Bearer Token
- `GET /api/v1/restaurants/:slug` — جلب بيانات وهوية المطعم وساعات العمل
- `GET /api/v1/restaurants/:slug/menu` — جلب قائمة الطعام الكاملة والتصنيفات
- `GET /api/v1/restaurants/:slug/categories` — جلب تصنيفات المنيو
- `GET /api/v1/restaurants/:slug/products` — البحث وتصفية المنتجات
- `GET /api/v1/products/:productId` — جلب تفاصيل صنف محدد
- `GET /api/v1/tables` — استعراض طاولات الصالة مع التصفية والترقيم
- `POST /api/v1/tables` — إضافة طاولة طعام جديدة
- `PATCH /api/v1/tables/:tableId` — تعديل حالة الطاولة وسعتها وقسمها
- `GET /api/v1/tables/:tableId/qr` — جلب بيانات رمز الاستجابة السريعة للطاولة
- `POST /api/v1/tables/:tableId/qr/regenerate` — تجديد وتوليد رمز QR مشفر جديد
- `GET /api/v1/sections` — جلب أقسام الصالة (الرئيسية، التراس، VIP)
- `POST /api/v1/sections` — إضافة قسم جديد للصالة
- `GET /api/v1/dashboard/orders` — استعراض الطلبات النشطة الفورية
- `GET /api/v1/dashboard/orders/history` — استعراض سجل الطلبات المكتملة والملغاة
- `GET /api/v1/orders/:orderId` — استرجاع تفاصيل الفاتورة
- `GET /api/v1/orders/:orderId/events` — استرجاع سجل أحداث دورة حياة الطلب (Audit Trail)
- `POST /api/v1/dashboard/orders/simulate` — محاكاة طلب مصري جديد فورياً

---

## 4. عقود الـ APIs غير المتوفرة بعد في الباك إند (Missing Contracts)

تم توثيق كافة نقاط النهاية المتبقية هندسياً داخل `src/types/contracts.ts` وواجهات الـ UI عبر `ContractUnavailableBanner` دون اختلاق بيانات وهمية:

1. **العمليات الكتابية لقائمة الطعام (Menu Mutations):**
   - `POST /api/v1/admin/products` — إنشاء صنف جديد
   - `PATCH /api/v1/admin/products/:id` — تعديل بيانات صنف
   - `DELETE /api/v1/admin/products/:id` — حذف صنف
   - `PATCH /api/v1/admin/products/:id/availability` — تفعيل أو تعطيل التوفر
   - `POST /api/v1/admin/categories` — إضافة تصنيف جديد
2. **تحديث إعدادات المطعم:**
   - `PATCH /api/v1/restaurants/:slug` — حفظ الإعدادات وتحديث ساعات العمل
3. **التحليلات المتقدمة (Analytics Engine):**
   - `GET /api/v1/admin/analytics/overview` — المؤشرات التجميعية
   - `GET /api/v1/admin/analytics/revenue-series` — المتسلسلة الزمنية للإيرادات
   - `GET /api/v1/admin/analytics/categories` — توزيع المبيعات بحسب الأقسام
4. **العروض الترويجية والكوبونات (Promotions):**
   - `GET /api/v1/admin/promotions` — استعراض الكوبونات
   - `POST /api/v1/admin/promotions` — إنشاء كوبون خصم
   - `PATCH /api/v1/admin/promotions/:id/status` — تفعيل/تعطيل الكوبون
   - `DELETE /api/v1/admin/promotions/:id` — حذف الكوبون

---

## 5. تشغيل واختبار المشروع

### تشغيل خادم التطوير (Port 3002):
```bash
npm run dev
```

### تشغيل اختبارات التكامل الصارمة (21 Unit & Integration Tests):
```bash
npm test
```

### بناء حزمة الإنتاج:
```bash
npm run build
```
